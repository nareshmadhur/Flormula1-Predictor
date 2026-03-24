import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Service Role Key in .env.local');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const constructors = [
  { name: 'Red Bull Racing', short_code: 'RBR', emoji: '🐂' },
  { name: 'Ferrari', short_code: 'FER', emoji: '🐎' },
  { name: 'Mercedes', short_code: 'MER', emoji: '⭐' },
  { name: 'McLaren', short_code: 'MCL', emoji: '🟠' },
  { name: 'Aston Martin', short_code: 'AMR', emoji: '🟢' },
  { name: 'Alpine', short_code: 'ALP', emoji: '🏔️' },
  { name: 'Williams', short_code: 'WIL', emoji: '🔵' },
  { name: 'Visa Cash App RB', short_code: 'VCARB', emoji: '🏎️' },
  { name: 'Stake F1 Team Kick Sauber', short_code: 'SAU', emoji: '💚' },
  { name: 'Haas F1 Team', short_code: 'HAA', emoji: '⚪' },
];

const circuits = [
  { name: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir', emoji: '🇧🇭' },
  { name: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', city: 'Jeddah', emoji: '🇸🇦' },
  { name: 'Albert Park Circuit', country: 'Australia', city: 'Melbourne', emoji: '🇦🇺' },
  { name: 'Suzuka International Racing Course', country: 'Japan', city: 'Suzuka', emoji: '🇯🇵' },
  { name: 'Shanghai International Circuit', country: 'China', city: 'Shanghai', emoji: '🇨🇳' },
  { name: 'Miami International Autodrome', country: 'United States', city: 'Miami', emoji: '🇺🇸' },
  { name: 'Autodromo Enzo e Dino Ferrari', country: 'Italy', city: 'Imola', emoji: '🇮🇹' },
  { name: 'Circuit de Monaco', country: 'Monaco', city: 'Monte Carlo', emoji: '🇲🇨' },
  { name: 'Circuit Gilles-Villeneuve', country: 'Canada', city: 'Montreal', emoji: '🇨🇦' },
  { name: 'Circuit de Barcelona-Catalunya', country: 'Spain', city: 'Barcelona', emoji: '🇪🇸' },
  { name: 'Red Bull Ring', country: 'Austria', city: 'Spielberg', emoji: '🇦🇹' },
  { name: 'Silverstone Circuit', country: 'Great Britain', city: 'Silverstone', emoji: '🇬🇧' },
];

async function seed() {
  console.log('Seeding constructors...');
  const { data: insertedConstructors, error: cError } = await supabase
    .from('constructors')
    .insert(constructors)
    .select();
  
  if (cError) {
    console.error('Error inserting constructors:', cError);
    return;
  }

  const constructorMap = insertedConstructors.reduce((acc, c) => {
    acc[c.short_code] = c.id;
    return acc;
  }, {});

  const drivers = [
    { full_name: 'Max Verstappen', code: 'VER', constructor_id: constructorMap['RBR'], emoji: '🇳🇱' },
    { full_name: 'Sergio Perez', code: 'PER', constructor_id: constructorMap['RBR'], emoji: '🇲🇽' },
    { full_name: 'Charles Leclerc', code: 'LEC', constructor_id: constructorMap['FER'], emoji: '🇲🇨' },
    { full_name: 'Carlos Sainz', code: 'SAI', constructor_id: constructorMap['FER'], emoji: '🇪🇸' },
    { full_name: 'Lewis Hamilton', code: 'HAM', constructor_id: constructorMap['MER'], emoji: '🇬🇧' },
    { full_name: 'George Russell', code: 'RUS', constructor_id: constructorMap['MER'], emoji: '🇬🇧' },
    { full_name: 'Lando Norris', code: 'NOR', constructor_id: constructorMap['MCL'], emoji: '🇬🇧' },
    { full_name: 'Oscar Piastri', code: 'PIA', constructor_id: constructorMap['MCL'], emoji: '🇦🇺' },
    { full_name: 'Fernando Alonso', code: 'ALO', constructor_id: constructorMap['AMR'], emoji: '🇪🇸' },
    { full_name: 'Lance Stroll', code: 'STR', constructor_id: constructorMap['AMR'], emoji: '🇨🇦' },
  ];

  console.log('Seeding drivers...');
  const { error: dError } = await supabase
    .from('drivers')
    .insert(drivers);
    
  if (dError) {
    console.error('Error inserting drivers:', dError);
    return;
  }

  console.log('Seeding circuits...');
  const { error: circError } = await supabase
    .from('circuits')
    .insert(circuits);
    
  if (circError) {
    console.error('Error inserting circuits:', circError);
    return;
  }

  console.log('Seed completed successfully!');
}

seed();
