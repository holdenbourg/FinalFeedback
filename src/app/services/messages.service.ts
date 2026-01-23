import { Injectable, inject } from '@angular/core';
import { UsersService } from './users.service';
import { supabase } from '../core/supabase.client';

// ============================================
// REQUIRED SUPABASE RLS POLICIES
// ============================================
// 
// The following RLS policy must be added to your Supabase database
// for the conversations table to allow participants to update arrays:
//
// CREATE POLICY "Participants can update conversation arrays"
// ON conversations
// FOR UPDATE
// USING (auth.uid() = ANY(participant_ids))
// WITH CHECK (auth.uid() = ANY(participant_ids));
//
// ============================================

// ============================================
// INTERFACES
// ============================================

export interface ConversationModel {
  id: string;
  created_at: string;
  updated_at: string;
  is_group: boolean;
  group_name?: string;
  group_avatar_url?: string;
  created_by: string;
  participant_ids: string[];
  last_read: Record<string, string>;
  muted_by: string[];
  pinned_by: string[];
  deleted_by: string[];
}

export interface ConversationWithDetailsModel extends ConversationModel {
  last_message?: MessageModel;
  unread_count: number;
  display_name?: string;
  display_avatar?: string;
  is_pinned?: boolean;
  is_muted?: boolean;
}

export interface MessageModel {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  reply_to_message_id?: string;
}

