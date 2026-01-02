// auth.service.ts
import { Injectable, inject } from '@angular/core';
import { supabase } from './supabase.client';
import { UsersService } from '../services/users.service';

export type RegisterInput = {
  email: string;
  password: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private usersService = inject(UsersService);

  /// -======================================-  Helpers  -======================================- \\\
  private isEmail(str: string) {
    return /\S+@\S+\.\S+/.test(str);
  }

  private normUsername(u: string) {
    return String(u ?? '').trim().replace(/^@/, '').toLowerCase();
  }

  ///  Resolve an identifier (email or username) to an email for password login  \\\
  private async resolveEmail(identifier: string): Promise<string> {
    const id = String(identifier ?? '').trim();
    if (!id) throw new Error('Missing email/username');

    // If it looks like an email, just normalize + use it
    if (this.isEmail(id)) return id.toLowerCase();

    // Otherwise treat it as a username and look up the profile
    const handle = this.normUsername(id);
    const user = await this.usersService.getUserProfileByUsername(handle);

    if (!user?.email) {
      throw new Error('No account found for that username.');
    }
    return String(user.email).toLowerCase();
  }

  
  /// -======================================-  Sign Up / Sign In / Sign Out  -======================================- \\\
  ///  Email + password registration. Password stays in Supabase Auth  \\\
  async registerWithEmail(input: RegisterInput) {
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const username = this.normUsername(input.username);

    // Light client-side checks (your stricter UI validators still run in the component)
    if (!this.isEmail(email)) throw new Error('Please enter a valid email.');
    if (username.length < 3) throw new Error('Username must be at least 3 characters.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // These become new.raw_user_meta_data in the signup trigger
        data: {
          username,
          first_name: input.first_name ?? null,
          last_name:  input.last_name  ?? null,
          avatar_url: input.avatar_url ?? null,
        },
        // If you use email confirmations, set your redirect URL:
        // emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /** Sign in with email or username + password */
  async signInWithIdentifier(identifier: string, password: string) {
    const email = await this.resolveEmail(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // If the user originally used Google and never set a password, this will fail.
    if (error) {
      const msg = /Invalid login credentials/i.test(error.message)
        ? 'Invalid credentials. If you signed up with Google, use “Continue with Google” or reset your password.'
        : error.message;
      throw new Error(msg);
    }
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  // ---------- Password reset helpers ----------
  /** Start a password reset by email or username */
  async sendPasswordReset(identifier: string) {
    const email = await this.resolveEmail(identifier);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      // emailRedirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  /** After redirect in a reset flow, update to a new password (user must be authed via reset session) */
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return data;
  }

  // ---------- OAuth helpers (used by login-register) ----------
  async signInWithGoogle(redirectTo: string) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async signInWithGitHub(redirectTo: string) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async signInWithFacebook(redirectTo: string) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    return data;
  }
}