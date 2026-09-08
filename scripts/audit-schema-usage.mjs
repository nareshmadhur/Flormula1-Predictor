import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const ROOT_DIR = process.cwd()
const MIGRATIONS_DIR = join(ROOT_DIR, 'supabase', 'migrations')
const CODE_ROOTS = ['app', 'components', 'utils', 'scripts']
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'])
const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules'])

const TABLE_CLASSIFICATION = {
  profiles: 'identity',
  tenants: 'tenant/group',
  constructors: 'reference',
  drivers: 'reference',
  circuits: 'reference',
  races: 'schedule/core',
  bonus_questions: 'gameplay',
  bonus_options: 'gameplay',
  predictions: 'gameplay/core',
  prediction_bonus_answers: 'gameplay/core',
  race_results: 'results/core',
  race_bonus_answers: 'results/core',
  user_race_scores: 'derived/scoring',
  leaderboard_cache: 'derived/cache',
  group_invites: 'tenant/group',
  group_invite_acceptances: 'tenant/group',
  group_requests: 'tenant/group',
  notification_preferences: 'notification',
  notification_events: 'notification/event-log',
  notification_platform_settings: 'notification/settings',
  notification_tenant_settings: 'notification/settings',
  official_result_audit: 'audit',
  historic_prediction_audit: 'audit',
  tenant_bonus_answer_audit: 'audit',
}

const args = new Set(process.argv.slice(2))
const outputJson = args.has('--json')
const includeFiles = args.has('--files')

function walkFiles(startDir, extensions = null) {
  if (!existsSync(startDir)) return []

  const files = []
  const stack = [startDir]

  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue

      const path = join(dir, entry)
      const stats = statSync(path)

      if (stats.isDirectory()) {
        stack.push(path)
        continue
      }

      if (!extensions || extensions.has(extname(path))) {
        files.push(path)
      }
    }
  }

  return files.sort()
}

function relativePath(path) {
  return relative(ROOT_DIR, path)
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split('\n').length
}

function pushReference(map, key, file, index, kind) {
  const refs = map.get(key) || []
  refs.push({
    file: relativePath(file),
    line: lineNumberForIndex(readFileSync(file, 'utf8'), index),
    kind,
  })
  map.set(key, refs)
}

