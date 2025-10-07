import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

declare global {
  interface Window { __supabase?: SupabaseClient }
}

const { url, anonKey } = environment.supabase;

export const supabase =
  (typeof window !== 'undefined' && window.__supabase)
    ? window.__supabase!
    : (typeof window !== 'undefined'
        ? (window.__supabase = createClient(url, anonKey, {
            auth: {
              persistSession: true,
              storage: localStorage,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          }))
        : createClient(url, anonKey, {
            auth: {
              persistSession: true,
              storage: localStorage,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          }));