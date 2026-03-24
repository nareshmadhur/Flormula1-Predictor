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
  console.log('Seeding Official F1 2026 Reference Data...')

  // Constructors (11 Teams!)
  const constructors = [
    { name: 'Red Bull Racing', short_code: 'RBR' },
    { name: 'Ferrari', short_code: 'FER' },
    { name: 'McLaren', short_code: 'MCL' },
    { name: 'Mercedes', short_code: 'MER' },
    { name: 'Aston Martin', short_code: 'AST' },
    { name: 'Racing Bulls', short_code: 'RB' }, // Formerly AlphaTauri/RB
    { name: 'Haas F1 Team', short_code: 'HAA' },
    { name: 'Williams', short_code: 'WIL' },
    { name: 'Alpine', short_code: 'ALP' },
    { name: 'Audi', short_code: 'AUD' }, // Replaced Sauber
    { name: 'Cadillac', short_code: 'CAD' }, // New 11th Team!
  ]

  for (const c of constructors) {
    const { data: existing } = await supabase.from('constructors').select('*').eq('name', c.name).maybeSingle()
    if (!existing) {
      await supabase.from('constructors').insert({ name: c.name, short_code: c.short_code })
    } else {
      await supabase.from('constructors').update({ short_code: c.short_code }).eq('name', c.name)
    }
  }
  
  // Re-fetch constructors
  const { data: cData } = await supabase.from('constructors').select('*')
  const cMap = {}
  cData.forEach(c => { cMap[c.name] = c.id })

  // Disable old drivers not in 2026
  await supabase.from('drivers').update({ active: false }).neq('code', '')

  // 2026 Official Drivers (22 Drivers)
  const drivers = [
    { code: 'VER', full_name: 'Max Verstappen', team: 'Red Bull Racing', emoji: '🇳🇱' },
    { code: 'HAD', full_name: 'Isack Hadjar', team: 'Red Bull Racing', emoji: '🇫🇷' },
    { code: 'LEC', full_name: 'Charles Leclerc', team: 'Ferrari', emoji: '🇲🇨' },
    { code: 'HAM', full_name: 'Lewis Hamilton', team: 'Ferrari', emoji: '🇬🇧' },
    { code: 'NOR', full_name: 'Lando Norris', team: 'McLaren', emoji: '🇬🇧' },
    { code: 'PIA', full_name: 'Oscar Piastri', team: 'McLaren', emoji: '🇦🇺' },
    { code: 'RUS', full_name: 'George Russell', team: 'Mercedes', emoji: '🇬🇧' },
    { code: 'ANT', full_name: 'Kimi Antonelli', team: 'Mercedes', emoji: '🇮🇹' },
    { code: 'ALO', full_name: 'Fernando Alonso', team: 'Aston Martin', emoji: '🇪🇸' },
    { code: 'STR', full_name: 'Lance Stroll', team: 'Aston Martin', emoji: '🇨🇦' },
    { code: 'LAW', full_name: 'Liam Lawson', team: 'Racing Bulls', emoji: '🇳🇿' },
    { code: 'LIN', full_name: 'Arvid Lindblad', team: 'Racing Bulls', emoji: '🇬🇧' },
    { code: 'OCO', full_name: 'Esteban Ocon', team: 'Haas F1 Team', emoji: '🇫🇷' },
    { code: 'BEA', full_name: 'Oliver Bearman', team: 'Haas F1 Team', emoji: '🇬🇧' },
    { code: 'ALB', full_name: 'Alexander Albon', team: 'Williams', emoji: '🇹🇭' },
    { code: 'SAI', full_name: 'Carlos Sainz', team: 'Williams', emoji: '🇪🇸' },
    { code: 'GAS', full_name: 'Pierre Gasly', team: 'Alpine', emoji: '🇫🇷' },
    { code: 'COL', full_name: 'Franco Colapinto', team: 'Alpine', emoji: '🇦🇷' },
    { code: 'HUL', full_name: 'Nico Hulkenberg', team: 'Audi', emoji: '🇩🇪' },
    { code: 'BOR', full_name: 'Gabriel Bortoleto', team: 'Audi', emoji: '🇧🇷' },
    { code: 'PER', full_name: 'Sergio Perez', team: 'Cadillac', emoji: '🇲🇽' },
    { code: 'BOT', full_name: 'Valtteri Bottas', team: 'Cadillac', emoji: '🇫🇮' },
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

  console.log(`Successfully seeded official 2026 constructors and drivers!`)
}

seed()
