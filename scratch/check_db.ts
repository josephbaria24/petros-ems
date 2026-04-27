import { createClient } from '@supabase/supabase-js'

// Using process.env directly. 
// Run with: npx tsx --env-file=.env.local scratch/check_db.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkLatestTrainings() {
  const { data, error } = await supabase
    .from('trainings')
    .select('id, first_name, last_name, id_picture_url, picture_2x2_url, custom_data')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Latest Trainings:', JSON.stringify(data, null, 2))
  }
}

checkLatestTrainings()
