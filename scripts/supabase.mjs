// Runs a Supabase CLI command against the hosted DB over the IPv4 session pooler
// (the direct db.<ref>.supabase.co host is IPv6-only). Usage: node --env-file=.env.local scripts/supabase.mjs db push
import { spawnSync } from 'node:child_process';

// The project URL under either name: SUPABASE_URL (backend/web) or the mobile app's EXPO_PUBLIC_SUPABASE_URL.
const { SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD } = process.env;
if (!SUPABASE_DB_PASSWORD) throw new Error('Missing SUPABASE_DB_PASSWORD in .env.local');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL in .env.local');
const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
// Project region is eu-west-1.
const url = `postgresql://postgres.${ref}:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

// Pinned: this process holds the DB password, so don't run whatever `latest` points to today. Bump on purpose.
const args = ['-y', 'supabase@3.0.0', ...process.argv.slice(2), `--remote=${url}`].map((a) => `"${a}"`);
process.exit(spawnSync('npx', args, { stdio: 'inherit', shell: true }).status ?? 1);
