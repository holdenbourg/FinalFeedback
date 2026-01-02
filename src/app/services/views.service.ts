import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export type ViewTargetType = 'post' | 'profile';

@Injectable({ providedIn: 'root' })
export class ViewsService {
  // Generic internal helper
  private async markSeenInternal(
    targetType: ViewTargetType,
    targetId: string
  ): Promise<void> {
    const {
      data: { user },
      error: uerr,
    } = await supabase.auth.getUser();

    // Not logged in or auth error → nothing to record
    if (uerr || !user) return;

    const payload = {
      user_id: user.id,
      target_type: targetType,
      target_id: targetId,
      seen_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('views')
      .upsert(payload, {
        onConflict: 'user_id,target_type,target_id',
      });

    if (error) {
      // Silently ignore RLS policy errors (403/insufficient privileges)
      // These happen when viewing your own posts or posts from blocked users
      if (error.code === '42501' || error.code === 'PGRST301') {
        // 42501 = insufficient_privilege (Postgres)
        // PGRST301 = RLS policy violation (PostgREST)
        return;
      }
      
      // Log other errors but don't throw (best-effort tracking)
      console.warn('ViewsService.markSeenInternal error:', error.message);
    }
  }

  /** Mark a post as seen (used by the feed). */
  async markPostSeen(postId: string): Promise<void> {
    return this.markSeenInternal('post', postId);
  }

  /** Mark a profile/account as seen (for future Account component). */
  async markProfileSeen(profileUserId: string): Promise<void> {
    return this.markSeenInternal('profile', profileUserId);
  }
}