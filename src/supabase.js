import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase project credentials
// Add to .env.local: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Save a chord session to Supabase
export async function saveSession({ songName, chords, key, bpm, mode }) {
  if (!supabase) return { error: 'Supabase not configured' }
  const { data, error } = await supabase.from('sessions').insert([{
    song_name: songName,
    chords: chords, // JSON array
    detected_key: key,
    bpm,
    mode,
    created_at: new Date().toISOString()
  }]).select()
  return { data, error }
}

// Fetch saved sessions
export async function getSessions() {
  if (!supabase) return { data: [], error: null }
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data: data || [], error }
}

// Delete a session
export async function deleteSession(id) {
  if (!supabase) return { error: 'Supabase not configured' }
  return await supabase.from('sessions').delete().eq('id', id)
}
