import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { TaggedUser } from '../models/helper-models/film-data.model';
export interface CreateTagData {
  tagged_id: string;  // User being tagged
  target_type: 'post' | 'comment' | 'reply';
  target_id: string;  // Post/comment/reply ID
}

@Injectable({ providedIn: 'root' })
export class TagsService {
  /**
   * Get visible tagged users for a post
   * The database function filters out blocked users automatically
   */
  async getVisibleTaggedUsers(postId: string): Promise<TaggedUser[]> {
    try {
      console.log('[TagsService] Fetching tags for post:', postId);
      
      // The RPC function now accepts optional p_user_id parameter
      // It will use auth.uid() by default, but we can pass it explicitly if needed
      const { data, error } = await supabase
        .rpc('get_visible_tags', { 
          p_post_id: postId
          // p_user_id is optional - function uses auth.uid() by default
        });

      if (error) {
        console.error('[TagsService] Error calling get_visible_tags:', error);
        return [];
      }
      
      return (data ?? []) as TaggedUser[];
    } catch (err) {
      console.error('[TagsService] Exception in getVisibleTaggedUsers:', err);
      return [];
    }
  }

  /**
   * Create a single tag
   */
  async createTag(data: CreateTagData): Promise<string> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        tagger_id: user.id,
        tagged_id: data.tagged_id,
        target_type: data.target_type,
        target_id: data.target_id
      })
      .select('id')
      .single();

    if (error) throw error;

    return tag.id;
  }

  /**
   * Create multiple tags at once (for post creation)
   */
  async createTags(postId: string, taggedUserIds: string[]): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    if (taggedUserIds.length === 0) return; // No tags to create

    const tags = taggedUserIds.map(taggedId => ({
      tagger_id: user.id,
      tagged_id: taggedId,
      target_type: 'post' as const,
      target_id: postId
    }));

    const { error } = await supabase
      .from('tags')
      .insert(tags);

    if (error) throw error;
  }

  /**
   * Delete a specific tag
   */
  async deleteTag(tagId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('tagger_id', user.id);

    if (error) throw error;
  }

  /**
   * Delete all tags for a post (used when untagging all)
   */
  async deletePostTags(postId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .eq('tagger_id', user.id);

    if (error) throw error;
  }
}