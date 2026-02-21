import { inject, Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/database-models/notification.model';

type LikeTarget = 'post' | 'comment' | 'reply';

@Injectable({ providedIn: 'root' })
export class LikesService {
  private notificationsService = inject(NotificationsService);

  ///  Toggle a like on/off  \\\
  async toggleLike(targetType: LikeTarget, targetId: string, liked: boolean): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    if (liked) {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId });

      if (error && error.code !== '23505') throw error;

      // Fire notification on successful new like (not duplicate)
      if (!error) {
        this.createLikeNotification(targetType, targetId).catch(() => {});
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .delete()
        .match({ user_id: user.id, target_type: targetType, target_id: targetId });

      if (error) throw error;
    }
  }

  private async createLikeNotification(targetType: LikeTarget, targetId: string): Promise<void> {
    if (targetType === 'post') {
      const { data: post } = await supabase
        .from('posts')
        .select('author_id, poster_url')
        .eq('id', targetId)
        .single();
      if (!post) return;
      const { data: authorUser } = await supabase
        .from('users')
        .select('username')
        .eq('id', post.author_id)
        .single();
      await this.notificationsService.create({
        recipientId: post.author_id,
        type: NotificationType.LIKED_POST,
        postId: targetId,
        metadata: { post_poster_url: post.poster_url, author_username: authorUser?.username },
      });
    } else {
      // Both 'comment' and 'reply' are in the comments table
      const { data: comment } = await supabase
        .from('comments')
        .select('author_id, post_id')
        .eq('id', targetId)
        .single();
      if (!comment) return;
      // Get post author username for deep-linking
      const { data: post } = await supabase
        .from('posts')
        .select('author_id, poster_url')
        .eq('id', comment.post_id)
        .single();
      let authorUsername: string | undefined;
      if (post?.author_id) {
        const { data: authorUser } = await supabase
          .from('users')
          .select('username')
          .eq('id', post.author_id)
          .single();
        authorUsername = authorUser?.username;
      }
      await this.notificationsService.create({
        recipientId: comment.author_id,
        type: targetType === 'comment' ? NotificationType.LIKED_COMMENT : NotificationType.LIKED_REPLY,
        postId: comment.post_id,
        commentId: targetId,
        metadata: { author_username: authorUsername, post_poster_url: post?.poster_url },
      });
    }
  }

  ///  Is this target liked by the current user  \\\
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

  ///  Get like count for a target (dynamic calculation)  \\\
  async count(targetType: LikeTarget, targetId: string): Promise<number> {
    const { count, error } = await supabase
      .from('likes')
      .select('user_id', { count: 'exact', head: true })
      .match({ target_type: targetType, target_id: targetId });

    if (error) throw error;
    return count ?? 0;
  }

  ///  Get like counts for multiple targets (batch operation)  \\\
  async countMultiple(targetType: LikeTarget, targetIds: string[]): Promise<Map<string, number>> {
    if (targetIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('likes')
      .select('target_id')
      .eq('target_type', targetType)
      .in('target_id', targetIds);

    if (error) {
      console.error('Error fetching like counts:', error);
      return new Map();
    }

    // Count occurrences of each target_id
    const counts = new Map<string, number>();
    (data || []).forEach((like: any) => {
      counts.set(like.target_id, (counts.get(like.target_id) || 0) + 1);
    });

    return counts;
  }

  ///  Check which targets current user has liked (batch operation)  \\\
  async checkMultipleLiked(targetType: LikeTarget, targetIds: string[]): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return new Set();

    const { data, error } = await supabase
      .from('likes')
      .select('target_id')
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .in('target_id', targetIds);

    if (error) {
      console.error('Error checking likes:', error);
      return new Set();
    }

    return new Set((data || []).map((like: any) => like.target_id));
  }
}
