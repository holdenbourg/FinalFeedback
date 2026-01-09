import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from '@angular/core';
import { LikesService } from '../../../services/likes.service';
import { CommentModerationService, MentionToken } from '../../../services/comment-moderation.service';
import { UsersService } from '../../../services/users.service';

export type FeedUiComment = {
  commentId: string;
  username: string;
  profilePicture: string;
  comment: string;
  likes: string[];
  likeCount?: number;
  commentDate: string;
  author_id?: string;
  isLikedByCurrentUser?: boolean;
};

@Component({
  selector: 'app-comment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class CommentComponent implements OnInit {
  @Input() comment!: FeedUiComment;
  @Input() currentUserId?: string;

  @Output() replyRequested = new EventEmitter<{ commentId: string; replyingToUsername: string }>();
  @Output() likeChanged = new EventEmitter<{ commentId: string; liked: boolean; likeCount: number }>();
  @Output() likeToggled = new EventEmitter<{ commentId: string; liked: boolean; likeCount: number }>();
  @Output() deleteRequested = new EventEmitter<string>();

  private likesService = inject(LikesService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  private commentModerationService = inject(CommentModerationService);

  meLiked = false;
  submittingLike = false;
  showMenu = false;

  async ngOnInit() {
    // If likeCount already set by parent, skip loading
    if (this.comment.likeCount === undefined) {
      await this.refreshLikeCount();
    }
    
    // If liked status already set by parent, use it; otherwise load
    if (this.comment.isLikedByCurrentUser !== undefined) {
      this.meLiked = this.comment.isLikedByCurrentUser;
    } else {
      try {
        this.meLiked = await this.likesService.isLiked('comment', this.comment.commentId);
      } catch { }
    }
    
    this.likeChanged.subscribe(e => this.likeToggled.emit(e));
  }

  private async refreshLikeCount() {
    try {
      this.comment.likeCount = await this.likesService.count('comment', this.comment.commentId);
      this.changeDetectorRef.markForCheck();
    } catch (err) {
      console.error('Error refreshing like count:', err);
    }
  }

  async toggleLike() {
    if (this.submittingLike) return;
    this.submittingLike = true;

    const next = !this.meLiked;
    const prev = this.comment.likeCount ?? 0;

    // Optimistic update
    this.meLiked = next;
    this.comment.likeCount = prev + (next ? 1 : -1);

    try {
      await this.likesService.toggleLike('comment', this.comment.commentId, next);
      
      // Refresh from database to ensure accuracy
      await this.refreshLikeCount();
      
      this.likeChanged.emit({ 
        commentId: this.comment.commentId, 
        liked: next, 
        likeCount: this.comment.likeCount ?? 0 
      });

    } catch {
      // Revert on error
      this.meLiked = !next;
      this.comment.likeCount = prev;

    } finally {
      this.submittingLike = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  requestReply() {
    this.replyRequested.emit({
      commentId: this.comment.commentId,
      replyingToUsername: this.comment.username,
    });
  }

  likeComment() { 
    this.toggleLike(); 
  }

  tokensOf(text: string | null | undefined): MentionToken[] {
    return this.commentModerationService.tokenizeMentions(text);
  }

    // ✅ NEW: Check if current user can delete
  canDelete(): boolean {
    return this.currentUserId === this.comment.author_id;
  }

  // ✅ NEW: Toggle menu
  toggleMenu() {
    this.showMenu = !this.showMenu;
    this.changeDetectorRef.markForCheck();
  }

  // ✅ NEW: Close menu when clicking outside
  @HostListener('document:click')
  closeMenu() {
    if (this.showMenu) {
      this.showMenu = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  // ✅ NEW: Handle delete
  onDelete() {
    this.showMenu = false;
    this.deleteRequested.emit(this.comment.commentId);
  }


  /// ---------------------------------------- Formatting ---------------------------------------- \\\
  formatDate(isoDate?: string): string {
    if (!isoDate) return '';
    
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return '';
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      // Add time formatting
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      
      return `${month} ${day}, ${year} at ${hours}:${minutesStr} ${ampm}`;
    } catch {
      return '';
    }
  }
}