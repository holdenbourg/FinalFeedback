import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const { url, anonKey } = environment.supabase;

const noOpLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

// ✅ FIXED: Simplified single instance with explicit storage
function createSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side - no persistence
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // Client-side - with explicit localStorage
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      storage: window.localStorage,  // ✅ Explicit window.localStorage
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sb-auth-token',   // ✅ Custom key name
      lock: noOpLock,
    },
  });
}

// ✅ Export single instance
export const supabase = createSupabaseClient();