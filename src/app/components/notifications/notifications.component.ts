import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationsService } from '../../services/notifications.service';
import { GroupedNotification, NotificationType } from '../../models/database-models/notification.model';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { supabase } from '../../core/supabase.client';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent implements OnInit {
  readonly notificationsService = inject(NotificationsService);
  readonly routingService = inject(RoutingService);
  readonly sidebarService = inject(SidebarService);
  private router = inject(Router);

  readonly grouped = this.notificationsService.grouped;
  readonly loading = this.notificationsService.loading;
  readonly hasMore = this.notificationsService.hasMore;

  async ngOnInit(): Promise<void> {
    await this.notificationsService.loadInitial();
    setTimeout(() => this.notificationsService.markAllRead(), 1500);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 300;
    if (nearBottom && this.hasMore() && !this.loading()) {
      this.notificationsService.loadMore();
    }
  }

  async navigateFromNotification(group: GroupedNotification): Promise<void> {
    const n = group.representative;
    const meta = n.metadata;

    // 1. Message notifications → open specific conversation
    if (n.type === NotificationType.MESSAGE_SENT ||
        n.type === NotificationType.MESSAGE_REPLIED ||
        n.type === NotificationType.MESSAGE_SHARED_RATING) {
      if (meta.conversation_id) {
        this.routingService.navigateToMessagesConversation(meta.conversation_id);
      } else {
        this.routingService.navigateToMessages();
      }
      return;
    }

    // 2. Follow notifications → navigate to actor's profile
    if (n.type === NotificationType.STARTED_FOLLOWING ||
        n.type === NotificationType.REQUESTED_FOLLOW ||
        n.type === NotificationType.ACCEPTED_FOLLOW_REQUEST) {
      const username = group.actors[0]?.username;
      if (username) {
        this.routingService.navigateToAccountsPosts(username);
      }
      return;
    }

    // 3. Rating notifications → look up post by rating_id, open on actor's account
    if (n.type === NotificationType.RATED_TITLE ||
        n.type === NotificationType.RERATED_TITLE) {
      const actorUsername = group.actors[0]?.username;
      if (actorUsername && n.rating_id) {
        const postId = await this.resolvePostIdFromRating(n.rating_id);
        if (postId) {
          this.routingService.navigateToAccountPost(actorUsername, postId);
          return;
        }
      }
      // Fallback: just go to actor's profile
      if (actorUsername) {
        this.routingService.navigateToAccountsPosts(actorUsername);
      }
      return;
    }

    // 4. Any notification with comment_id + post_id → open post + highlight comment
    if (n.comment_id && n.post_id) {
      const username = meta.author_username || await this.resolvePostAuthorUsername(n.post_id);
      if (username) {
        this.routingService.navigateToAccountPostComment(username, n.post_id, n.comment_id);
        return;
      }
    }

    // 5. Any notification with post_id → open post modal
    if (n.post_id) {
      const username = meta.author_username || await this.resolvePostAuthorUsername(n.post_id);
      if (username) {
        this.routingService.navigateToAccountPost(username, n.post_id);
        return;
      }
    }

    // 6. Fallback
    this.routingService.navigateToHome();
  }

  navigateToActor(group: GroupedNotification, event: Event): void {
    event.stopPropagation();
    const username = group.actors[0]?.username;
    if (username) {
      this.routingService.navigateToAccountsPosts(username);
    }
  }

  deleteNotification(group: GroupedNotification, event: Event): void {
    event.stopPropagation();
    this.notificationsService.deleteNotification(group.representative.id);
  }

  clearAll(): void {
    this.notificationsService.deleteAllNotifications();
  }

  buildActorStr(group: GroupedNotification): string {
    return this.notificationsService.buildActorStr(group);
  }

  buildActionText(group: GroupedNotification): string {
    return this.notificationsService.buildActionText(group);
  }

  trackGroup = (_: number, g: GroupedNotification) => g.groupKey;

  private async resolvePostAuthorUsername(postId: string): Promise<string | undefined> {
    const { data: post } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();
    if (!post?.author_id) return undefined;
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('id', post.author_id)
      .single();
    return user?.username;
  }

  private async resolvePostIdFromRating(ratingId: string): Promise<string | undefined> {
    const { data: post } = await supabase
      .from('posts')
      .select('id')
      .eq('rating_id', ratingId)
      .limit(1)
      .maybeSingle();
    return post?.id;
  }

  formatTimestamp(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    const diffW = Math.floor(diffD / 7);
    if (diffW < 4) return `${diffW}w`;
    return new Date(iso).toLocaleDateString();
  }
}
