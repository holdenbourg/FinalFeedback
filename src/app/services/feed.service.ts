import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { PostModelWithAuthor } from '../models/database-models/post-model';

@Injectable({ providedIn: 'root' })
export class FeedService {

  ///  Home feed: posts from people the user follows (NOT including their own posts),
  ///  excluding posts they've already liked or seen.
  async getFollowersFeed(userId: string, limit = 20, offset = 0): Promise<PostModelWithAuthor[]> {
    // 1) Who the current user follows
    const { data: follows, error: fErr } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);

    if (fErr) {
      console.error('FeedService.getFollowersFeed: follows error', fErr);
      throw fErr;
    }

    let authorIds = (follows ?? []).map(f => f.followee_id as string);

    // Don't include the user themselves - they shouldn't see their own posts in feed
    // (Users can see their own posts on their profile page instead)

    // If somehow we still have nobody, bail early
    if (!authorIds.length) return [];

    // 2) Posts this user has liked (for filtering out of feed)
    const { data: likedRows, error: lErr } = await supabase
      .from('likes')
      .select('target_id')
      .eq('user_id', userId)
      .eq('target_type', 'post');

    if (lErr) {
      console.error('FeedService.getFollowersFeed: likes error', lErr);
      throw lErr;
    }

    const likedIds = (likedRows ?? []).map(r => r.target_id as string);

    // 3) Posts this user has already viewed
    const { data: seenRows, error: sErr } = await supabase
      .from('views')
      .select('target_id')
      .eq('user_id', userId)
      .eq('target_type', 'post');

    if (sErr) {
      console.error('FeedService.getFollowersFeed: views error', sErr);
      throw sErr;
    }

    const seenIds = (seenRows ?? []).map(r => r.target_id as string);

    // 4) Base posts query
    let query = supabase
      .from('posts')
      .select(`
        *,
        author:users!posts_author_id_fkey (
          username,
          profile_picture_url
        ),
        rating:ratings!posts_rating_id_fkey (
          id,
          criteria,
          media_type,
          title
        )
      `)
      .eq('visibility', 'public')
      .in('author_id', authorIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 5) Exclude posts the user has liked / seen
    if (likedIds.length > 0) {
      const likedList = '(' + likedIds.map(id => `"${id}"`).join(',') + ')';
      query = query.not('id', 'in', likedList);
    }

    if (seenIds.length > 0) {
      const seenList = '(' + seenIds.map(id => `"${id}"`).join(',') + ')';
      query = query.not('id', 'in', seenList);
    }

    const { data, error } = await query;

    if (error) {
      console.error('FeedService.getFollowersFeed: posts error', error);
      throw error;
    }

    return (data ?? []) as PostModelWithAuthor[];
  }

  ///  Memory lane: posts the user has previously liked (reverse chrono).
  async getMemoryLane(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<PostModelWithAuthor[]> {

    // 1) All post IDs the user has liked
    const { data: likedRows, error: lErr } = await supabase
      .from('likes')
      .select('target_id')
      .eq('user_id', userId)
      .eq('target_type', 'post');

    if (lErr) {
      console.error('FeedService.getMemoryLane: likes error', lErr);
      throw lErr;
    }

    const likedIds = (likedRows ?? []).map(r => r.target_id as string);

    if (!likedIds.length) {
      // nothing liked yet → empty memory lane
      return [];
    }

    // 2) Fetch those posts
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:users!posts_author_id_fkey (
          username,
          profile_picture_url
        )
      `)
      .in('id', likedIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('FeedService.getMemoryLane: posts error', error);
      throw error;
    }

    return (data ?? []) as PostModelWithAuthor[];
  }
}