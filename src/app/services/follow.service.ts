// src/app/services/follows.service.ts

import { inject, Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/database-models/notification.model';

@Injectable({ providedIn: 'root' })
export class FollowsService {
  private notificationsService = inject(NotificationsService);
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
      // Private account - create follow request (ignore if already requested)
      const { error } = await supabase
        .from('follow_requests')
        .upsert(
          { requester_id: user.id, target_id: targetId },
          { onConflict: 'requester_id,target_id', ignoreDuplicates: true }
        );

      if (error) throw error;

      this.notificationsService.create({
        recipientId: targetId,
        type: NotificationType.REQUESTED_FOLLOW,
      }).catch(() => {});
    } else {
      // Public account - follow immediately (ignore if already following)
      const { error } = await supabase
        .from('follows')
        .upsert(
          { follower_id: user.id, followee_id: targetId },
          { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }
        );

      if (error) throw error;

      this.notificationsService.create({
        recipientId: targetId,
        type: NotificationType.STARTED_FOLLOWING,
      }).catch(() => {});
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

    this.notificationsService.create({
      recipientId: requesterId,
      type: NotificationType.ACCEPTED_FOLLOW_REQUEST,
    }).catch(() => {});
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
   * Batch check: which of the candidate IDs does the follower already follow?
   */
  async getFollowingSet(followerId: string, candidateIds: string[]): Promise<Set<string>> {
    if (!candidateIds.length) return new Set();
    const { data, error } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', followerId)
      .in('followee_id', candidateIds);
    if (error) { console.error('getFollowingSet error:', error); return new Set(); }
    return new Set((data ?? []).map(r => r.followee_id as string));
  }

  /**
   * Batch check: which of the candidate IDs has the requester sent a pending request to?
   */
  async getRequestedSet(requesterId: string, candidateIds: string[]): Promise<Set<string>> {
    if (!candidateIds.length) return new Set();
    const { data, error } = await supabase
      .from('follow_requests')
      .select('target_id')
      .eq('requester_id', requesterId)
      .in('target_id', candidateIds);
    if (error) { console.error('getRequestedSet error:', error); return new Set(); }
    return new Set((data ?? []).map(r => r.target_id as string));
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