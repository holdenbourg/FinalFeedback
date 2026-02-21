import { inject, Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { TaggedUser } from '../models/helper-models/film-data.model';
import { NotificationsService } from './notifications.service';
import { NotificationType, NotificationMetadata } from '../models/database-models/notification.model';

export interface CreateTagData {
  tagged_id: string;  // User being tagged
  target_type: 'post' | 'comment' | 'reply';
  target_id: string;  // Post/comment/reply ID
  status?: 'public' | 'archived';  // Tag visibility status (defaults to 'archived' in DB)
}

@Injectable({ providedIn: 'root' })
export class TagsService {
  private notificationsService = inject(NotificationsService);

  /**
   * Get visible tagged users for a post
   * The database function filters out blocked users automatically
   */
  async getVisibleTaggedUsers(postId: string): Promise<TaggedUser[]> {
    try {
      console.log('[TagsService] Fetching tags for post:', postId);
      
      // The RPC function now accepts optional p_user_id parameter
      // It will use auth.uid() by default, but we can pass it explicitly if needed
      const { data, error } = await supabase
        .rpc('get_visible_tags', { 
          p_post_id: postId
          // p_user_id is optional - function uses auth.uid() by default
        });

      if (error) {
        console.error('[TagsService] Error calling get_visible_tags:', error);
        return [];
      }
      
      return (data ?? []) as TaggedUser[];
    } catch (err) {
      console.error('[TagsService] Exception in getVisibleTaggedUsers:', err);
      return [];
    }
  }

  /**
   * Create a single tag
   */
  async createTag(data: CreateTagData): Promise<string> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        tagger_id: user.id,
        tagged_id: data.tagged_id,
        target_type: data.target_type,
        target_id: data.target_id,
        status: data.status ?? 'archived'  // Default to 'archived' if not specified
      })
      .select('id')
      .single();

    if (error) throw error;

    // Notify the tagged user
    this.notifyTaggedUser(data.tagged_id, data.target_type, data.target_id).catch(() => {});

    return tag.id;
  }

  private async notifyTaggedUser(
    taggedId: string,
    targetType: 'post' | 'comment' | 'reply',
    targetId: string
  ): Promise<void> {
    const typeMap: Record<string, NotificationType> = {
      post: NotificationType.TAGGED_IN_POST,
      comment: NotificationType.TAGGED_IN_COMMENT,
      reply: NotificationType.TAGGED_IN_REPLY,
    };

    let postId: string | undefined;
    let metadata: NotificationMetadata = {};

    if (targetType === 'post') {
      postId = targetId;
      // Get rating title for post tags
      const { data: post } = await supabase
        .from('posts')
        .select('rating_id, poster_url, author_id')
        .eq('id', targetId)
        .single();
      if (post) {
        if (post.author_id) {
          const { data: authorUser } = await supabase
            .from('users')
            .select('username')
            .eq('id', post.author_id)
            .single();
          metadata.author_username = authorUser?.username;
        }
        if (post.poster_url) metadata.post_poster_url = post.poster_url;
        if (post.rating_id) {
          const { data: rating } = await supabase
            .from('ratings')
            .select('title')
            .eq('id', post.rating_id)
            .single();
          if (rating) metadata.rating_title = rating.title;
        }
      }
    } else {
      // For comment/reply tags, get the post_id from the comment
      const { data: comment } = await supabase
        .from('comments')
        .select('post_id')
        .eq('id', targetId)
        .single();
      if (comment) {
        postId = comment.post_id;
        // Get post author username for deep-linking
        const { data: p } = await supabase
          .from('posts')
          .select('author_id')
          .eq('id', comment.post_id)
          .single();
        if (p?.author_id) {
          const { data: authorUser } = await supabase
            .from('users')
            .select('username')
            .eq('id', p.author_id)
            .single();
          metadata.author_username = authorUser?.username;
        }
      }
    }

    await this.notificationsService.create({
      recipientId: taggedId,
      type: typeMap[targetType],
      postId,
      commentId: targetType !== 'post' ? targetId : undefined,
      metadata,
    });
  }

  /**
   * Create multiple tags at once (for post creation)
   * Status should match the post's visibility: 'public' or 'archived'
   */
  async createTags(postId: string, taggedUserIds: string[], status: 'public' | 'archived' = 'archived'): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    if (taggedUserIds.length === 0) return; // No tags to create

    const tags = taggedUserIds.map(taggedId => ({
      tagger_id: user.id,
      tagged_id: taggedId,
      target_type: 'post' as const,
      target_id: postId,
      status: status  // Match the post's visibility
    }));

    const { error } = await supabase
      .from('tags')
      .insert(tags);

    if (error) throw error;

    // Notify each tagged user
    for (const taggedId of taggedUserIds) {
      this.notifyTaggedUser(taggedId, 'post', postId).catch(() => {});
    }
  }

  /**
   * Create tags from @mentions in text
   * Validates that mentioned users exist before creating tags
   */
  async createTagsFromMentions(
    text: string,
    targetType: 'post' | 'comment' | 'reply',
    targetId: string,
    postId: string
  ): Promise<string[]> {
    try {
      // Get current user
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr || !user) {
        console.error('[TagsService] Not signed in:', uErr);
        return [];
      }

      // Extract @mentions from text
      const mentions = this.extractMentions(text);
      if (mentions.length === 0) {
        return [];
      }

      console.log('[TagsService] Found mentions:', mentions);

      // Get post status to match tag status
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .select('visibility')
        .eq('id', postId)
        .single();

      if (postErr) {
        console.error('[TagsService] Error fetching post status:', postErr);
        return [];
      }

      const status = post.visibility as 'public' | 'archived';

      // Validate each mentioned user exists and get their ID
      const validTags: Array<{ tagged_id: string }> = [];
      
      for (const username of mentions) {
        // ✅ FIX: Use eq() with toLowerCase() instead of ilike()
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();  // ✅ FIX: Use maybeSingle() instead of single()

        if (!userErr && userData) {
          // Don't tag yourself
          if (userData.id !== user.id) {
            validTags.push({ tagged_id: userData.id });
          } else {
            console.log('[TagsService] Skipping self-tag');
          }
        } else {
          console.log(`[TagsService] User "${username}" not found, skipping tag`);
        }
      }

      if (validTags.length === 0) {
        console.log('[TagsService] No valid users to tag');
        return [];
      }

      // Create tags for all valid users
      const tags = validTags.map(tag => ({
        tagger_id: user.id,
        tagged_id: tag.tagged_id,
        target_type: targetType,
        target_id: targetId,
        status: status
      }));

      console.log('[TagsService] Creating tags:', tags);

      const { data: created, error: insertErr } = await supabase
        .from('tags')
        .insert(tags)
        .select('id');

      if (insertErr) {
        console.error('[TagsService] Error creating tags:', insertErr);
        return [];
      }

      console.log(`[TagsService] Created ${created?.length || 0} tags`);

      // Notify each tagged user
      for (const tag of validTags) {
        this.notifyTaggedUser(tag.tagged_id, targetType, targetId).catch(() => {});
      }

      return (created || []).map(t => t.id);

    } catch (err) {
      console.error('[TagsService] Exception in createTagsFromMentions:', err);
      return [];
    }
  }

  /**
   * Extract @mentions from text
   * Returns array of usernames (without @, lowercase)
   */
  private extractMentions(text: string): string[] {
    if (!text) return [];

    // Match @username (letters, numbers, underscores)
    // Exclude @ symbols inside words (like email addresses)
    const mentionRegex = /(?:^|[^\w])@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1].toLowerCase();
      // Avoid duplicates
      if (!mentions.includes(username)) {
        mentions.push(username);
      }
    }

    return mentions;
  }

  /**
   * Delete all tags associated with a comment or reply
   * Used when deleting comments/replies to clean up orphaned tags
   */
  async deleteTagsByTarget(
    targetType: 'comment' | 'reply',
    targetId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('target_type', targetType)
        .eq('target_id', targetId);

      if (error) {
        console.error('[TagsService] Error deleting tags:', error);
        throw error;
      }

      console.log(`[TagsService] Deleted tags for ${targetType} ${targetId}`);
    } catch (err) {
      console.error('[TagsService] Exception in deleteTagsByTarget:', err);
      throw err;
    }
  }

  /**
   * Delete a specific tag
   */
  async deleteTag(tagId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('tagger_id', user.id);

    if (error) throw error;
  }

  /**
   * Delete all tags for a post (used when untagging all)
   */
  async deletePostTags(postId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .eq('tagger_id', user.id);

    if (error) throw error;
  }

  /**
   * Update tag status when post visibility changes
   * Use this when archiving/unarchiving a post to update all associated tags
   */
  async updateTagsStatus(postId: string, status: 'public' | 'archived'): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const { error } = await supabase
      .from('tags')
      .update({ status })
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .eq('tagger_id', user.id);

    if (error) throw error;
  }
}