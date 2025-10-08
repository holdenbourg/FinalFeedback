import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class ViewsService {
  async markSeen(postId: string) {
    const { data: { user }, error: uerr } = await supabase.auth.getUser();
    if (uerr || !user) return;

    await supabase.from('post_views').upsert({
      user_id: user.id,
      post_id: postId
    }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
  }
}