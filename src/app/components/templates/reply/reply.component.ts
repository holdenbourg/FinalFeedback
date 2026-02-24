import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LikesService } from '../../../services/likes.service';
import { CommentModerationService, MentionToken } from '../../../services/comment-moderation.service';

export type FeedUiReply = {
  replyId: string;
  username: string;
  replyingToUsername: string;
  profilePicture: string;
  comment: string;
  likes: string[];
  likeCount?: number;
  commentDate: string;
  author_id?: string;
  isLikedByCurrentUser?: boolean;  // ← ADD THIS
};

@Component({
  selector: 'app-reply',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reply.component.html',
  styleUrls: ['./reply.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class ReplyComponent implements OnInit {
  @Input() reply!: FeedUiReply;
  @Input() parentCommentId!: string;
  @Input() initiallyLiked?: boolean;
  @Input() currentUserId?: string;  // ← ADD THIS

  @Output() likeChanged = new EventEmitter<{
    replyId: string;
    parentCommentId: string;
    liked: boolean;
    likeCount: number;
  }>();
  @Output() likeToggled = new EventEmitter<{
    replyId: string;
    parentCommentId: string;
    liked: boolean;
    likeCount: number;
  }>();
  @Output() replyRequested = new EventEmitter<{ 
    commentId: string; 
    replyingToUsername: string;
  }>();
  @Output() deleteRequested = new EventEmitter<{ replyId: string; parentCommentId: string }>();


  private likesService = inject(LikesService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  private commentModerationService = inject(CommentModerationService);

  meLiked = false;
  submittingLike = false;
  showMenu = false;

  async ngOnInit() {
    // If likeCount already set by parent, skip loading
    if (this.reply.likeCount === undefined) {
      await this.refreshLikeCount();
    }
    
    // If liked status already set by parent, use it; otherwise load
    if (this.reply.isLikedByCurrentUser !== undefined) {
      this.meLiked = this.reply.isLikedByCurrentUser;
    } else {
      try {
        this.meLiked = await this.likesService.isLiked('comment', this.reply.replyId);
      } catch { }
    }
    
    this.likeChanged.subscribe(e => this.likeToggled.emit(e));
  }

  private async refreshLikeCount() {
    try {
      this.reply.likeCount = await this.likesService.count('reply', this.reply.replyId);
      this.changeDetectorRef.markForCheck();
    } catch (err) {
      console.error('Error refreshing like count:', err);
    }
  }

  async toggleLike() {
    if (this.submittingLike) return;
    this.submittingLike = true;

    const next = !this.meLiked;
    const prevCount = this.reply.likeCount ?? 0;

    // Optimistic update
    this.meLiked = next;
    this.reply.likeCount = prevCount + (next ? 1 : -1);

    try {
      await this.likesService.toggleLike('reply', this.reply.replyId, next);
      
      // Refresh from database
      await this.refreshLikeCount();

      this.likeChanged.emit({
        replyId: this.reply.replyId,
        parentCommentId: this.parentCommentId,
        liked: next,
        likeCount: this.reply.likeCount ?? 0,
      });

    } catch {
      // Revert on error
      this.meLiked = !next;
      this.reply.likeCount = prevCount;

    } finally {
      this.submittingLike = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  likeReply() {
    this.toggleLike();
  }

  tokensOf(text: string | null | undefined): MentionToken[] {
    return this.commentModerationService.tokenizeMentions(text);
  }

  requestReply() {
    this.replyRequested.emit({
      commentId: this.parentCommentId,
      replyingToUsername: this.reply.username,
    });
  }

    canDelete(): boolean {
    return this.currentUserId === this.reply.author_id;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
    this.changeDetectorRef.markForCheck();
  }

  @HostListener('document:click')
  closeMenu() {
    if (this.showMenu) {
      this.showMenu = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  onDelete() {
    this.showMenu = false;
    this.deleteRequested.emit({
      replyId: this.reply.replyId,
      parentCommentId: this.parentCommentId
    });
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