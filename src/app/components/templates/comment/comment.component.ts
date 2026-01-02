import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { LikesService } from '../../../services/likes.service';

export type FeedUiComment = {
  commentId: string;
  username: string;
  profilePicture: string;
  comment: string;
  likes: string[];
  likeCount?: number;
  commentDate: string;
  author_id?: string;
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

  @Output() replyRequested = new EventEmitter<{ commentId: string; replyingToUsername: string }>();

  @Output() likeChanged = new EventEmitter<{ commentId: string; liked: boolean; likeCount: number }>();
  @Output() likeToggled = new EventEmitter<{ commentId: string; liked: boolean; likeCount: number }>();

  private likes = inject(LikesService);
  private cdr = inject(ChangeDetectorRef);

  meLiked = false;
  submittingLike = false;

  async ngOnInit() {
    try {
      this.meLiked = await this.likes.isLiked('comment', this.comment.commentId);

    } catch { }

    this.likeChanged.subscribe(e => this.likeToggled.emit(e));
  }

  async toggleLike() {
    if (this.submittingLike) return;
    this.submittingLike = true;

    const next = !this.meLiked;
    const prev = this.comment.likeCount ?? 0;

    this.meLiked = next;
    this.comment.likeCount = prev + (next ? 1 : -1);

    try {
      await this.likes.toggleLike('comment', this.comment.commentId, next);
      this.likeChanged.emit({ commentId: this.comment.commentId, liked: next, likeCount: this.comment.likeCount ?? 0 });

    } catch {
      this.meLiked = !next;
      this.comment.likeCount = prev;

    } finally {
      this.submittingLike = false;
      this.cdr.markForCheck();
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