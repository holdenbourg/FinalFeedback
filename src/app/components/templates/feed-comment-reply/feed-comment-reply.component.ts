import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AccountInformationModel } from '../../../models/database-models/account-information-model';
import { ReplyModel } from '../../../models/database-models/reply-model';
import { LocalStorageService } from '../../../services/local-storage.service';
import { RepliesService } from '../../../services/replies.service';
import { CommentModerationService } from '../../../services/comment-moderation.service';

@Component({
  selector: 'app-feed-comment-reply',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feed-comment-reply.component.html',
  styleUrls: ['./feed-comment-reply.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class FeedCommentReplyComponent implements OnInit, OnChanges {
  private readonly localStorageService = inject(LocalStorageService);
  readonly commentModerationService = inject(CommentModerationService);
  readonly repliesService = inject(RepliesService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() reply!: ReplyModel;
  @Output() replyRequested = new EventEmitter<{ postId: string; commentId: string; username: string }>();

  currentUser!: AccountInformationModel;
  mentionHtml!: SafeHtml;

  ngOnInit() {
    this.currentUser = this.localStorageService.getInformation('current-user')!;
    this.mentionHtml = this.renderWithMentions(this.reply?.comment ?? '');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['reply'] && this.reply) {
      this.mentionHtml = this.renderWithMentions(this.reply.comment ?? '');
    }
  }


  /// ---------------------------------------- Actions ---------------------------------------- \\\
  toggleReplyLike() {
    this.reply = this.repliesService.toggleReplyLike(this.currentUser.username, this.reply);
  }

  onReply() {
    this.replyRequested.emit({
      postId: this.reply.postId,
      commentId: this.reply.commentId,
      username: this.reply.username,
    });
  }
  
  tokensOf(s: string | null | undefined) { 
    return this.commentModerationService.tokenizeMentions(s); 
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

  private renderWithMentions(text: string): SafeHtml {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');

    const escaped = esc(text);

    ///  Replace @mentions with anchors to /account/<user>/posts  \\\
    const withMentions = escaped.replace(/\B@([A-Za-z0-9_]+)/g, (_m, user: string) => {
      const href = `/account/${user}/posts`;
      return `<a href="${href}" style="font-weight:600;cursor:pointer;text-decoration:none;color:#fff">@${user}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(withMentions);
  }
}
