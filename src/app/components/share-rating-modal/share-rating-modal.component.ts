import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { ConversationsService, ConversationModel } from '../../services/conversations.service';
import { UsersService } from '../../services/users.service';
import { MessagesService } from '../../services/messages.service';
import { RatingModel } from '../../models/database-models/rating.model';
import { supabase } from '../../core/supabase.client';

interface ShareTarget {
  id: string;
  type: 'conversation' | 'user';
  name: string;
  avatar: string;
  subtitle?: string;
}

@Component({
  selector: 'app-share-rating-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-rating-modal.component.html',
  styleUrl: './share-rating-modal.component.css'
})
export class ShareRatingModalComponent implements OnInit, OnDestroy {
  @Input() rating!: RatingModel;
  @Output() cancel = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();

  constructor(
    private conversationsService: ConversationsService,
    private usersService: UsersService,
    private messagesService: MessagesService
  ) {}

  // State
  searchTerm = '';
  messageText = '';
  isLoading = signal(true);
  isSending = signal(false);
  showSuccess = signal(false);
  isSearchMode = signal(false);
  isSearching = signal(false);
  shimmerCount = signal(0);

  // Selection
  selectedTargets = signal<Set<string>>(new Set());
  // Track type per target for send logic
  private targetTypeMap = new Map<string, 'conversation' | 'user'>();

  // Data
  private currentUserId: string | null = null;
  conversations = signal<ShareTarget[]>([]);
  suggestedUsers = signal<ShareTarget[]>([]);
  searchResults = signal<ShareTarget[]>([]);

  // All suggested for filtering
  private allSuggested: ShareTarget[] = [];
  private allConversations: ShareTarget[] = [];

  // Debounce
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  get selectedCount(): number {
    return this.selectedTargets().size;
  }

  async ngOnInit() {
    const { data: { user } } = await supabase.auth.getUser();
    this.currentUserId = user?.id || null;

    // Set up debounced database search
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        filter(term => term.length > 0)
      )
      .subscribe(term => this.performDatabaseSearch(term));

