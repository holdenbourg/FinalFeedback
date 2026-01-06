export interface ViewModel {
  user_id: string;
  target_type: 'post' | 'user';
  target_id: string;
  seen_at: string;  
}