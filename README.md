# ChordSense : Piano Chord Detector

A real-time and audio-file chord detection app built with React, Web Audio API, and Tonal.js.

## Features

- **Live mic mode** : play a chord and see it identified in real time
- **File upload mode** : drag in an MP3/WAV/FLAC and get a full chord timeline
- **Piano keyboard** : visual display of detected notes
- **Key & BPM detection** (file mode)
- **Session saving** via Supabase
- **Chord history** with timestamps

## Quick start

```bash
npm install
cp .env.example .env.local
# fill in your Supabase credentials (optional — app works without them)
npm run dev
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your env vars in the Vercel dashboard under Project → Settings → Environment Variables.

## Supabase setup (optional)

Create a table called `sessions` in your Supabase project:

```sql
create table sessions (
  id uuid default gen_random_uuid() primary key,
  song_name text not null,
  chords jsonb,
  detected_key text,
  bpm integer,
  mode text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (optional but recommended)
alter table sessions enable row level security;
create policy "Public read/write" on sessions for all using (true);
```

Then add your project URL and anon key to `.env.local`.

## Tech stack

- React 18 + Vite
- Web Audio API (no backend needed for detection)
- Tonal.js (music theory : chord names, intervals)
- Supabase (session persistence)
- Vercel (hosting)

## How chord detection works

1. Audio is captured via `getUserMedia` (mic) or `decodeAudioData` (file)
2. FFT analysis finds frequency peaks across the piano range (27–4200 Hz)
3. Frequencies are mapped to pitch classes (C, C#, D…)
4. Tonal.js `Chord.detect()` matches the pitch classes to known chord types
5. In mic mode, a chord must be stable for 4 frames before displaying
