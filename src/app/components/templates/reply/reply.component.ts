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
}
