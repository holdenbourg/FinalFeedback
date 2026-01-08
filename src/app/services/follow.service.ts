// src/app/services/follows.service.ts

import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class FollowsService {
  /**
   * Check if user1 is following user2 (accepted follow)
   */
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('followee_id', followeeId)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('isFollowing error:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('isFollowing exception:', err);
      return false;
    }
  }

  /**
   * Check if user has sent a follow request (pending in follow_requests table)
   */
  async hasRequestedToFollow(requesterId: string, targetId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('follow_requests')
        .select('requester_id')
        .eq('requester_id', requesterId)
        .eq('target_id', targetId)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('hasRequestedToFollow error:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('hasRequestedToFollow exception:', err);
      return false;
    }
  }

  /**
   * Follow a user
   * - Public accounts: Add directly to follows table
   * - Private accounts: Add to follow_requests table
   */
  async follow(targetId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    // Get target user to check if private
    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('private')
      .eq('id', targetId)
      .maybeSingle();

    if (userErr) throw userErr;

    if (targetUser?.private) {
      // Private account - create follow request
      const { error } = await supabase
        .from('follow_requests')
        .insert({
          requester_id: user.id,
          target_id: targetId
        });

      if (error) throw error;
    } else {
      // Public account - follow immediately
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          followee_id: targetId
        });

      if (error) throw error;
    }
  }

  /**
   * Unfollow a user (remove from follows table)
   */
  async unfollow(targetId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followee_id', targetId);

    if (error) throw error;
  }

  /**
   * Cancel a pending follow request (remove from follow_requests table)
   */
  async cancelRequest(targetId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', user.id)
      .eq('target_id', targetId);

    if (error) throw error;
  }

  /**
   * Accept a follow request
   * - Move from follow_requests to follows table
   */
  async acceptRequest(requesterId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    // Add to follows table
    const { error: followErr } = await supabase
      .from('follows')
      .insert({
        follower_id: requesterId,
        followee_id: user.id
      });

    if (followErr) throw followErr;

    // Remove from follow_requests table
    const { error: deleteErr } = await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', user.id);

    if (deleteErr) throw deleteErr;
  }

  /**
   * Reject a follow request (remove from follow_requests table)
   */
  async rejectRequest(requesterId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', user.id);

    if (error) throw error;
  }

  /**
   * Get follower count for a user
   */
  async getFollowerCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followee_id', userId);

    if (error) {
      console.error('getFollowerCount error:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get following count for a user (how many they follow)
   */
  async getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) {
      console.error('getFollowingCount error:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get pending follow request count (for current user)
   */
  async getPendingRequestCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('follow_requests')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', userId);

    if (error) {
      console.error('getPendingRequestCount error:', error);
      return 0;
    }

    return count || 0;
  }
}