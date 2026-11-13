import { supabaseEnv } from './supabase';

// Same build as production; the Supabase project comes from the staging deploy's own environment variables.
export const environment = { name: 'staging', production: true, supabase: supabaseEnv };
