// src/app/services/comments.service.ts

import { inject, Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { CommentModel } from '../models/database-models/comment.model';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/database-models/notification.model';

type ChildrenByParent = Map<string, CommentModel[]>;

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private notificationsService = inject(NotificationsService);
  ///  Load all comments for a post and the replies to those comments  \\\
  async fetchThread(postId: string): Promise<{ roots: CommentModel[]; childrenByParent: Map<string, CommentModel[]>; }> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, post_id, author_id, parent_comment_id, text, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as unknown as CommentModel[];

    const roots: CommentModel[] = [];
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
  async addComment(postId: string, text: string): Promise<CommentModel> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({ 
        post_id: postId, 
        text,
        author_id: user.id
      })
      .select(`
        id, post_id, author_id, parent_comment_id, text, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .single();

    if (error) throw error;

    const comment = data as unknown as CommentModel;

    // Notify post owner + tagged users on the post
    this.notifyOnComment(postId, comment.id, text).catch(() => {});

    return comment;
  }

  private async notifyOnComment(postId: string, commentId: string, text: string): Promise<void> {
    const { data: post } = await supabase
      .from('posts')
      .select('author_id, poster_url')
      .eq('id', postId)
      .single();
    if (!post) return;

    const { data: authorUser } = await supabase
      .from('users')
      .select('username')
      .eq('id', post.author_id)
      .single();
    const authorUsername = authorUser?.username;

    // Notify post owner
    await this.notificationsService.create({
      recipientId: post.author_id,
      type: NotificationType.COMMENTED_ON_POST,
      postId,
      commentId,
      metadata: { comment_preview: text.slice(0, 60), post_poster_url: post.poster_url, author_username: authorUsername },
    });

    // Notify tagged users on the post
    const { data: tags } = await supabase
      .from('tags')
      .select('tagged_id')
      .eq('target_type', 'post')
      .eq('target_id', postId);

    if (tags) {
      for (const tag of tags) {
        if (tag.tagged_id !== post.author_id) {
          await this.notificationsService.create({
            recipientId: tag.tagged_id,
            type: NotificationType.COMMENT_ON_TAGGED_POST,
            postId,
            commentId,
            metadata: { comment_preview: text.slice(0, 60), post_poster_url: post.poster_url, author_username: authorUsername },
          });
        }
      }
    }
  }

  ///  Add a reply to a comment/reply  \\\
  async addReply(parentCommentId: string, text: string): Promise<CommentModel> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

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
        text,
        author_id: user.id
      })
      .select(`
        id, post_id, author_id, parent_comment_id, text, created_at,
        author:users!comments_author_id_fkey ( username, profile_picture_url )
      `)
      .single();

    if (error) throw error;

    const reply = data as unknown as CommentModel;

    // Notify parent comment author + post owner
    this.notifyOnReply(parentCommentId, parent.post_id, reply.id, text).catch(() => {});

    return reply;
  }

  private async notifyOnReply(parentCommentId: string, postId: string, replyId: string, text: string): Promise<void> {
    const { data: parentComment } = await supabase
      .from('comments')
      .select('author_id')
      .eq('id', parentCommentId)
      .single();
    if (!parentComment) return;

    // Get post author username for deep-linking
    const { data: post } = await supabase
      .from('posts')
      .select('author_id, poster_url')
      .eq('id', postId)
      .single();
    let authorUsername: string | undefined;
    if (post?.author_id) {
      const { data: authorUser } = await supabase
        .from('users')
        .select('username')
        .eq('id', post.author_id)
        .single();
      authorUsername = authorUser?.username;
    }

    // Notify parent comment author
    await this.notificationsService.create({
      recipientId: parentComment.author_id,
      type: NotificationType.REPLIED_TO_COMMENT,
      postId,
      commentId: replyId,
      metadata: { comment_preview: text.slice(0, 60), author_username: authorUsername },
    });

    // Notify post owner if different from parent comment author
    if (post && post.author_id !== parentComment.author_id) {
      await this.notificationsService.create({
        recipientId: post.author_id,
        type: NotificationType.REPLIED_TO_COMMENT_ON_POST,
        postId,
        commentId: replyId,
        metadata: { comment_preview: text.slice(0, 60), post_poster_url: post.poster_url, author_username: authorUsername },
      });
    }
  }

  /**
   * Delete a comment or reply
   * Verifies user owns the comment before deleting
   */
  async deleteComment(commentId: string): Promise<void> {
    // Get current user
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      console.error('[CommentsService] Not authenticated:', authErr);
      throw authErr ?? new Error('Not authenticated');
    }

    console.log('[CommentsService] Deleting comment:', commentId, 'by user:', user.id);

    // Delete the comment (user must be author due to RLS)
    const { error, data } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', user.id)  // ✅ Explicit ownership check
      .select();  // ✅ Return deleted row to verify

    if (error) {
      console.error('[CommentsService] Delete error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('[CommentsService] No rows deleted - comment not found or not owned by user');
      throw new Error('Comment not found or you do not have permission to delete it');
    }

    console.log('[CommentsService] Successfully deleted comment');
  }
}