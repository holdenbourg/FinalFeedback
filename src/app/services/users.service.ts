import { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabase.client';
import { Injectable } from '@angular/core';
import { UserModel } from '../models/database-models/user.model';
import { catchError, from, map, Observable, of } from 'rxjs';

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

  ///  Check if current user is blocked by a user  \\\
  async isBlocked(currentUser: string, user: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user)
        .eq('blocked_id', currentUser)
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

  ///  Check if a user is blocked by current user  \\\
  async isBlocker(currentUser: string, user: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', currentUser)
        .eq('blocked_id', user)
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
  async searchUsersExcludingBlockedAndSelf(q: string, currentUserId: string, lim = 20, off = 0): Promise<UserModel[]> {
    const query = String(q ?? '').trim();
    if (!query) return [];

    // Get all search results
    const allResults = await this.searchUsersRpc(q, lim, off);

    // Get blocked user IDs
    const blockedIds = await this.getBlockedUserIds(currentUserId);
    blockedIds.add(currentUserId);
    
    // Filter out blocked users
    return allResults.filter(user => !blockedIds.has(user.id));
  }

  /// -======================================-  Helper: Check OAuth User  -======================================- \\\
  /**
   * Check if current user is signed in via OAuth (Google, GitHub, etc.)
   */
  private async isOAuthUser(): Promise<{ isOAuth: boolean; provider?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isOAuth: false };

      // Use bracket notation to access providers from index signature
      const providers = user.app_metadata?.['providers'] as string[] || [];
      const oauthProviders = ['google', 'github', 'facebook', 'twitter', 'apple'];
      
      const oauthProvider = providers.find((p: string) => oauthProviders.includes(p));
      
      return {
        isOAuth: !!oauthProvider,
        provider: oauthProvider
      };
    } catch (err) {
      console.error('isOAuthUser error:', err);
      return { isOAuth: false };
    }
  }

  /// -======================================-  Profile Updates  -======================================- \\\

  /**
   * Update user profile information (username, name, bio)
   */
  async updateUserProfile(userId: string, updates: {
    username?: string;
    first_name?: string;
    last_name?: string;
    bio?: string;
    profile_picture_url?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // If updating username, check if it's already taken
      if (updates.username) {
        const normalized = this.normalizeHandle(updates.username);
        
        // Check if username is taken by another user
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .ilike('username', normalized)
          .neq('id', userId)
          .limit(1)
          .single();

        if (existingUser) {
          return { success: false, error: 'Username is already taken' };
        }

        // Normalize username before saving
        updates.username = normalized;
      }

      // Update the user profile
      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user profile:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('updateUserProfile exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Update user email (requires Supabase Auth update)
   * ⚠️ Cannot be used by OAuth users (Google, GitHub, etc.)
   */
  async updateUserEmail(newEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const addr = String(newEmail ?? '').trim().toLowerCase();
      if (!addr) {
        return { success: false, error: 'Email is required' };
      }

      // Check if user is OAuth user (cannot change email)
      const oauthCheck = await this.isOAuthUser();
      if (oauthCheck.isOAuth) {
        return { 
          success: false, 
          error: `Cannot change email for accounts signed in with ${oauthCheck.provider}. Your email is managed by your OAuth provider.`
        };
      }

      // Check if email is already in use
      const emailExists = await this.emailExistsCaseInsensitive(addr);
      if (emailExists) {
        return { success: false, error: 'Email is already in use' };
      }

      // Update auth email (sends confirmation email)
      const { error: authError } = await supabase.auth.updateUser({
        email: addr
      });

      if (authError) {
        console.error('Error updating email:', authError.message);
        return { success: false, error: authError.message };
      }

      // Update public.users table (may be handled by trigger)
      const authUser = await this.getCurrentAuthUser();
      if (authUser) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ 
            email: addr, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', authUser.id);

        if (dbError) {
          console.error('Error updating email in database:', dbError.message);
        }
      }

      return { 
        success: true,
        error: 'Email update initiated. Please check your new email for confirmation.'
      };
    } catch (err) {
      console.error('updateUserEmail exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Update user password (requires Supabase Auth update)
   * ⚠️ Cannot be used by OAuth users (Google, GitHub, etc.)
   */
  async updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Check if user is OAuth user (cannot set password)
      const oauthCheck = await this.isOAuthUser();
      if (oauthCheck.isOAuth) {
        return { 
          success: false, 
          error: `Cannot set password for accounts signed in with ${oauthCheck.provider}. Your authentication is managed by your OAuth provider.`
        };
      }

      // Update auth password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Error updating password:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('updateUserPassword exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Toggle account privacy setting
   */
  async updateAccountPrivacy(userId: string, isPrivate: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      // ✅ Step 1: Update privacy setting
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          private: isPrivate,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating privacy:', updateError.message);
        return { success: false, error: updateError.message };
      }

      if (!isPrivate) {
        console.log('[UsersService] Switching to public - accepting all pending requests');
        
        // Get all pending requests for this user
        const { data: requests, error: fetchError } = await supabase
          .from('follow_requests')
          .select('requester_id')
          .eq('target_id', userId);

        if (fetchError) {
          console.error('Error fetching pending requests:', fetchError);
          // Don't fail the entire operation, just log
        } else if (requests && requests.length > 0) {
          console.log(`[UsersService] Found ${requests.length} pending requests to accept`);

          // Create follows for all requesters
          const followsToInsert = requests.map(req => ({
            follower_id: req.requester_id,
            followee_id: userId
          }));

          const { error: followsError } = await supabase
            .from('follows')
            .insert(followsToInsert);

          if (followsError) {
            console.error('Error inserting follows:', followsError);
            // Don't fail - they can manually accept later
          } else {
            console.log(`[UsersService] Created ${followsToInsert.length} follows`);
          }

          // Delete all the requests
          const { error: deleteError } = await supabase
            .from('follow_requests')
            .delete()
            .eq('target_id', userId);

          if (deleteError) {
            console.error('Error deleting requests:', deleteError);
            // Don't fail - requests will just remain
          } else {
            console.log(`[UsersService] Deleted ${requests.length} follow requests`);
          }
        } else {
          console.log('[UsersService] No pending requests to accept');
        }
      }

      return { success: true };
    } catch (err) {
      console.error('updateAccountPrivacy exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return { success: false, error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP).' };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return { success: false, error: 'File too large. Maximum size is 5MB.' };
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading profile picture:', uploadError.message);
        return { success: false, error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return { success: false, error: 'Failed to get public URL' };
      }

      // Update user profile with new picture URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_picture_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile picture URL:', updateError.message);
        return { success: false, error: updateError.message };
      }

      return { success: true, url: urlData.publicUrl };
    } catch (err) {
      console.error('uploadProfilePicture exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  
  /// -======================================-  Block/Unblock Users  -======================================- \\\

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if already blocked
      const { data: existing } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .single();

      if (existing) {
        return { success: false, error: 'User is already blocked' };
      }

      // Insert block record
      const { error } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error blocking user:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('blockUser exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (error) {
        console.error('Error unblocking user:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('unblockUser exception:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get list of users that current user has blocked
   */
  async getBlockedUsers(userId: string): Promise<UserModel[]> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select(`
          blocked_id,
          blocked_user:users!blocked_id (
            ${UsersService.USER_COLS}
          )
        `)
        .eq('blocker_id', userId);

      if (error) {
        console.error('Error fetching blocked users:', error.message);
        return [];
      }

      if (!data) return [];

      // Extract user objects from the join and filter out nulls
      return data
        .map((block: any) => block.blocked_user)
        .filter((user: any) => user !== null) as UserModel[];
    } catch (err) {
      console.error('getBlockedUsers exception:', err);
      return [];
    }
  }

  async deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        return { 
          success: false, 
          error: 'You can only delete your own account' 
        };
      }

      const { error } = await supabase.rpc('delete_user_account_cascade', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error deleting user account:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('deleteUserAccount exception:', err);
      return { 
        success: false, 
        error: 'An unexpected error occurred while deleting account' 
      };
    }
  }

  async getFollowers(): Promise<any[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('followers')
      .select(`
        follower:users!followers_follower_id_fkey (
          id,
          username,
          profile_picture_url
        )
      `)
      .eq('followed_id', user.id);

    if (error) throw error;
    return (data || []).map((f: any) => f.follower);
  }

  async getFollowing(): Promise<any[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('followers')
      .select(`
        followed:users!followers_followed_id_fkey (
          id,
          username,
          profile_picture_url
        )
      `)
      .eq('follower_id', user.id);

    if (error) throw error;
    return (data || []).map((f: any) => f.followed);
  }
}