export interface MessageWithSenderModel extends MessageModel {
  sender_username?: string;
  sender_avatar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService {
  private usersService = inject(UsersService);

  // ============================================
  // CONVERSATION METHODS
  // ============================================

  /**
   * Get all conversations for current user, sorted by pinned first then most recent
   */
  async getUserConversations(userId: string): Promise<ConversationWithDetailsModel[]> {
    try {
      // Get all conversations where user is a participant and hasn't deleted
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!conversations || conversations.length === 0) return [];

      // Filter out deleted conversations (in case RLS doesn't catch it)
      const activeConversations = conversations.filter(
        conv => !conv.deleted_by?.includes(userId)
      );

      // Enrich with details
      const conversationsWithDetails = await Promise.all(
        activeConversations.map(async (conv) => {
          // Get last message
          const { data: lastMessages } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const lastMessage = lastMessages && lastMessages.length > 0 ? lastMessages[0] : null;

          // Calculate unread count
          const lastReadAt = conv.last_read?.[userId];
          let unreadCount = 0;
          
          if (lastReadAt) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('is_deleted', false)
              .neq('sender_id', userId)
              .gt('created_at', lastReadAt);
            
            unreadCount = count || 0;
          } else {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('is_deleted', false)
              .neq('sender_id', userId);
            
            unreadCount = count || 0;
          }

          // Get display name and avatar
          const displayName = await this.getConversationDisplayName(conv, userId);
          const displayAvatar = await this.getConversationAvatar(conv, userId);

          // Check pinned/muted status
          const isPinned = conv.pinned_by?.includes(userId) || false;
          const isMuted = conv.muted_by?.includes(userId) || false;

          return {
            ...conv,
            last_message: lastMessage || undefined,
            unread_count: unreadCount,
            display_name: displayName,
            display_avatar: displayAvatar,
            is_pinned: isPinned,
            is_muted: isMuted
          } as ConversationWithDetailsModel;
        })
      );

      // Sort: pinned first, then by updated_at
      conversationsWithDetails.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      return conversationsWithDetails;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  /**
   * Get deleted conversations for current user (for recovery feature)
   */
  async getDeletedConversations(userId: string): Promise<ConversationWithDetailsModel[]> {
    try {
      // Get all conversations where user is a participant AND has deleted
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [userId])
        .contains('deleted_by', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!conversations || conversations.length === 0) return [];

      // Enrich with details (simplified - no unread count needed for deleted)
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          const displayName = await this.getConversationDisplayName(conv, userId);
          const displayAvatar = await this.getConversationAvatar(conv, userId);

          return {
            ...conv,
            unread_count: 0,
            display_name: displayName,
            display_avatar: displayAvatar,
            is_pinned: false,
            is_muted: false
          } as ConversationWithDetailsModel;
        })
      );

      return conversationsWithDetails;
    } catch (error) {
      console.error('Error fetching deleted conversations:', error);
      return [];
    }
  }

  /**
   * Create a new conversation (1:1 or group)
   */
  async createConversation(
    creatorId: string,
    participantIds: string[],
    isGroup: boolean = false,
    groupName?: string
  ): Promise<ConversationModel | null> {
    try {
      // For 1:1, check if conversation already exists
      if (!isGroup && participantIds.length === 1) {
        const existingConv = await this.findExistingConversation(creatorId, participantIds[0]);
        if (existingConv) {
          // If conversation exists but user deleted it, restore it
          if (existingConv.deleted_by?.includes(creatorId)) {
            await this.restoreConversation(existingConv.id, creatorId);
          }
          return existingConv;
        }
      }

      // All participants including creator
      const allParticipantIds = [creatorId, ...participantIds.filter(id => id !== creatorId)];

      // Create conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          created_by: creatorId,
          is_group: isGroup,
          group_name: groupName,
          participant_ids: allParticipantIds,
          last_read: {},
          muted_by: [],
          pinned_by: [],
          deleted_by: []
        })
        .select()
        .single();

      if (error) throw error;
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }

  /**
   * Find existing 1:1 conversation between two users
   */
  private async findExistingConversation(user1Id: string, user2Id: string): Promise<ConversationModel | null> {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('is_group', false)
        .contains('participant_ids', [user1Id, user2Id]);

      if (error) throw error;
      if (!conversations || conversations.length === 0) return null;

      const exactMatch = conversations.find(
        conv => conv.participant_ids.length === 2
      );

      return exactMatch || null;
    } catch (error) {
      console.error('Error finding existing conversation:', error);
      return null;
    }
  }

  /**
   * Restore a deleted conversation for a user
   */
  private async restoreConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('deleted_by')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      const newDeletedBy = (conv.deleted_by || []).filter((id: string) => id !== userId);

      await supabase
        .from('conversations')
        .update({ deleted_by: newDeletedBy })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error restoring conversation:', error);
    }
  }

  /**
   * Search conversations
   */
  async searchConversations(
    userId: string,
    searchTerm: string
  ): Promise<ConversationWithDetailsModel[]> {
    try {
      const allConversations = await this.getUserConversations(userId);

      if (!searchTerm.trim()) return allConversations;

      const term = searchTerm.toLowerCase();
      const results: ConversationWithDetailsModel[] = [];

      for (const conv of allConversations) {
        if (conv.display_name?.toLowerCase().includes(term)) {
          results.push(conv);
          continue;
        }

        const { data: messages } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .ilike('content', `%${searchTerm}%`)
          .limit(1);

        if (messages && messages.length > 0) {
          results.push(conv);
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  // ============================================
  // MESSAGE METHODS
  // ============================================

  async getConversationMessages(conversationId: string): Promise<MessageWithSenderModel[]> {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!messages) return [];

      const messagesWithSender = await Promise.all(
        messages.map(async (msg) => {
          const sender = await this.usersService.getUserProfileById(msg.sender_id);
          return {
            ...msg,
            sender_username: sender?.username,
            sender_avatar: sender?.profile_picture_url
          } as MessageWithSenderModel;
        })
      );

      return messagesWithSender;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    replyToMessageId?: string
  ): Promise<MessageModel | null> {
    try {
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          reply_to_message_id: replyToMessageId
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('last_read')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      const updatedLastRead = {
        ...conv.last_read,
        [userId]: new Date().toISOString()
      };

      await supabase
        .from('conversations')
        .update({ last_read: updatedLastRead })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  subscribeToConversation(conversationId: string, callback: (message: MessageModel) => void) {
    return supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          callback(payload.new as MessageModel);
        }
      )
      .subscribe();
  }

  // ============================================
  // DISPLAY HELPERS
  // ============================================

  /**
   * Get conversation display name - handles groups with multiple participants
   */
  async getConversationDisplayName(
    conversation: ConversationModel,
    currentUserId: string
  ): Promise<string> {
    // If group has a custom name, use it
    if (conversation.is_group && conversation.group_name) {
      return conversation.group_name;
    }

    // Get other participants (exclude current user)
    const otherParticipantIds = conversation.participant_ids.filter(id => id !== currentUserId);

    if (otherParticipantIds.length === 0) {
      return 'Conversation';
    }

    // For 1:1 chat, just show the other user's name
    if (otherParticipantIds.length === 1) {
      const user = await this.usersService.getUserProfileById(otherParticipantIds[0]);
      return user?.username || 'Unknown User';
    }

    // For group chat without name, show list of participant names
    const usernames: string[] = [];
    for (const participantId of otherParticipantIds) {
      const user = await this.usersService.getUserProfileById(participantId);
      if (user?.username) {
        usernames.push(user.username);
      }
    }

    if (usernames.length === 0) {
      return 'Group Chat';
    }

    if (usernames.length === 1) {
      return usernames[0];
    }

    if (usernames.length === 2) {
      return `${usernames[0]} and ${usernames[1]}`;
    }

    // 3+ participants: "user1, user2, and 2 others"
    const displayedNames = usernames.slice(0, 2);
    const remainingCount = usernames.length - 2;
    return `${displayedNames.join(', ')}, and ${remainingCount} other${remainingCount > 1 ? 's' : ''}`;
  }

  async getConversationAvatar(
    conversation: ConversationModel,
    currentUserId: string
  ): Promise<string> {
    if (conversation.is_group && conversation.group_avatar_url) {
      return conversation.group_avatar_url;
    }

    const otherUserId = conversation.participant_ids.find(id => id !== currentUserId);
    if (otherUserId) {
      const user = await this.usersService.getUserProfileById(otherUserId);
      return user?.profile_picture_url || '/assets/images/default-avatar.png';
    }

    return '/assets/images/default-avatar.png';
  }

  // ============================================
  // CONVERSATION ACTIONS (Pin, Mute, Delete)
  // ============================================

  /**
   * Toggle pin status for a conversation
   */
  async togglePin(conversationId: string, userId: string): Promise<boolean> {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('pinned_by')
        .eq('id', conversationId)
        .single();

      if (!conv) return false;

      const isPinned = (conv.pinned_by || []).includes(userId);
      const newPinnedBy = isPinned
        ? (conv.pinned_by || []).filter((id: string) => id !== userId)
        : [...(conv.pinned_by || []), userId];

      const { error } = await supabase
        .from('conversations')
        .update({ pinned_by: newPinnedBy })
        .eq('id', conversationId);

      if (error) throw error;
      return !isPinned; // Returns new pinned state
    } catch (error) {
      console.error('Error toggling pin:', error);
      return false;
    }
  }

  /**
   * Toggle mute status for a conversation
   */
  async toggleMute(conversationId: string, userId: string): Promise<boolean> {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('muted_by')
        .eq('id', conversationId)
        .single();

      if (!conv) return false;

      const isMuted = (conv.muted_by || []).includes(userId);
      const newMutedBy = isMuted
        ? (conv.muted_by || []).filter((id: string) => id !== userId)
        : [...(conv.muted_by || []), userId];

      const { error } = await supabase
        .from('conversations')
        .update({ muted_by: newMutedBy })
        .eq('id', conversationId);

      if (error) throw error;
      return !isMuted; // Returns new muted state
    } catch (error) {
      console.error('Error toggling mute:', error);
      return false;
    }
  }

  /**
   * Delete conversation for a user
   * - Adds user to deleted_by array
   * - If all participants have deleted, removes from database
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // Ensure we actually have an authenticated user
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        console.error('Error deleting conversation: user not authenticated', authErr);
        return false;
      }

      const { error } = await supabase.rpc('delete_conversation_for_me', {
        p_conversation_id: conversationId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }
  async undeleteConversation(conversationId: string): Promise<boolean> {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        console.error('Error undeleting conversation: user not authenticated', authErr);
        return false;
      }

      const { error } = await supabase.rpc('undelete_conversation_for_me', {
        p_conversation_id: conversationId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error undeleting conversation:', error);
      return false;
    }
  }

  // ============================================
  // GROUP CHAT MANAGEMENT
  // ============================================

  /**
   * Update group chat details (name and/or avatar)
   */
  async updateGroupDetails(
    conversationId: string, 
    updates: { group_name?: string; group_avatar_url?: string }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)
        .eq('is_group', true);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating group details:', error);
      return false;
    }
  }

  /**
   * Upload group avatar and update conversation
   */
  async uploadGroupAvatar(conversationId: string, file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${conversationId}-${Date.now()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update conversation with new avatar URL
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ group_avatar_url: publicUrl })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.error('Error uploading group avatar:', error);
      return { success: false, error: error.message || 'Failed to upload avatar' };
    }
  }

  // ============================================
  // PARTICIPANT MANAGEMENT
  // ============================================

  async addParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .single();

      if (!conv) return false;
      if (conv.participant_ids.includes(userId)) return true;

      const { error } = await supabase
        .from('conversations')
        .update({ 
          participant_ids: [...conv.participant_ids, userId] 
        })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding participant:', error);
      return false;
    }
  }

  /**
   * Remove a participant from a conversation.
   * For group leave behavior we now use an RPC so the DB can:
   * - remove user
   * - convert to direct if 2 remain and no direct exists
   * - delete group+messages if 2 remain and direct exists
   */
  async removeParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      // If the user is removing THEMSELVES, use the RPC (handles convert/nuke logic)
      const { data: authData } = await supabase.auth.getUser();
      const me = authData?.user?.id;

      if (me && me === userId) {
        const { error } = await supabase.rpc('leave_group_chat', {
          p_conversation_id: conversationId
        });

        if (error) throw error;
        return true;
      }

      // If you ever want admins to remove OTHER users later, do a separate RPC
      // (client-side update is not safe / can be blocked by RLS)
      console.warn('removeParticipant called for a different user. Create an admin RPC for this.');
      return false;

    } catch (error) {
      console.error('Error removing participant:', error);
      return false;
    }
  }

  /**
   * Leave a group chat (current user leaves).
   * Uses RPC so it can atomically:
   * - remove you
   * - convert-to-direct or delete group based on whether direct already exists
   */
  async leaveGroup(conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('leave_group_chat', {
        p_conversation_id: conversationId
      });

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('Error leaving group:', error);
      return false;
    }
  }
}