function uniqueRefs(refs) {
  const seen = new Set()
  return refs.filter((ref) => {
    const key = `${ref.file}:${ref.line}:${ref.kind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function countByRoot(refs) {
  return refs.reduce(
    (counts, ref) => {
      const root = ref.file.split('/')[0]
      if (root === 'app') counts.app += 1
      else if (root === 'components') counts.components += 1
      else if (root === 'utils') counts.utils += 1
      else if (root === 'scripts') counts.scripts += 1
      else counts.other += 1
      return counts
    },
    { app: 0, components: 0, utils: 0, scripts: 0, other: 0 }
  )
}

function recommendationFor(tableName, runtimeRefCount, sqlInternalRefCount, dropped) {
  const classification = TABLE_CLASSIFICATION[tableName] || 'uncategorized'

  if (dropped) return 'already dropped in migrations'
  if (classification.includes('audit')) return 'keep with retention or archive policy'
  if (classification.includes('event-log')) return 'keep with retention policy'
  if (classification.includes('cache') || classification.includes('derived')) {
    return 'keep while app reads it; candidate for rebuild/materialized view later'
  }
  if (runtimeRefCount > 0) return 'keep; used by application code'
  if (sqlInternalRefCount > 0) return 'review carefully; referenced by database functions/policies'
  return 'candidate for deeper production-data review'
}

const migrationFiles = walkFiles(MIGRATIONS_DIR, new Set(['.sql']))
const createdTables = new Map()
const alteredTables = new Map()
const droppedTables = new Map()
const sqlInternalRefs = new Map()

for (const file of migrationFiles) {
  const source = readFileSync(file, 'utf8')

  for (const match of source.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)) {
    const tableName = match[1]
    if (!createdTables.has(tableName)) {
      createdTables.set(tableName, {
        file: relativePath(file),
        line: lineNumberForIndex(source, match.index || 0),
      })
    }
  }

  for (const match of source.matchAll(/\balter\s+table\s+public\.([a-zA-Z0-9_]+)/gi)) {
    const tableName = match[1]
    const refs = alteredTables.get(tableName) || []
    refs.push({
      file: relativePath(file),
      line: lineNumberForIndex(source, match.index || 0),
    })
    alteredTables.set(tableName, refs)
  }

  for (const match of source.matchAll(/\bdrop\s+table\s+(?:if\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)) {
    const tableName = match[1]
    droppedTables.set(tableName, {
      file: relativePath(file),
      line: lineNumberForIndex(source, match.index || 0),
    })
  }

  for (const match of source.matchAll(/\bpublic\.([a-zA-Z0-9_]+)/g)) {
    const tableName = match[1]
    const refs = sqlInternalRefs.get(tableName) || []
    refs.push({
      file: relativePath(file),
      line: lineNumberForIndex(source, match.index || 0),
    })
    sqlInternalRefs.set(tableName, refs)
  }
}

const runtimeRefs = new Map()
const rpcRefs = new Map()
const codeFiles = CODE_ROOTS.flatMap((root) => walkFiles(join(ROOT_DIR, root), CODE_EXTENSIONS))

for (const file of codeFiles) {
  const source = readFileSync(file, 'utf8')

  for (const match of source.matchAll(/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g)) {
    pushReference(runtimeRefs, match[1], file, match.index || 0, 'supabase.from')
  }

  for (const match of source.matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)) {
    pushReference(rpcRefs, match[1], file, match.index || 0, 'supabase.rpc')
  }
}

for (const [tableName, refs] of runtimeRefs.entries()) {
  runtimeRefs.set(tableName, uniqueRefs(refs))
}

for (const [functionName, refs] of rpcRefs.entries()) {
  rpcRefs.set(functionName, uniqueRefs(refs))
}

const tableNames = [...new Set([...createdTables.keys(), ...alteredTables.keys(), ...runtimeRefs.keys()])].sort()

const rows = tableNames.map((tableName) => {
  const runtime = runtimeRefs.get(tableName) || []
  const sqlRefs = sqlInternalRefs.get(tableName) || []
  const counts = countByRoot(runtime)
  const dropped = droppedTables.has(tableName)

  return {
    table: tableName,
    classification: TABLE_CLASSIFICATION[tableName] || 'uncategorized',
    createdIn: createdTables.get(tableName) || null,
    alteredCount: alteredTables.get(tableName)?.length || 0,
    droppedIn: droppedTables.get(tableName) || null,
    runtimeReferenceCount: runtime.length,
    runtimeReferencesByRoot: counts,
    sqlInternalReferenceCount: sqlRefs.length,
    recommendation: recommendationFor(tableName, runtime.length, sqlRefs.length, dropped),
    runtimeReferences: includeFiles ? runtime : undefined,
  }
})

const report = {
  generatedAt: new Date().toISOString(),
  tableCount: rows.filter((row) => !row.droppedIn).length,
  droppedTableCount: rows.filter((row) => row.droppedIn).length,
  tables: rows,
  rpcReferences: [...rpcRefs.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([functionName, refs]) => ({
      functionName,
      referenceCount: refs.length,
      references: includeFiles ? refs : undefined,
    })),
}

function renderMarkdown() {
  const currentRows = rows.filter((row) => !row.droppedIn)
  const noRuntimeRefs = currentRows.filter((row) => row.runtimeReferenceCount === 0)

  console.log('# Schema Usage Audit')
  console.log('')
  console.log(`Generated: ${report.generatedAt}`)
  console.log(`Current tables found in migrations: ${report.tableCount}`)
  console.log('')
  console.log('## Table Inventory')
  console.log('')
  console.log('| table | class | app refs | util refs | script refs | sql refs | recommendation |')
  console.log('| --- | --- | ---: | ---: | ---: | ---: | --- |')

  for (const row of currentRows) {
    console.log(
      `| ${row.table} | ${row.classification} | ${row.runtimeReferencesByRoot.app + row.runtimeReferencesByRoot.components} | ${row.runtimeReferencesByRoot.utils} | ${row.runtimeReferencesByRoot.scripts} | ${row.sqlInternalReferenceCount} | ${row.recommendation} |`
    )
  }

  if (noRuntimeRefs.length > 0) {
    console.log('')
    console.log('## No Direct Application References')
    console.log('')
    for (const row of noRuntimeRefs) {
      console.log(`- ${row.table}: ${row.recommendation}`)
    }
  }

  if (report.rpcReferences.length > 0) {
    console.log('')
    console.log('## RPC Functions Called By Code')
    console.log('')
    for (const rpc of report.rpcReferences) {
      console.log(`- ${rpc.functionName}: ${rpc.referenceCount} reference${rpc.referenceCount === 1 ? '' : 's'}`)
    }
  }

  if (includeFiles) {
    console.log('')
    console.log('## Runtime Reference Files')
    for (const row of currentRows.filter((item) => item.runtimeReferences?.length)) {
      console.log('')
      console.log(`### ${row.table}`)
      for (const ref of row.runtimeReferences) {
        console.log(`- ${ref.file}:${ref.line} (${ref.kind})`)
      }
    }
  }
}

if (outputJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  renderMarkdown()
}
