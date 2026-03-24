import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function seed() {
  console.log('Seeding F1 2026 Reference Data...')

  // Constructors
  const constructors = [
    { name: 'Red Bull Racing', short_code: 'RBR' },
    { name: 'Ferrari', short_code: 'FER' },
    { name: 'McLaren', short_code: 'MCL' },
    { name: 'Mercedes', short_code: 'MER' },
    { name: 'Aston Martin', short_code: 'AST' },
    { name: 'RB', short_code: 'RB' }, // Or Racing Bulls
    { name: 'Haas', short_code: 'HAA' },
    { name: 'Williams', short_code: 'WIL' },
    { name: 'Alpine', short_code: 'ALP' },
    { name: 'Audi', short_code: 'AUD' }, // 2026 new entry
  ]

  for (const c of constructors) {
    const { data: existing } = await supabase.from('constructors').select('*').eq('name', c.name).maybeSingle()
    if (!existing) {
      await supabase.from('constructors').insert({ name: c.name, short_code: c.short_code })
    } else {
      await supabase.from('constructors').update({ short_code: c.short_code }).eq('name', c.name)
    }
  }
  
  // Re-fetch constructors to get their UUIDs
  const { data: cData } = await supabase.from('constructors').select('*')
  const cMap = {}
  cData.forEach(c => { cMap[c.short_code] = c.id })

  // Disable old drivers not in 2026
  await supabase.from('drivers').update({ active: false }).neq('code', '')

  // 2025/2026 Drivers
  const drivers = [
    { code: 'VER', full_name: 'Max Verstappen', team: 'RBR', emoji: '🇳🇱' },
    { code: 'HAD', full_name: 'Isack Hadjar', team: 'RBR', emoji: '🇫🇷' }, // Example for RBR second seat
    { code: 'LEC', full_name: 'Charles Leclerc', team: 'FER', emoji: '🇲🇨' },
    { code: 'HAM', full_name: 'Lewis Hamilton', team: 'FER', emoji: '🇬🇧' },
    { code: 'NOR', full_name: 'Lando Norris', team: 'MCL', emoji: '🇬🇧' },
    { code: 'PIA', full_name: 'Oscar Piastri', team: 'MCL', emoji: '🇦🇺' },
    { code: 'RUS', full_name: 'George Russell', team: 'MER', emoji: '🇬🇧' },
    { code: 'ANT', full_name: 'Andrea Kimi Antonelli', team: 'MER', emoji: '🇮🇹' },
    { code: 'ALO', full_name: 'Fernando Alonso', team: 'AST', emoji: '🇪🇸' },
    { code: 'STR', full_name: 'Lance Stroll', team: 'AST', emoji: '🇨🇦' },
    { code: 'TSU', full_name: 'Yuki Tsunoda', team: 'RB', emoji: '🇯🇵' },
    { code: 'LAW', full_name: 'Liam Lawson', team: 'RB', emoji: '🇳🇿' },
    { code: 'OCO', full_name: 'Esteban Ocon', team: 'HAA', emoji: '🇫🇷' },
    { code: 'BEA', full_name: 'Oliver Bearman', team: 'HAA', emoji: '🇬🇧' },
    { code: 'ALB', full_name: 'Alexander Albon', team: 'WIL', emoji: '🇹🇭' },
    { code: 'SAI', full_name: 'Carlos Sainz', team: 'WIL', emoji: '🇪🇸' },
    { code: 'GAS', full_name: 'Pierre Gasly', team: 'ALP', emoji: '🇫🇷' },
    { code: 'DOO', full_name: 'Jack Doohan', team: 'ALP', emoji: '🇦🇺' },
    { code: 'HUL', full_name: 'Nico Hulkenberg', team: 'AUD', emoji: '🇩🇪' },
    { code: 'BOR', full_name: 'Gabriel Bortoleto', team: 'AUD', emoji: '🇧🇷' },
    // A couple extra in case
    { code: 'PER', full_name: 'Sergio Perez', team: 'RBR', emoji: '🇲🇽' },
    { code: 'COL', full_name: 'Franco Colapinto', team: 'RB', emoji: '🇦🇷' },
  ]

  for (const d of drivers) {
    if (!cMap[d.team]) {
        console.warn(`Skipping ${d.full_name}, team ${d.team} not found.`);
        continue;
    }
    const { data: existing } = await supabase.from('drivers').select('*').eq('code', d.code).maybeSingle()
    if (!existing) {
       await supabase.from('drivers').insert({
         constructor_id: cMap[d.team],
         code: d.code,
         full_name: d.full_name,
         emoji: d.emoji,
         active: true
       })
    } else {
       await supabase.from('drivers').update({
         constructor_id: cMap[d.team],
         full_name: d.full_name,
         emoji: d.emoji,
         active: true
       }).eq('code', d.code)
    }
  }

  console.log(`Successfully seeded 2026 constructors and drivers!`)
}

seed()
