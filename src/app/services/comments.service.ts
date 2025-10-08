import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { CommentRow } from '../models/database-models/comment-model';

type ChildrenByParent = Map<string, CommentRow[]>;

@Injectable({ providedIn: 'root' })
export class CommentsService {
  ///  Load all comments for a post and the replies to those comments  \\\
  async fetchThread(postId: string): Promise<{ roots: CommentRow[]; childrenByParent: Map<string, CommentRow[]>; }> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, post_id, author_id, parent_comment_id, text, like_count, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as unknown as CommentRow[];

    const roots: CommentRow[] = [];
    const childrenByParent: ChildrenByParent = new Map();

    for (const row of rows) {
      if (!row.parent_comment_id) {
        roots.push(row);

      } else {
        const bucket = childrenByParent.get(row.parent_comment_id) ?? [];
        bucket.push(row);

        childrenByParent.set(row.parent_comment_id, bucket);
      }
    }

    for (const [, list] of childrenByParent) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    return { roots, childrenByParent };
  }

  ///  Add a new comment to a post  \\\
  async addComment(postId: string, text: string): Promise<CommentRow> {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, text })
      .select(`
        id, post_id, author_id, parent_comment_id, text, like_count, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .single();

    if (error) throw error;

    return data as unknown as CommentRow;
  }

  ///  Add a reply to a comment/reply  \\\
  async addReply(parentCommentId: string, text: string): Promise<CommentRow> {
    const { data: parent, error: pErr } = await supabase
      .from('comments')
      .select('post_id')
      .eq('id', parentCommentId)
      .single();

    if (pErr) throw pErr;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: parent.post_id,
        parent_comment_id: parentCommentId,
        text
      })
      .select(`
        id, post_id, author_id, parent_comment_id, text, like_count, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .single();

    if (error) throw error;

    return data as unknown as CommentRow;
  }
}