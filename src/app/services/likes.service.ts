import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

type LikeTarget = 'post' | 'comment' | 'reply';

@Injectable({ providedIn: 'root' })
export class LikesService {
  ///  Toggle a like on/off  \\\
  async toggleLike(targetType: LikeTarget, targetId: string, liked: boolean): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    if (liked) {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId });

      if (error && error.code !== '23505') throw error;
    } else {
      const { error } = await supabase
        .from('likes')
        .delete()
        .match({ user_id: user.id, target_type: targetType, target_id: targetId });

      if (error) throw error;
    }
  }

  ///  Is this target likes by the user  \\\
  async isLiked(targetType: LikeTarget, targetId: string): Promise<boolean> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return false;

    const { data, error } = await supabase
      .from('likes')
      .select('user_id')
      .match({ user_id: user.id, target_type: targetType, target_id: targetId })
      .limit(1);

    if (error) throw error;

    return (data ?? []).length > 0;
  }

  ///  Get like count for a target  \\\
  async count(targetType: LikeTarget, targetId: string): Promise<number> {
    const { count, error } = await supabase
      .from('likes')
      .select('user_id', { count: 'exact', head: true })
      .match({ target_type: targetType, target_id: targetId });

    if (error) throw error;
    return count ?? 0;
  }
}