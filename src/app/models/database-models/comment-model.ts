export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  text: string;
  like_count: number;
  created_at: string;
  author?: { username: string; profile_picture_url: string };
}

export interface CommentView {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  createdAt: string;
  isReply: boolean;
  parentCommentId?: string;
}

export function mapRowToView(r: CommentRow): CommentView {
  return {
    id: r.id,
    postId: r.post_id,
    authorId: r.author_id,
    authorUsername: r.author?.username ?? '',
    authorAvatar: r.author?.profile_picture_url ?? '',
    text: r.text,
    likeCount: r.like_count ?? 0,
    createdAt: r.created_at,
    isReply: !!r.parent_comment_id,
    parentCommentId: r.parent_comment_id ?? undefined,
  };
}