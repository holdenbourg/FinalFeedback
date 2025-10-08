export interface PostModel {
  id: string;                       ///  uuid (primary key)
  author_id: string;                ///  uuid        -> FK to users.id (the author)
  poster_url: string;               ///  text        -> URL to the post image or media
  caption?: string | null;          ///  text        -> caption for the post (nullable)
  visibility: 'public' | 'private'; ///  text        -> only these two values
  like_count: number;               ///  int         -> total likes
  save_count: number;               ///  int         -> total saves/bookmarks
  comment_count: number;            ///  int         -> total comments
  tag_count: number;                ///  int         -> total tags/mentions
  created_at: string;               ///  timestamptz -> ISO date string
}

export interface PostModelWithAuthor extends PostModel {
  author?: {
    username: string;
    profile_picture_url: string;
  };
}