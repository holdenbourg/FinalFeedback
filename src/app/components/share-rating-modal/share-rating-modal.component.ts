import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationsService, ConversationModel } from '../../services/conversations.service';
import { UsersService } from '../../services/users.service';
import { RatingModel } from '../../models/database-models/rating.model';

interface ShareTarget {
  id: string;
  type: 'conversation' | 'user';
  name: string;
  avatar: string;
  subtitle?: string;  // For users: username, for convos: "Group chat" or "Direct message"
  isGroup?: boolean;
  lastActivity?: Date;
}

@Component({
  selector: 'app-share-rating-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-rating-modal.component.html',
  styleUrl: './share-rating-modal.component.css'
})
export class ShareRatingModalComponent implements OnInit {
  @Input() rating!: RatingModel;
  @Output() cancel = new EventEmitter<void>();
  @Output() share = new EventEmitter<{ conversationIds: string[], userIds: string[], message?: string }>();

  constructor(
    private conversationsService: ConversationsService,
    private usersService: UsersService
  ) {}

  // State
  searchTerm = '';
  isLoading = signal(false);
  selectedTargets = signal<Set<string>>(new Set());
  messageText = '';

  // Data
  conversations = signal<ConversationModel[]>([]);
  followers = signal<any[]>([]);
  following = signal<any[]>([]);

  // Computed
  get selectedCount(): number {
    return this.selectedTargets().size;
  }

  get shareTargets(): ShareTarget[] {
    const targets: ShareTarget[] = [];
    const search = this.searchTerm.toLowerCase();

    // ✅ Section 1: Recent Conversations (sorted by activity)
    const recentConvos = this.conversations()
      .filter(c => !search || c.display_name?.toLowerCase().includes(search))
      .map(c => ({
        id: c.id,
        type: 'conversation' as const,
        name: c.display_name || 'Direct Message',
        avatar: c.group_avatar_url || '/assets/images/default-avatar.png',
        subtitle: c.is_group ? 'Group chat' : 'Direct message',
        isGroup: c.is_group,
        lastActivity: c.last_message?.created_at || c.created_at
      }));

    targets.push(...recentConvos);

    // ✅ Section 2: Following (users you follow)
    const followingUsers = this.following()
      .filter(u => !search || u.username.toLowerCase().includes(search))
      .map(u => ({
        id: u.id,
        type: 'user' as const,
        name: u.username,
        avatar: u.profile_picture_url || '/assets/images/default-avatar.png',
        subtitle: u.username
      }));

    targets.push(...followingUsers);

    // ✅ Section 3: Followers
    const followerUsers = this.followers()
      .filter(u => !search || u.username.toLowerCase().includes(search))
      .filter(u => !this.following().some(f => f.id === u.id))  // Exclude if already in following
      .map(u => ({
        id: u.id,
        type: 'user' as const,
        name: u.username,
        avatar: u.profile_picture_url || '/assets/images/default-avatar.png',
        subtitle: u.username
      }));

    targets.push(...followerUsers);

    return targets;
  }

  get showCreateGroupButton(): boolean {
    // Show if 2+ users selected (not conversations)
    const selectedUsers = Array.from(this.selectedTargets())
      .filter(id => this.shareTargets.find(t => t.id === id && t.type === 'user'));
    return selectedUsers.length >= 2;
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      // Load conversations sorted by activity
      const convos = await this.conversationsService.getConversationsByActivity();
      this.conversations.set(convos);

      // Load followers and following
      const [followersData, followingData] = await Promise.all([
        this.usersService.getFollowers(),
        this.usersService.getFollowing()
      ]);

      this.followers.set(followersData);
      this.following.set(followingData);
    } catch (error) {
      console.error('Failed to load share data:', error);
    } finally {
      this.isLoading.set(false);
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

  getSectionTitle(index: number): string | null {
    if (index === 0 && this.conversations().length > 0) {
      return 'Recent Chats';
    }
    
    const convoCount = this.conversations().length;
    if (index === convoCount && this.following().length > 0) {
      return 'Following';
    }
    
    const followingCount = this.following().length;
    if (index === convoCount + followingCount && this.followers().length > 0) {
      return 'Followers';
    }
    
    return null;
  }

  async onShare() {
    const selected = Array.from(this.selectedTargets());
    const conversationIds = selected.filter(id => 
      this.shareTargets.find(t => t.id === id && t.type === 'conversation')
    );
    const userIds = selected.filter(id => 
      this.shareTargets.find(t => t.id === id && t.type === 'user')
    );

    this.share.emit({
      conversationIds,
      userIds,
      message: this.messageText.trim() || undefined
    });
  }

  async onCreateGroupAndShare() {
    // Get selected user IDs
    const userIds = Array.from(this.selectedTargets())
      .filter(id => this.shareTargets.find(t => t.id === id && t.type === 'user'));

    if (userIds.length < 2) return;

    // For now, just emit as user IDs - parent component will handle group creation
    this.share.emit({
      conversationIds: [],
      userIds,
      message: this.messageText.trim() || undefined
    });
  }

  onCancel() {
    this.cancel.emit();
  }
}