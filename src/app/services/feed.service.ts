import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { PostModelWithAuthor } from '../models/database-models/post.model';

@Injectable({ providedIn: 'root' })
export class FeedService {

  ///  Unified feed: followed-user posts first, then discover posts.
  ///  Excludes own posts, blocked users, and already-viewed/liked posts.
  ///  Works for anonymous users (pass null viewerId).
  async getUserFeed(
    viewerId: string | null,
    limit = 20,
    offset = 0
  ): Promise<{ posts: PostModelWithAuthor[]; followedAuthorIds: Set<string> }> {
    const { data, error } = await supabase
      .rpc('get_user_feed', {
        p_viewer_id: viewerId,
        p_limit: limit,
        p_offset: offset,
      });

    if (error) {
      console.error('FeedService.getUserFeed: error', error);
      throw error;
    }

    const followedAuthorIds = new Set<string>();

    const posts = (data ?? []).map((row: any) => {
      if (row.is_followed) followedAuthorIds.add(row.author_id);

      return {
        id: row.id,
        author_id: row.author_id,
        poster_url: row.poster_url,
        caption: row.caption,
        visibility: row.visibility,
        created_at: row.created_at,
        rating_id: row.rating_id,
        like_count: 0,
        save_count: 0,
        comment_count: 0,
        tag_count: 0,
        author: {
          username: row.author_username,
          profile_picture_url: row.author_profile_picture_url,
        },
      } as PostModelWithAuthor;
    });

    return { posts, followedAuthorIds };
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