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
  console.log('Seeding F1 2024 Reference Data...')

  // Constructors
  const constructors = [
    { name: 'Red Bull Racing', short_code: 'RBR' },
    { name: 'Ferrari', short_code: 'FER' },
    { name: 'McLaren', short_code: 'MCL' },
    { name: 'Mercedes', short_code: 'MER' },
    { name: 'Aston Martin', short_code: 'AST' },
    { name: 'RB', short_code: 'RB' },
    { name: 'Haas', short_code: 'HAA' },
    { name: 'Williams', short_code: 'WIL' },
    { name: 'Alpine', short_code: 'ALP' },
    { name: 'Kick Sauber', short_code: 'SAU' },
  ]

  for (const c of constructors) {
    const { data: existing } = await supabase.from('constructors').select('*').eq('name', c.name).maybeSingle()
    if (!existing) {
      await supabase.from('constructors').insert({ name: c.name, short_code: c.short_code })
    }
  }
  
  // Re-fetch constructors to get their UUIDs
  const { data: cData } = await supabase.from('constructors').select('*')
  const cMap = {}
  cData.forEach(c => { cMap[c.short_code] = c.id })

  // Drivers
  const drivers = [
    { code: 'VER', full_name: 'Max Verstappen', team: 'RBR', emoji: '🇳🇱' },
    { code: 'PER', full_name: 'Sergio Perez', team: 'RBR', emoji: '🇲🇽' },
    { code: 'LEC', full_name: 'Charles Leclerc', team: 'FER', emoji: '🇲🇨' },
    { code: 'SAI', full_name: 'Carlos Sainz', team: 'FER', emoji: '🇪🇸' },
    { code: 'NOR', full_name: 'Lando Norris', team: 'MCL', emoji: '🇬🇧' },
    { code: 'PIA', full_name: 'Oscar Piastri', team: 'MCL', emoji: '🇦🇺' },
    { code: 'HAM', full_name: 'Lewis Hamilton', team: 'MER', emoji: '🇬🇧' },
    { code: 'RUS', full_name: 'George Russell', team: 'MER', emoji: '🇬🇧' },
    { code: 'ALO', full_name: 'Fernando Alonso', team: 'AST', emoji: '🇪🇸' },
    { code: 'STR', full_name: 'Lance Stroll', team: 'AST', emoji: '🇨🇦' },
    { code: 'TSU', full_name: 'Yuki Tsunoda', team: 'RB', emoji: '🇯🇵' },
    { code: 'RIC', full_name: 'Daniel Ricciardo', team: 'RB', emoji: '🇦🇺' },
    { code: 'LAW', full_name: 'Liam Lawson', team: 'RB', emoji: '🇳🇿' },
    { code: 'HUL', full_name: 'Nico Hulkenberg', team: 'HAA', emoji: '🇩🇪' },
    { code: 'MAG', full_name: 'Kevin Magnussen', team: 'HAA', emoji: '🇩🇰' },
    { code: 'BEA', full_name: 'Oliver Bearman', team: 'HAA', emoji: '🇬🇧' },
    { code: 'ALB', full_name: 'Alexander Albon', team: 'WIL', emoji: '🇹🇭' },
    { code: 'SAR', full_name: 'Logan Sargeant', team: 'WIL', emoji: '🇺🇸' },
    { code: 'COL', full_name: 'Franco Colapinto', team: 'WIL', emoji: '🇦🇷' },
    { code: 'GAS', full_name: 'Pierre Gasly', team: 'ALP', emoji: '🇫🇷' },
    { code: 'OCO', full_name: 'Esteban Ocon', team: 'ALP', emoji: '🇫🇷' },
    { code: 'BOT', full_name: 'Valtteri Bottas', team: 'SAU', emoji: '🇫🇮' },
    { code: 'ZHO', full_name: 'Zhou Guanyu', team: 'SAU', emoji: '🇨🇳' },
  ]

  for (const d of drivers) {
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

  console.log(`Successfully seeded constructors and drivers!`)
}

seed()
