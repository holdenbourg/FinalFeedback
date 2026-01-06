export interface LikeModel {
  user_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  created_at: string;
}