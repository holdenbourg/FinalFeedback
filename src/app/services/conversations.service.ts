import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface ConversationModel {
  id: string;
  is_group: boolean;
  display_name: string | null;
  group_avatar_url: string | null;
  created_at: Date;
  is_pinned: boolean;
  is_muted: boolean;
  last_message: {
    content: string | null;
    created_at: Date;
    sender_id: string;
  } | null;
  unread_count: number;
  participants?: Array<{
    user_id: string;
    username: string;
    profile_picture_url: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  
  /**
   * ✅ Get all active conversations for current user
   * Uses array-based schema (participant_ids, pinned_by, muted_by, deleted_by)
   */
  async getConversations(): Promise<ConversationModel[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // ✅ Get conversations where user is in participant_ids AND NOT in deleted_by
    const { data: convos, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .contains('participant_ids', [user.id])  // User is a participant
      .not('deleted_by', 'cs', `{${user.id}}`);  // User hasn't deleted it

    if (convError) throw convError;

    const conversations: ConversationModel[] = [];

    for (const conv of convos || []) {
      // Get last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get unread count
      const lastReadAt = conv.last_read?.[user.id];
      let unreadCount = 0;
      
      if (lastReadAt) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt);
        
        unreadCount = count || 0;
      }

      conversations.push({
        id: conv.id,
        is_group: conv.is_group,
        display_name: conv.group_name,
        group_avatar_url: conv.group_avatar_url,
        created_at: new Date(conv.created_at),
        is_pinned: conv.pinned_by?.includes(user.id) || false,
        is_muted: conv.muted_by?.includes(user.id) || false,
        last_message: lastMsg ? {
          content: lastMsg.content,
          created_at: new Date(lastMsg.created_at),
          sender_id: lastMsg.sender_id
        } : null,
        unread_count: unreadCount
      });
    }

    // Sort: pinned first, then by last message time
    conversations.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      const aTime = a.last_message?.created_at.getTime() || a.created_at.getTime();
      const bTime = b.last_message?.created_at.getTime() || b.created_at.getTime();
      return bTime - aTime;
    });

    return conversations;
  }

  /**
   * ✅ Get conversations sorted by recent activity (for share modal)
   */
  async getConversationsByActivity(): Promise<ConversationModel[]> {
    return this.getConversations();
  }

  /**
   * ✅ Get conversation participants
   */
  async getParticipants(conversationId: string) {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('participant_ids')
      .eq('id', conversationId)
      .single();

    if (convError) throw convError;

    // Get user details for all participants
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, profile_picture_url')
      .in('id', conv.participant_ids);

    if (usersError) throw usersError;

    return users || [];
  }

  /**
   * ✅ Mark conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get current last_read
    const { data: conv } = await supabase
      .from('conversations')
      .select('last_read')
      .eq('id', conversationId)
      .single();

    const lastRead = conv?.last_read || {};
    lastRead[user.id] = new Date().toISOString();

    const { error } = await supabase
      .from('conversations')
      .update({ last_read: lastRead })
      .eq('id', conversationId);

    if (error) throw error;
  }

  /**
   * ✅ Pin/Unpin conversation
   */
  async togglePin(conversationId: string, isPinned: boolean): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get current pinned_by array
    const { data: conv } = await supabase
      .from('conversations')
      .select('pinned_by')
      .eq('id', conversationId)
      .single();

    let pinnedBy = conv?.pinned_by || [];

    if (isPinned) {
      // Add user to pinned_by
      if (!pinnedBy.includes(user.id)) {
        pinnedBy.push(user.id);
      }
    } else {
      // Remove user from pinned_by
      pinnedBy = pinnedBy.filter((id: string) => id !== user.id);
    }

    const { error } = await supabase
      .from('conversations')
      .update({ pinned_by: pinnedBy })
      .eq('id', conversationId);

    if (error) throw error;
  }

  /**
   * ✅ Mute/Unmute conversation
   */
  async toggleMute(conversationId: string, isMuted: boolean): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get current muted_by array
    const { data: conv } = await supabase
      .from('conversations')
      .select('muted_by')
      .eq('id', conversationId)
      .single();

    let mutedBy = conv?.muted_by || [];

    if (isMuted) {
      if (!mutedBy.includes(user.id)) {
        mutedBy.push(user.id);
      }
    } else {
      mutedBy = mutedBy.filter((id: string) => id !== user.id);
    }

    const { error } = await supabase
      .from('conversations')
      .update({ muted_by: mutedBy })
      .eq('id', conversationId);

    if (error) throw error;
  }

  /**
   * ✅ Delete conversation (for current user only)
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get current deleted_by array
    const { data: conv } = await supabase
      .from('conversations')
      .select('deleted_by')
      .eq('id', conversationId)
      .single();

    let deletedBy = conv?.deleted_by || [];

    if (!deletedBy.includes(user.id)) {
      deletedBy.push(user.id);
    }

    const { error } = await supabase
      .from('conversations')
      .update({ deleted_by: deletedBy })
      .eq('id', conversationId);

    if (error) throw error;
  }

  /**
   * ✅ Create DM conversation
   */
  async createDM(otherUserId: string): Promise<string> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Check if DM already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('is_group', false)
      .contains('participant_ids', [user.id, otherUserId])
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    // Create new DM
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        is_group: false,
        group_name: null,
        group_avatar_url: null,
        created_by: user.id,
        participant_ids: [user.id, otherUserId]
      })
      .select('id')
      .single();

    if (convError) throw convError;

    return conversation.id;
  }

  /**
   * ✅ Create group conversation
   */
  async createGroup(participantIds: string[], groupName: string, avatarUrl?: string): Promise<string> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Create group
    const allParticipants = [...new Set([user.id, ...participantIds])];

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        is_group: true,
        group_name: groupName,
        group_avatar_url: avatarUrl || null,
        created_by: user.id,
        participant_ids: allParticipants
      })
      .select('id')
      .single();

    if (convError) throw convError;

    return conversation.id;
  }

  /**
   * ✅ Get deleted conversations (for recovery)
   */
  async getDeletedConversations(): Promise<ConversationModel[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get conversations where user is in deleted_by
    const { data: convos, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .contains('deleted_by', [user.id])
      .contains('participant_ids', [user.id]);

    if (convError) throw convError;

    const conversations: ConversationModel[] = [];

    for (const conv of convos || []) {
      // Get last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      conversations.push({
        id: conv.id,
        is_group: conv.is_group,
        display_name: conv.group_name,
        group_avatar_url: conv.group_avatar_url,
        created_at: new Date(conv.created_at),
        is_pinned: false,
        is_muted: false,
        last_message: lastMsg ? {
          content: lastMsg.content,
          created_at: new Date(lastMsg.created_at),
          sender_id: lastMsg.sender_id
        } : null,
        unread_count: 0
      });
    }

    return conversations;
  }

  /**
   * ✅ Recover (undelete) a conversation
   */
  async recoverConversation(conversationId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    // Get current deleted_by array
    const { data: conv } = await supabase
      .from('conversations')
      .select('deleted_by')
      .eq('id', conversationId)
      .single();

    let deletedBy = conv?.deleted_by || [];
    deletedBy = deletedBy.filter((id: string) => id !== user.id);

    const { error } = await supabase
      .from('conversations')
      .update({ deleted_by: deletedBy })
      .eq('id', conversationId);

    if (error) throw error;
  }
}