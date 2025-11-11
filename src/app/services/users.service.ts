import { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabase.client';
import { Injectable } from '@angular/core';
import { UserModel } from '../models/database-models/user-model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private static readonly USER_COLS = 
    `id, username, first_name, last_name, bio, profile_picture_url,
    private, post_count, follower_count, following_count, created_at, updated_at`;

  private normalizeHandle(u?: string): string {
    return String(u ?? '').trim().replace(/^@/, '').toLowerCase();
  }

  ///  Get Supabase Auth user   \\\
  async getCurrentAuthUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Error fetching auth user:', error.message);
      return null;
    }

    return data?.user ?? null;
  }

  ///  Get current user id from auth  \\\
  async getCurrentUserId(): Promise<string | null> {
    const authUser = await this.getCurrentAuthUser();

    return authUser?.id ?? null;
  }

  ///  Get current user profile from public.users  \\\
  async getCurrentUserProfile(): Promise<UserModel | null> {
    const authUser = await this.getCurrentAuthUser();
    if (!authUser) return null;

    const { data, error } = await supabase
      .from('users')
      .select(UsersService.USER_COLS)
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error.message);
      return null;
    }

    return data as UserModel;
  }

  ///  Get user profile by UUID  \\\
  async getUserProfileById(id: string): Promise<UserModel | null> {
    const { data, error } = await supabase
      .from('users')
      .select(UsersService.USER_COLS)
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching user by id "${id}":`, error.message);
      return null;
    }

    return data as UserModel;
  }

  ///  Get user profile by username (case-insensitive)  \\\
  async getUserProfileByUsername(username: string): Promise<UserModel | null> {
    const handle = this.normalizeHandle(username);

    const { data, error } = await supabase
      .from('users')
      .select(UsersService.USER_COLS)
      .ilike('username', handle)
      .limit(1)
      .single();

    if (error) {
      console.error(`Error fetching user by username "${username}":`, error.message);
      return null;
    }

    return data as UserModel;
  }

  ///  Case-insensitive existence check for a username  \\\
  async usernameExistsCaseInsensitive(username: string): Promise<boolean> {
    const handle = this.normalizeHandle(username);
    if (!handle) return false;

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .ilike('username', handle)
      .limit(1);

    if (error) {
      console.error(`usernameExistsCaseInsensitive("${username}") error:`, error.message);
      return false;
    }

    return !!(data && data.length > 0);
  }

  ///  Return canonical-cased username for a case-insensitive query  \\\
  async getCanonicalUsername(username: string): Promise<string | null> {
    const handle = this.normalizeHandle(username);
    if (!handle) return null;

    const { data, error } = await supabase
      .from('users')
      .select('username')
      .ilike('username', handle)
      .limit(1);

    if (error) {
      console.error(`getCanonicalUsername("${username}") error:`, error.message);
      return null;
    }

    return data?.[0]?.username ?? null;
  }

  async searchUsersRpc(q: string, lim = 20, off = 0): Promise<UserModel[]> {
    const query = String(q ?? '').trim();
    if (!query) return [];

    const { data, error } = await supabase.rpc('search_users', { q: query, lim, off });
    if (error) {
      console.error('search_users RPC error:', error.message);
      return [];
    }
    return (data ?? []) as UserModel[];
  }
}