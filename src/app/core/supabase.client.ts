import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export let supabase: SupabaseClient = createClient(
  environment.supabase.url,
  environment.supabase.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true, storage: localStorage } }
);

export function setEphemeralSession() {
  supabase = createClient(
    environment.supabase.url,
    environment.supabase.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, storage: sessionStorage } }
  );
}

export function getSupabase() {
  return supabase;
}