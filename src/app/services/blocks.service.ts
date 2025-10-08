import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface BlockedUser {
  user_id: string;
  username: string;
  profile_picture_url: string | null;
  blocked_at: string;
}

@Injectable({ providedIn: 'root' })
export class BlocksService {
  async listMyBlockedUsers(): Promise<BlockedUser[]> {
    const me = (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!me) return [];

    const { data, error } = await supabase
      .from('user_blocks')
      .select(`
        created_at,
        blocked:users!user_blocks_blocked_id_fkey (
          id,
          username,
          profile_picture_url
        )
      `)
      .eq('blocker_id', me)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      user_id: row.blocked?.id,
      username: row.blocked?.username,
      profile_picture_url: row.blocked?.profile_picture_url ?? null,
      blocked_at: row.created_at,
    })) as BlockedUser[];
  }

  async blockUserById(targetUserId: string): Promise<void> {
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) throw new Error('Not signed in');

    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: me, blocked_id: targetUserId });

    if (error) throw error;
  }

  async unblockUserById(targetUserId: string): Promise<void> {
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) throw new Error('Not signed in');

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', me)
      .eq('blocked_id', targetUserId);
      
    if (error) throw error;
  }
}