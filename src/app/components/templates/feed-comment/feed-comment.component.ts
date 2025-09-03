import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { AccountInformationModel } from '../../../models/database-models/account-information-model';
import { CommentModel } from '../../../models/database-models/comment-model';
import { ReplyModel } from '../../../models/database-models/reply-model';
import { LocalStorageService } from '../../../services/local-storage.service';
import { RepliesDatabase } from '../../../databases/replies-database';
import { CommentsService } from '../../../services/comments.service';
import { RepliesService } from '../../../services/replies.service';
import { FeedCommentReplyComponent } from '../feed-comment-reply/feed-comment-reply.component';
import { filter, Subject, takeUntil } from 'rxjs';
import { CommentModerationService } from '../../../services/comment-moderation.service';

@Component({
  selector: 'app-feed-comment',
  standalone: true,
  imports: [CommonModule, FeedCommentReplyComponent],
  templateUrl: './feed-comment.component.html',
  styleUrls: ['./feed-comment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class FeedCommentComponent implements OnInit, OnDestroy {
  @Input() comment!: CommentModel;
  @Output() replyRequested = new EventEmitter<{ postId: string; commentId: string; username: string }>();

  private destroy$ = new Subject<void>();

  private readonly localStorageService = inject(LocalStorageService);
  private readonly repliesDatabase = inject(RepliesDatabase);
  private readonly repliesService = inject(RepliesService);
  readonly commentsService: CommentsService = inject(CommentsService);
  readonly commentModerationService = inject(CommentModerationService);
  private readonly changeDirectoryReference = inject(ChangeDetectorRef);

  currentUser!: AccountInformationModel;
  replies: ReplyModel[] = [];

  ngOnInit(): void {
    this.currentUser = this.localStorageService.getInformation('current-user')!;
    this.replies = this.repliesDatabase.getAllRepliesByCommentId(this.comment.commentId);

    this.repliesService.replyChanged$
      .pipe(
        takeUntil(this.destroy$),
        filter(ev => ev.commentId === this.comment.commentId)
      )
      .subscribe(ev => {
        ///  refresh replies \\\
        this.replies = this.repliesDatabase.getAllRepliesByCommentId(this.comment.commentId);
        this.changeDirectoryReference.markForCheck();

        setTimeout(() => {
          if (!ev.replyId) return;
          const el = document.getElementById('r-' + ev.replyId);
          if (!el) return;

          const box = el.closest('.comment-scroll-box') as HTMLElement | null;
          if (box) {
            const boxRect = box.getBoundingClientRect();
            const elRect  = el.getBoundingClientRect();
            const relTop  = (elRect.top - boxRect.top) + box.scrollTop;
            const destTop = relTop - (box.clientHeight / 2 - el.clientHeight / 2);

            box.scrollTo({ top: destTop, behavior: 'smooth' });
          } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          el.classList.add('just-posted');
          setTimeout(() => el.classList.remove('just-posted'), 2400);
        }, 0);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  

  /// ---------------------------------------- Actions ---------------------------------------- \\\
  toggleCommentLike() {
    this.comment = this.commentsService.toggleCommentLike(this.currentUser.username, this.comment);
  }

  onReply() {
    this.repliesService.setReplyContext(this.comment.postId, this.comment.commentId, this.comment.username);
    this.replyRequested.emit();
  }

  onReplyRequested(e: { postId: string; commentId: string; username: string }) {
    this.repliesService.setReplyContext(e.postId, e.commentId, e.username);
    this.replyRequested.emit();
  }

  ///  generates account link for atted users (@JohnDoe)  \\\
  tokensOf(comment: string | null | undefined) {
    return this.commentModerationService.tokenizeMentions(comment);
  }


  /// ---------------------------------------- Formatting ---------------------------------------- \\\
  formatDate(date?: string): string {
    if (!date) return '';

    const [y, m, d] = date.split('-');

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = monthNames[(+m || 1) - 1] ?? '';
    const day = (d ?? '').startsWith('0') ? (d ?? '').slice(1) : d ?? '';

    return `${month} ${day}, ${y}`;
  }

  trackReply = (_: number, r: ReplyModel) => r.replyId;
}
