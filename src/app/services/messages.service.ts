import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { MessageModel } from '../models/database-models/message.model';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  
  private readonly BATCH_SIZE = 50;  // Load 50 messages at a time

  /**
   * ✅ Fetch messages in batches (paginated)
   * @param conversationId - Conversation ID
   * @param offset - Number of messages to skip (for pagination)
   * @param limit - Number of messages to fetch
   */
  async getMessagesBatch(
    conversationId: string, 
    offset: number = 0, 
    limit: number = this.BATCH_SIZE
  ): Promise<{ messages: MessageModel[], hasMore: boolean }> {
    
    // Get total count first
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false);

    const totalMessages = count || 0;

    // Fetch batch
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!sender_id (
          id,
          username,
          profile_picture_url
        ),
        replied_message:messages!reply_to_message_id (
          id,
          content,
          shared_rating_id,
          sender:users!sender_id (
            id,
            username,
            profile_picture_url
          ),
          shared_rating:ratings (
            id,
            title,
            rating,
            poster_url,
            media_type
          )
        ),
        shared_rating:ratings (
          id,
          user_id,
          media_type,
          media_id,
          title,
          release_date,
          rating,
          criteria,
          date_rated,
          poster_url,
          rated,
          genres
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })  // Most recent first
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      messages: (data || []).reverse() as MessageModel[],  // Reverse to show oldest first
      hasMore: (offset + limit) < totalMessages
    };
  }

  /**
   * ✅ Get initial message batch (most recent 50)
   */
  async getInitialMessages(conversationId: string): Promise<{ messages: MessageModel[], hasMore: boolean }> {
    return this.getMessagesBatch(conversationId, 0, this.BATCH_SIZE);
  }

  /**
   * ✅ Load older messages (for infinite scroll up)
   */
  async loadOlderMessages(
    conversationId: string, 
    currentCount: number
  ): Promise<{ messages: MessageModel[], hasMore: boolean }> {
    return this.getMessagesBatch(conversationId, currentCount, this.BATCH_SIZE);
  }

  /**
   * ✅ Send a text message
   */
  async sendTextMessage(
    conversationId: string, 
    content: string, 
    replyToMessageId?: string
  ): Promise<MessageModel> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
        reply_to_message_id: replyToMessageId || null,
        shared_rating_id: null
      })
      .select(`
        *,
        sender:users!messages_sender_id_fkey (
          id,
          username,
          profile_picture_url
        )
      `)
      .single();

    if (error) throw error;
    return data as MessageModel;
  }

  /**
   * ✅ Share a rating (with optional comment)
   */
  async shareRating(
    conversationId: string, 
    ratingId: string, 
    comment?: string, 
    replyToMessageId?: string
  ): Promise<MessageModel> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: comment?.trim() || null,
        reply_to_message_id: replyToMessageId || null,
        shared_rating_id: ratingId
      })
      .select(`
        *,
        sender:users!messages_sender_id_fkey (
          id,
          username,
          profile_picture_url
        ),
        shared_rating:ratings (
          id,
          user_id,
          media_type,
          media_id,
          title,
          release_date,
          rating,
          criteria,
          date_rated,
          poster_url,
          rated,
          genres
        )
      `)
      .single();

    if (error) throw error;
    return data as MessageModel;
  }

  /**
   * ✅ Edit message content (only text, not shared ratings)
   */
  async editMessage(messageId: string, newContent: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('messages')
      .update({
        content: newContent.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) throw error;
  }

  /**
   * ✅ Delete message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: null
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) throw error;
  }

  /**
   * ✅ Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MessageModel | null> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (
          id,
          username,
          profile_picture_url
        ),
        shared_rating:ratings (
          id,
          title,
          rating,
          poster_url,
          media_type
        )
      `)
      .eq('id', messageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as MessageModel;
  }

  /**
   * ✅ Real-time subscription to new messages
   */
  subscribeToMessages(conversationId: string, callback: (message: MessageModel) => void) {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          // Fetch full message with relations
          const message = await this.getMessage(payload.new['id']);
          if (message) callback(message);
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * ✅ Unsubscribe from real-time updates
   */
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
}