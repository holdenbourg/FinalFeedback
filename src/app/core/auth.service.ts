import { Injectable } from '@angular/core';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = supabase;

    ///  Sign up user  \\\
    async signUp(opts: {
        email: string; 
        password: string; 
        username: string;
        firstName?: string; 
        lastName?: string;
    }) {
        const { data, error } = await this.supabase.auth.signUp({
            email: opts.email,
            password: opts.password,
            options: {
                data: {
                    username: opts.username,
                    first_name: opts.firstName ?? '',
                    last_name: opts.lastName ?? ''
                }
            }
        });
        if (error) throw error;

        ///  Fallback: ensure a profile row exists  \\\
        const user = data.user;
        if (user) {
            await this.supabase.from('users').upsert({
                id: user.id,
                username: opts.username,
                email: opts.email,
                first_name: opts.firstName ?? '',
                last_name: opts.lastName ?? '',
            }, 
            { 
                onConflict: 'id' 
            });
        }

        return data.user;
    }

  ///  Sign in user  \\\
  async signInWithUsernameOrEmail(identifier: string, password: string) {
    ///  Try email first  \\\
    let { data, error } = await this.supabase.auth.signInWithPassword({
      email: identifier,
      password
    });

    ///  If no match, try username  \\\
    if (error && error.message.includes('Invalid login credentials')) {
      const { data: userRow } = await this.supabase
        .from('users')
        .select('email')
        .eq('username', identifier)
        .maybeSingle();

      if (userRow?.email) {
        ({ data, error } = await this.supabase.auth.signInWithPassword({
          email: userRow.email,
          password
        }));
      }
    }

    if (error) throw error;
    return data;
  }

  ///  Check if email exists  \\\
  async emailExists(email: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return !!data && !error;
  }

  ///  Check if username exists  \\\
  async usernameExists(username: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    return !!data && !error;
  }

  ///  Sign out user  \\\
  async signOut() {
    await this.supabase.auth.signOut();
  }

  ///  Get currently logged-in user  \\\
  async getCurrentUser() {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }
}