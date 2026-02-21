import { Injectable, signal } from '@angular/core';
import { supabase } from '../core/supabase.client';
import {
  NotificationModel,
  NotificationType,
  GroupedNotification,
  NotificationMetadata,
} from '../models/database-models/notification.model';

const GROUPABLE_TYPES = new Set<NotificationType>([
  NotificationType.LIKED_POST,
  NotificationType.LIKED_COMMENT,
  NotificationType.LIKED_REPLY,
  NotificationType.COMMENTED_ON_POST,
]);

const PAGE_SIZE = 30;

const SELECT_QUERY = `
  id, recipient_id, actor_id, type,
  post_id, comment_id, rating_id,
  metadata, read, created_at,
  actor:users!notifications_actor_id_fkey (
    id, username, profile_picture_url
  )
`;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  readonly unreadCount   = signal<number>(0);
  readonly notifications = signal<NotificationModel[]>([]);
  readonly grouped       = signal<GroupedNotification[]>([]);
  readonly loading       = signal<boolean>(false);
  readonly hasMore       = signal<boolean>(true);

  private realtimeChannel: any = null;
  private currentUserId: string | null = null;
  private offset = 0;

  // =========================================================
  // INITIALIZE
  // =========================================================

  async initialize(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    this.currentUserId = user.id;

    await Promise.all([
      this.loadInitial(),
      this.refreshUnreadCount(),
    ]);

    this.subscribeToRealtime();
  }

  // =========================================================
  // FETCH
  // =========================================================

  async loadInitial(): Promise<void> {
    this.offset = 0;
    this.loading.set(true);
    try {
      const rows = await this.fetchPage(0);
      this.notifications.set(rows);
      this.grouped.set(this.buildGroups(rows));
      this.offset = rows.length;
      this.hasMore.set(rows.length === PAGE_SIZE);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.hasMore() || this.loading()) return;
    this.loading.set(true);
    try {
      const rows = await this.fetchPage(this.offset);
      const all = [...this.notifications(), ...rows];
      this.notifications.set(all);
      this.grouped.set(this.buildGroups(all));
      this.offset += rows.length;
      this.hasMore.set(rows.length === PAGE_SIZE);
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchPage(offset: number): Promise<NotificationModel[]> {
    if (!this.currentUserId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select(SELECT_QUERY)
      .eq('recipient_id', this.currentUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[NotificationsService] fetchPage error:', error);
      return [];
    }

    return (data ?? []) as unknown as NotificationModel[];
  }

  // =========================================================
  // UNREAD COUNT
  // =========================================================

  async refreshUnreadCount(): Promise<void> {
    if (!this.currentUserId) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', this.currentUserId)
      .eq('read', false);

    if (!error) {
      this.unreadCount.set(count ?? 0);
    }
  }

  // =========================================================
  // MARK READ
  // =========================================================

  async markRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('recipient_id', this.currentUserId!);

    if (!error) {
      this.notifications.update(list =>
        list.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      this.grouped.set(this.buildGroups(this.notifications()));
      this.unreadCount.update(c => Math.max(0, c - 1));
    }
  }

  async markAllRead(): Promise<void> {
    if (!this.currentUserId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', this.currentUserId)
      .eq('read', false);

    if (!error) {
      this.notifications.update(list => list.map(n => ({ ...n, read: true })));
      this.grouped.set(this.buildGroups(this.notifications()));
      this.unreadCount.set(0);
    }
  }

  // =========================================================
  // CREATE (called from other services)
  // =========================================================

  async create(params: {
    recipientId: string;
    type: NotificationType;
    postId?: string;
    commentId?: string;
    ratingId?: string;
    metadata?: NotificationMetadata;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id === params.recipientId) return;

    const { error } = await supabase.rpc('create_notification', {
      p_recipient_id : params.recipientId,
      p_actor_id     : user.id,
      p_type         : params.type,
      p_post_id      : params.postId      ?? null,
      p_comment_id   : params.commentId   ?? null,
      p_rating_id    : params.ratingId    ?? null,
      p_metadata     : params.metadata    ?? {},
    });

    if (error) {
      console.error('[NotificationsService] create error:', error);
    }
  }

  async createForFollowers(params: {
    type: NotificationType;
    postId?: string;
    commentId?: string;
    ratingId?: string;
    metadata?: NotificationMetadata;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('create_notification_for_followers', {
      p_actor_id     : user.id,
      p_type         : params.type,
      p_post_id      : params.postId      ?? null,
      p_comment_id   : params.commentId   ?? null,
      p_rating_id    : params.ratingId    ?? null,
      p_metadata     : params.metadata    ?? {},
    });

    if (error) {
      console.error('[NotificationsService] createForFollowers error:', error);
    }
  }

  // =========================================================
  // REALTIME
  // =========================================================

  private subscribeToRealtime(): void {
    if (this.realtimeChannel) return;

    this.realtimeChannel = supabase
      .channel(`notifications:${this.currentUserId}`)
      .on(
        'postgres_changes',
        {
          event  : 'INSERT',
          schema : 'public',
          table  : 'notifications',
          filter : `recipient_id=eq.${this.currentUserId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('notifications')
            .select(SELECT_QUERY)
            .eq('id', payload.new['id'])
            .single();

          if (data) {
            const newNotif = data as unknown as NotificationModel;
            this.notifications.update(list => [newNotif, ...list]);
            this.grouped.set(this.buildGroups(this.notifications()));
            this.unreadCount.update(c => c + 1);
          }
        }
      )
      .subscribe();
  }

  unsubscribe(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  // =========================================================
  // GROUPING
  // =========================================================

  buildGroups(notifications: NotificationModel[]): GroupedNotification[] {
    const groupMap = new Map<string, GroupedNotification>();

    for (const n of notifications) {
      const groupKey = this.groupKeyFor(n);

      if (groupMap.has(groupKey)) {
        const group = groupMap.get(groupKey)!;
        if (n.actor && !group.actors.find(a => a.id === n.actor_id)) {
          group.actors.push(n.actor);
          group.totalActorCount++;
        }
        if (!n.read) group.allRead = false;
        if (n.created_at > group.latestAt) {
          group.latestAt = n.created_at;
          group.representative = n;
        }
      } else {
        groupMap.set(groupKey, {
          groupKey,
          type            : n.type,
          actors          : n.actor ? [n.actor] : [],
          totalActorCount : 1,
          representative  : n,
          allRead         : n.read,
          latestAt        : n.created_at,
        });
      }
    }

    return Array.from(groupMap.values())
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }

  private groupKeyFor(n: NotificationModel): string {
    if (!GROUPABLE_TYPES.has(n.type)) {
      return n.id;
    }
    const target = n.comment_id ?? n.post_id ?? n.rating_id ?? 'none';
    return `${n.type}:${target}`;
  }

  // =========================================================
  // DISPLAY TEXT
  // =========================================================

  buildDisplayText(group: GroupedNotification): string {
    const actorStr = this.buildActorStr(group);
    return `${actorStr} ${this.buildActionText(group)}`;
  }

  buildActionText(group: GroupedNotification): string {
    const n    = group.representative;
    const meta = n.metadata;

    switch (n.type) {
      case NotificationType.LIKED_POST:
        return 'liked your post';
      case NotificationType.LIKED_COMMENT:
        return 'liked your comment';
      case NotificationType.LIKED_REPLY:
        return 'liked your reply';
      case NotificationType.COMMENTED_ON_POST:
        return 'commented on your post';
      case NotificationType.REPLIED_TO_COMMENT:
        return 'replied to your comment';
      case NotificationType.REPLIED_TO_COMMENT_ON_POST:
        return 'replied to a comment on your post';
      case NotificationType.COMMENT_ON_TAGGED_POST:
        return "commented on a rating you're tagged in";
      case NotificationType.TAGGED_IN_POST:
        return meta.rating_title
          ? `tagged you in their ${meta.rating_title} rating`
          : 'tagged you in a post';
      case NotificationType.TAGGED_IN_COMMENT:
        return 'tagged you in a comment';
      case NotificationType.TAGGED_IN_REPLY:
        return 'tagged you in a reply';
      case NotificationType.MESSAGE_SENT:
        return 'sent you a message';
      case NotificationType.MESSAGE_SHARED_RATING:
        return meta.rating_title
          ? `shared a ${meta.rating_title} rating with you`
          : 'shared a rating with you';
      case NotificationType.MESSAGE_REPLIED:
        return 'replied to a message';
      case NotificationType.STARTED_FOLLOWING:
        return 'started following you';
      case NotificationType.REQUESTED_FOLLOW:
        return 'requested to follow you';
      case NotificationType.ACCEPTED_FOLLOW_REQUEST:
        return 'accepted your follow request';
      case NotificationType.RATED_TITLE:
        return `rated ${meta.rating_title} a ${meta.rating_value}`;
      case NotificationType.RERATED_TITLE:
        return `re-rated ${meta.rating_title} a ${meta.rating_value}`;
      default:
        return 'interacted with your content';
    }
  }

  buildActorStr(group: GroupedNotification): string {
    const actors = group.actors;
    const count  = group.totalActorCount;
    return count === 1
      ? actors[0]?.username ?? 'Someone'
      : `${actors[0]?.username} and ${count - 1} other${count - 1 > 1 ? 's' : ''}`;
  }

  // =========================================================
  // DELETE
  // =========================================================

  async deleteNotification(notificationId: string): Promise<void> {
    if (!this.currentUserId) return;

    // Check if unread before deleting (to update count)
    const notif = this.notifications().find(n => n.id === notificationId);
    const wasUnread = notif && !notif.read;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', this.currentUserId);

    if (!error) {
      this.notifications.update(list => list.filter(n => n.id !== notificationId));
      this.grouped.set(this.buildGroups(this.notifications()));
      if (wasUnread) {
        this.unreadCount.update(c => Math.max(0, c - 1));
      }
    }
  }

  async deleteAllNotifications(): Promise<void> {
    if (!this.currentUserId) return;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', this.currentUserId);

    if (!error) {
      this.notifications.set([]);
      this.grouped.set([]);
      this.unreadCount.set(0);
      this.hasMore.set(false);
    }
  }
}
