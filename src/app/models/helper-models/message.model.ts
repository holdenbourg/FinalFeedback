export interface ConversationModel {
  id: string;
  created_at: string;
  updated_at: string;
  is_group: boolean;
  group_name?: string;
  group_avatar_url?: string;
  created_by: string;
}

export interface ConversationParticipantModel {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  last_read_at?: string;
  is_muted: boolean;
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

// Extended models with joined data for UI
export interface ConversationWithDetailsModel extends ConversationModel {
  participants: ConversationParticipantModel[];
  last_message?: MessageModel;
  unread_count?: number;
}

export interface MessageWithSenderModel extends MessageModel {
  sender_username?: string;
  sender_avatar?: string;
}