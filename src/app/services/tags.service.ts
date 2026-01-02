import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface TaggedUser {
  username: string;
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

      console.log('[TagsService] RPC response:', { data, error });

      if (error) {
        console.error('[TagsService] Error calling get_visible_tags:', error);
        return [];
      }
      
      console.log('[TagsService] Returning', data?.length || 0, 'tags');
      return (data ?? []) as TaggedUser[];
    } catch (err) {
      console.error('[TagsService] Exception in getVisibleTaggedUsers:', err);
      return [];
    }
  }
}