    await this.loadData();
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.searchSubject.complete();
  }

  private async loadData() {
    this.isLoading.set(true);
    try {
      // Load conversations
      const convos = await this.conversationsService.getConversationsByActivity();

      // Resolve DM participant names/avatars
      await this.resolveDmNames(convos);

      // Build conversation targets
      this.allConversations = convos.map(c => {
        this.targetTypeMap.set(c.id, 'conversation');
        const lastMsg = c.last_message?.content;
        return {
          id: c.id,
          type: 'conversation' as const,
          name: c.display_name || 'Direct Message',
          avatar: c.group_avatar_url || '/assets/images/default-avatar.png',
          subtitle: lastMsg || (c.is_group ? 'Group chat' : 'Direct message'),
        };
      });
      this.conversations.set(this.allConversations);

      // Load followers + following from follows table (same as add-chat-modal)
      const [followerRes, followingRes] = await Promise.all([
        supabase.from('follows').select('follower_id').eq('followee_id', this.currentUserId!),
        supabase.from('follows').select('followee_id').eq('follower_id', this.currentUserId!)
      ]);

      const userIds = new Set<string>();
      if (followerRes.data) {
        followerRes.data.forEach((f: any) => userIds.add(f.follower_id));
      }
      if (followingRes.data) {
        followingRes.data.forEach((f: any) => userIds.add(f.followee_id));
      }

      // Fetch user profiles
      const profiles = await Promise.all(
        Array.from(userIds).map(id => this.usersService.getUserProfileById(id))
      );

      const suggested: ShareTarget[] = [];
      for (const u of profiles) {
        if (u) {
          this.targetTypeMap.set(u.id, 'user');
          suggested.push({
            id: u.id,
            type: 'user',
            name: u.username,
            avatar: u.profile_picture_url || '/assets/images/default-avatar.png',
            subtitle: u.username,
          });
        }
      }

      this.allSuggested = suggested;
      this.suggestedUsers.set(suggested);
    } catch (error) {
      console.error('Failed to load share data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async resolveDmNames(convos: ConversationModel[]) {
    if (!this.currentUserId) return;

    const dmConvos = convos.filter(c => !c.is_group);
    if (dmConvos.length === 0) return;

    const { data: convoData } = await supabase
      .from('conversations')
      .select('id, participant_ids')
      .in('id', dmConvos.map(c => c.id));

    const otherUserIds: string[] = [];
    const convoParticipantMap = new Map<string, string>();

    for (const c of convoData || []) {
      const otherId = (c.participant_ids as string[]).find((id: string) => id !== this.currentUserId);
      if (otherId) {
        otherUserIds.push(otherId);
        convoParticipantMap.set(c.id, otherId);
      }
    }

    if (otherUserIds.length === 0) return;

    const { data: users } = await supabase
      .from('users')
      .select('id, username, profile_picture_url')
      .in('id', otherUserIds);

    const usersMap = new Map((users || []).map(u => [u.id, u]));

    for (const conv of convos) {
      if (!conv.is_group) {
        const otherId = convoParticipantMap.get(conv.id);
        if (otherId) {
          const otherUser = usersMap.get(otherId);
          if (otherUser) {
            conv.display_name = otherUser.username;
            conv.group_avatar_url = otherUser.profile_picture_url;
          }
        }
      }
    }
  }

  onSearchInput() {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      // Clear search mode - show conversations + suggested
      this.isSearchMode.set(false);
      this.searchResults.set([]);
      this.shimmerCount.set(0);
      this.isSearching.set(false);
      this.conversations.set(this.allConversations);
      this.suggestedUsers.set(this.allSuggested);
      return;
    }

    // Enter search mode
    this.isSearchMode.set(true);

    // Immediately filter conversations + suggested (instant feedback)
    const filteredConvos = this.allConversations.filter(c =>
      c.name.toLowerCase().includes(term)
    );
    const filteredSuggested = this.allSuggested.filter(u =>
      u.name.toLowerCase().includes(term)
    );

    this.searchResults.set([...filteredConvos, ...filteredSuggested]);

    // Show shimmer placeholders for incoming DB results
    this.shimmerCount.set(3);
    this.isSearching.set(true);

    // Trigger debounced database search
    this.searchSubject.next(term);
  }

  private async performDatabaseSearch(term: string) {
    if (!this.currentUserId) {
      this.shimmerCount.set(0);
      this.isSearching.set(false);
      return;
    }

    try {
      const dbUsers = await this.usersService.searchUsersExcludingBlockedAndSelf(
        term, this.currentUserId, 20, 0
      );

      // Re-filter with current term (may have changed during debounce)
      const currentTerm = this.searchTerm.trim().toLowerCase();
      const filteredConvos = this.allConversations.filter(c =>
        c.name.toLowerCase().includes(currentTerm)
      );
      const filteredSuggested = this.allSuggested.filter(u =>
        u.name.toLowerCase().includes(currentTerm)
      );

      // Filter out users already in suggested from DB results
      const existingIds = new Set([
        ...filteredConvos.map(c => c.id),
        ...filteredSuggested.map(u => u.id)
      ]);

      const otherUsers: ShareTarget[] = (dbUsers || [])
        .filter(u => !existingIds.has(u.id))
        .map(u => {
          this.targetTypeMap.set(u.id, 'user');
          return {
            id: u.id,
            type: 'user' as const,
            name: u.username,
            avatar: u.profile_picture_url || '/assets/images/default-avatar.png',
            subtitle: u.username,
          };
        });

      this.searchResults.set([...filteredConvos, ...filteredSuggested, ...otherUsers]);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      this.shimmerCount.set(0);
      this.isSearching.set(false);
    }
  }

  toggleSelection(targetId: string) {
    const current = new Set(this.selectedTargets());
    if (current.has(targetId)) {
      current.delete(targetId);
    } else {
      current.add(targetId);
    }
    this.selectedTargets.set(current);
  }

  isSelected(targetId: string): boolean {
    return this.selectedTargets().has(targetId);
  }

  getShimmerArray(): number[] {
    return Array(this.shimmerCount()).fill(0).map((_, i) => i);
  }

  async onShare() {
    const selected = Array.from(this.selectedTargets());
    const conversationIds = selected.filter(id => this.targetTypeMap.get(id) === 'conversation');
    const userIds = selected.filter(id => this.targetTypeMap.get(id) === 'user');

    this.isSending.set(true);
    try {
      for (const convId of conversationIds) {
        await this.messagesService.shareRating(convId, this.rating.id, this.messageText.trim() || undefined);
      }

      for (const userId of userIds) {
        const convId = await this.conversationsService.createDM(userId);
        await this.messagesService.shareRating(convId, this.rating.id, this.messageText.trim() || undefined);
      }

      this.isSending.set(false);
      this.showSuccess.set(true);
      setTimeout(() => this.share.emit(), 1000);
    } catch (error) {
      console.error('Failed to share rating:', error);
      this.isSending.set(false);
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
