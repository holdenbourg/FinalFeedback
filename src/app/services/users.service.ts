import { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabase.client';
import { Injectable } from '@angular/core';
import { UserModel } from '../models/database-models/user-model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private static readonly USER_COLS = `
    id,
    username,
    email,
    first_name,
    last_name,
    bio,
    profile_picture_url,
    private,
    post_count,
    follower_count,
    following_count,
    created_at,
    updated_at
  `;

  private normalizeHandle(u?: string): string {
    return String(u ?? '').trim().replace(/^@/, '').toLowerCase();
  }


  /// -======================================-  Auth Wrappers  -======================================- \\\
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


  /// -======================================-  Profile Queries  -======================================- \\\
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


  /// -======================================-  Existence Checks  -======================================- \\\
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
      console.error(`usernameExists("${username}") error:`, error.message);
      return false;
    }

    return !!data?.length;
  }

  ///  Case-insensitive existence check for an email  \\\
  async emailExistsCaseInsensitive(email: string): Promise<boolean> {
    const addr = String(email ?? '').trim().toLowerCase();
    if (!addr) return false;

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .ilike('email', addr)
      .limit(1);

    if (error) {
      console.error(`emailExists("${email}") error:`, error.message);
      return false;
    }

    return !!data?.length;
  }


  /// -======================================-  Block Checks  -======================================- \\\
  ///  Get all user IDs that current user has blocked or been blocked by  \\\
  async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const blockedIds = new Set<string>();

    try {
      // Get users current user has blocked
      const { data: blockedByMe, error: error1 } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error1) {
        console.error('Error fetching blocked users:', error1.message);
      } else if (blockedByMe) {
        blockedByMe.forEach(b => blockedIds.add(b.blocked_id));
      }

      // Get users who have blocked current user
      const { data: blockedMe, error: error2 } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocked_id', userId);

      if (error2) {
        console.error('Error fetching blocking users:', error2.message);
      } else if (blockedMe) {
        blockedMe.forEach(b => blockedIds.add(b.blocker_id));
      }
    } catch (err) {
      console.error('getBlockedUserIds error:', err);
    }

    return blockedIds;
  }

  ///  Check if there's a block relationship between two users (either direction)  \\\
  async isBlockedRelationship(userId1: string, userId2: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
        .limit(1);

      if (error) {
        console.error('isBlockedRelationship error:', error.message);
        return false;
      }

      return !!data?.length;
    } catch (err) {
      console.error('isBlockedRelationship error:', err);
      return false;
    }
  }


  /// -======================================-  Search RPC  -======================================- \\\
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

  ///  Search users excluding blocked relationships  \\\
  async searchUsersExcludingBlocked(q: string, currentUserId: string, lim = 20, off = 0): Promise<UserModel[]> {
    const query = String(q ?? '').trim();
    if (!query) return [];

    // Get all search results
    const allResults = await this.searchUsersRpc(q, lim, off);

    // Get blocked user IDs
    const blockedIds = await this.getBlockedUserIds(currentUserId);

    // Filter out blocked users
    return allResults.filter(user => !blockedIds.has(user.id));
  }
}