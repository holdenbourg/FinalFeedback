import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
 
declare global {
  interface Window { __supabase?: SupabaseClient }
}

const { url, anonKey } = environment.supabase;

const noOpLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

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
              lock: noOpLock,
            },
          }))
        : createClient(url, anonKey, {
            auth: {
              persistSession: true,
              storage: localStorage,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              lock: noOpLock,
            },
          }));