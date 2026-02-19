import { RatingModel } from './rating.model';
import { UserModel } from './user.model';

export interface MessageModel {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  created_at: Date;
  updated_at: Date | null;
  reply_to_message_id: string | null;
  replied_message?: MessageModel;
  shared_rating_id: string | null;
  shared_rating?: RatingModel;
  sender?: UserModel;
  is_edited?: boolean;
  sending?: boolean;  // ✅ ADD THIS LINE
}