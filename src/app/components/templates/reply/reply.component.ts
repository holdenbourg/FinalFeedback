import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { LikesService } from '../../../services/likes.service';

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
};

@Component({
  selector: 'app-reply',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reply.component.html',
  styleUrls: ['./reply.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class ReplyComponent implements OnInit {
  @Input() reply!: FeedUiReply;
  @Input() parentCommentId!: string;

  @Input() initiallyLiked?: boolean;
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

  private likesService = inject(LikesService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  meLiked = false;
  submittingLike = false;

  async ngOnInit() {
    if (typeof this.initiallyLiked === 'boolean') {
      this.meLiked = this.initiallyLiked;

    } else {
      try {
        this.meLiked = await this.likesService.isLiked('reply', this.reply.replyId);

      } catch { }
    }

    this.likeChanged.subscribe((e) => this.likeToggled.emit(e));
  }

  async toggleLike() {
    if (this.submittingLike) return;
    this.submittingLike = true;

    const next = !this.meLiked;
    const prevCount = this.reply.likeCount ?? 0;

    this.meLiked = next;
    this.reply.likeCount = prevCount + (next ? 1 : -1);

    try {
      await this.likesService.toggleLike('reply', this.reply.replyId, next);

      this.likeChanged.emit({
        replyId: this.reply.replyId,
        parentCommentId: this.parentCommentId,
        liked: next,
        likeCount: this.reply.likeCount ?? 0,
      });

    } catch {
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

  requestReply() {
    this.replyRequested.emit({
      commentId: this.parentCommentId,
      replyingToUsername: this.reply.username,
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