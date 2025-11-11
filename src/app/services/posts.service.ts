// src/app/services/posts.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class PostsService {
  ///  Delete the post and ALL its footprints (likes, views, comments, tags, saves)  \\\
  async deletePostOnly(postId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_post_cascade', { p_post_id: postId });
    if (error) throw error;
  }

  ///  Delete the post (and it's footprints) AND its rating in one go  \\\
  async deletePostAndRating(postId: string): Promise<void> {
    const { data, error } = await supabase
      .from('posts')
      .select('rating_id')
      .eq('id', postId)
      .single();

    if (error) throw error;

    const ratingId = data?.rating_id as string | undefined;
    if (!ratingId) {
      await this.deletePostOnly(postId);
      return;
    }

    const { error: rpcErr } = await supabase.rpc('delete_rating_cascade', { p_rating_id: ratingId });
    if (rpcErr) throw rpcErr;
  }
}