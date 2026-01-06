// src/app/services/posts.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface CreatePostData {
  rating_id: string;
  poster_url: string;  // Required by posts table
  caption?: string;
  visibility: 'public' | 'archived';
}

@Injectable({ providedIn: 'root' })
export class PostsService {
  /**
   * Create a new post (after rating is created)
   */
  async createPost(data: CreatePostData): Promise<string> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,  // Posts table uses author_id, not user_id
        rating_id: data.rating_id,
        caption: data.caption?.trim() || null,
        visibility: data.visibility,
        poster_url: data.poster_url  // Need to include poster_url
      })
      .select('id')
      .single();

    if (error) throw error;

    return post.id;
  }

  /**
   * Update post visibility (for switching between public/archived)
   */
  async updatePostVisibility(postId: string, visibility: 'public' | 'archived'): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('posts')
      .update({ visibility })
      .eq('id', postId)
      .eq('author_id', user.id);  // Posts table uses author_id

    if (error) throw error;
  }

  /**
   * Update post caption
   */
  async updatePostCaption(postId: string, caption: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('posts')
      .update({ caption: caption.trim() || null })
      .eq('id', postId)
      .eq('author_id', user.id);  // Posts table uses author_id

    if (error) throw error;
  }

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