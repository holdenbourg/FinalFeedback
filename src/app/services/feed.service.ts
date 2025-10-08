import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { PostModelWithAuthor } from '../models/database-models/post-model';

@Injectable({ providedIn: 'root' })
export class FeedService {
  async getFollowersFeed(userId: string, limit = 20, offset = 0): Promise<PostModelWithAuthor[]> {
    ///  1) Who the current user follows
    const { data: follows, error: fErr } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', userId);
    if (fErr) throw fErr;
    const followedIds = (follows ?? []).map(f => f.followed_id);
    if (!followedIds.length) return [];

    ///  2) posts the current user has liked
    const { data: likedRows } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId);
    const likedIds = (likedRows ?? []).map(r => r.post_id);

    ///  3) posts the current user has seen
    const { data: seenRows } = await supabase
      .from('post_views')
      .select('post_id')
      .eq('user_id', userId);
    const seenIds = (seenRows ?? []).map(r => r.post_id);

    const notInList = (ids: string[]) => ids.length ? `(${ids.join(',')})` : '';

    let query = supabase
      .from('posts')
      .select(`
        *,
        author:users ( username, profile_picture_url )
      `)
      .eq('visibility', 'public')
      .in('author_id', followedIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (likedIds.length) query = query.not('id', 'in', notInList(likedIds));
    if (seenIds.length)  query = query.not('id', 'in', notInList(seenIds));

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as PostModelWithAuthor[];
  }

  async getMemoryLane(userId: string, limit = 20, offset = 0): Promise<PostModelWithAuthor[]> {
    const { data: likedRows, error: lErr } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId);
    if (lErr) throw lErr;

    const likedIds = (likedRows ?? []).map(r => r.post_id);
    if (!likedIds.length) return [];

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:users ( username, profile_picture_url )
      `)
      .in('id', likedIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    return (data ?? []) as PostModelWithAuthor[];
  }
}