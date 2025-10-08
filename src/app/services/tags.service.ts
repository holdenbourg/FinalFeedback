import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface TaggedUser {
  user_id: string;
  username: string;
  profile_picture_url: string | null;
}

@Injectable({ providedIn: 'root' })
export class TagsService {
  async getVisibleTaggedUsers(postId: string): Promise<TaggedUser[]> {
    const { data, error } = await supabase.rpc('get_visible_tags', { p_post_id: postId });

    if (error) throw error;
    
    return (data ?? []) as TaggedUser[];
  }
}
