export interface UserModel {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  private: boolean;
  created_at: string;
  updated_at: string;
}