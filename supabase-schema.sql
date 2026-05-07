-- ============================================================
-- ChordSense — Supabase Database Schema
-- Run this in your Supabase project:
--   Dashboard → SQL Editor → New query → paste → Run
-- ============================================================


-- ── Sessions ────────────────────────────────────────────────
-- Stores each saved chord detection session (mic or file mode)

create table if not exists sessions (
  id           uuid        default gen_random_uuid() primary key,
  created_at   timestamptz default now() not null,

  -- What the user named this session
  song_name    text        not null,

  -- 'file' or 'mic'
  mode         text        check (mode in ('file', 'mic')),

  -- Detected key e.g. 'C', 'F#'
  detected_key text,

  -- Estimated BPM (file mode only)
  bpm          integer     check (bpm > 0 and bpm < 400),

  -- Full chord list as a JSON array of strings e.g. ["C", "Am", "F", "G"]
  chords       jsonb       default '[]'::jsonb,

  -- How many unique chords were found
  chord_count  integer     generated always as (jsonb_array_length(chords)) stored
);


-- ── Indexes ──────────────────────────────────────────────────

-- Fast lookup by creation time (most recent first)
create index if not exists sessions_created_at_idx
  on sessions (created_at desc);

-- Fast search by song name (case-insensitive prefix search)
create index if not exists sessions_song_name_idx
  on sessions using gin (to_tsvector('english', song_name));


-- ── Row Level Security ───────────────────────────────────────
-- Currently open (no auth). When you add Supabase Auth,
-- replace the policies below with user-scoped ones.

alter table sessions enable row level security;

-- Allow anyone to read all sessions
create policy "Public read"
  on sessions for select
  using (true);

-- Allow anyone to insert
create policy "Public insert"
  on sessions for insert
  with check (true);

-- Allow anyone to delete their own sessions
-- (tighten this once you add auth: using (auth.uid() = user_id))
create policy "Public delete"
  on sessions for delete
  using (true);


-- ── Optional: user_id column (add when you enable Supabase Auth) ──
-- alter table sessions add column if not exists
--   user_id uuid references auth.users(id) on delete cascade;
--
-- Then replace the policies above with:
-- create policy "Users manage own sessions"
--   on sessions for all
--   using  (auth.uid() = user_id)
--   with check (auth.uid() = user_id);


-- ============================================================
-- Done. Your sessions table is ready.
-- Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
-- ============================================================
