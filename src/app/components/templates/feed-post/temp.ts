import { Component, Input, ViewChild, ElementRef, ChangeDetectorRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentComponent } from '../comment/comment.component';
import { ReplyComponent } from '../reply/reply.component';
import { CommentView, mapRowToView } from '../../../models/database-models/comment-model';
import { PostModelWithAuthor } from '../../../models/database-models/post-model';
import { CommentModerationService, CommentContext } from '../../../services/comment-moderation.service';
import { CommentsService } from '../../../services/comments.service';
import { LikesService } from '../../../services/likes.service';
import { ViewsService } from '../../../services/views.service';
import { TagsService } from '../../../services/tags.service';

type UiComment = {
  commentId: string;
  username: string;
  profilePicture: string;
  comment: string;
  likes: string[];
  likeCount?: number;
  commentDate: string;
  author_id?: string;
};

type UiReply = {
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
  selector: 'app-feed-post',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentComponent, ReplyComponent],
  templateUrl: './feed-post.component.html',
  styleUrls: ['./feed-post.component.css'],
})

export class FeedPostComponent implements OnInit {
  @Input() feedPost!: PostModelWithAuthor;

  @ViewChild('scrollBox') scrollBoxRef!: ElementRef<HTMLDivElement>;
  @ViewChild('commentInputReference') commentInputReference?: ElementRef<HTMLInputElement>;

  private commentsService = inject(CommentsService);
  private likesService = inject(LikesService);
  private viewsService = inject(ViewsService);
  private commentModerationService = inject(CommentModerationService);
  private tagsService = inject(TagsService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  posterSrc = '';
  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';

  liked = false;
  isPromptActive = false;
  errorState = false;
  errorTimer: any;

  commentInput = '';
  pendingReplyToCommentId: string | null = null;
  pendingReplyToUsername: string | null = null;

  reversedComments: UiComment[] = [];
  repliesByComment = new Map<string, UiReply[]>();

  replyDisplayLimit = new Map<string, number>();
  private readonly INITIAL_REPLY_LIMIT = 3;
  private readonly VIEW_MORE_STEP = 10;

  private seenOnce = false;
  private seenTimer: any = null;

  readonly showTags = signal(false);
  showThumbAnimation = signal(false);

  revisedTaggedUsernames: string[] = [];


  async ngOnInit() {
    await this.loadThread();

    try {
      const tags = await this.tagsService.getVisibleTaggedUsers(this.feedPost.id);
      this.revisedTaggedUsernames = tags.map(t => t.username);

    } catch {
      this.revisedTaggedUsernames = [];
    }
  }

  // ======================
  // Load whole thread
  // ======================
  private async loadThread() {
    const { roots, childrenByParent } = await this.commentsService.fetchThread(this.feedPost.id);

    const authorById = new Map<string, string>();

    for (const r of roots) authorById.set(r.id, r.author?.username ?? '');

    for (const [, list] of childrenByParent) {
      for (const r of list) authorById.set(r.id, r.author?.username ?? '');
    }

    const topViews: CommentView[] = roots.map(mapRowToView);
    this.reversedComments = topViews
      .map(v => ({
        commentId: v.id,
        username: v.authorUsername,
        profilePicture: v.authorAvatar,
        comment: v.text,
        likes: [],
        likeCount: v.likeCount,
        commentDate: v.createdAt,
        author_id: v.authorId
      }))
      .reverse();

    this.repliesByComment.clear();
    for (const [parentId, rows] of childrenByParent.entries()) {
      const replyingToUsername = authorById.get(parentId) ?? '';
      const uiReplies: UiReply[] = rows.map(row => {
        const v = mapRowToView(row);
        return {
          replyId: v.id,
          username: v.authorUsername,
          replyingToUsername,
          profilePicture: v.authorAvatar,
          comment: v.text,
          likes: [],
          likeCount: v.likeCount,
          commentDate: v.createdAt,
          author_id: v.authorId
        };
      });
      this.repliesByComment.set(parentId, uiReplies);
    }

    for (const [parentId, list] of this.repliesByComment.entries()) {
      if (!this.replyDisplayLimit.has(parentId)) {
        this.replyDisplayLimit.set(parentId, Math.min(this.INITIAL_REPLY_LIMIT, list.length));

      } else {
        const current = this.replyDisplayLimit.get(parentId)!;
        this.replyDisplayLimit.set(parentId, Math.min(current, list.length));
      }
    }
  }


  // ======================
  // Reply reveal helpers
  // ======================
  replyLimit(parentId: string): number {
    const set = this.replyDisplayLimit.get(parentId);
    if (typeof set === 'number') return set;

    const total = this.repliesByComment.get(parentId)?.length ?? 0;

    return Math.min(this.INITIAL_REPLY_LIMIT, total);
  }


  getVisibleReplies(parentId: string) {
    const all = this.repliesByComment.get(parentId) ?? [];
    const lim = this.replyLimit(parentId);

    return all.slice(0, lim);
  }


  getRemainingReplies(parentId: string): number {
    const total = this.repliesByComment.get(parentId)?.length ?? 0;
    const lim = this.replyLimit(parentId);

    return Math.max(total - lim, 0);
  }


  onViewMoreReplies(parentId: string, step = this.VIEW_MORE_STEP) {
    const total = this.repliesByComment.get(parentId)?.length ?? 0;
    const current = this.replyLimit(parentId);
    const next = Math.min(total, current + step);

    this.replyDisplayLimit.set(parentId, next);
  }


  onHideReplies(parentId: string) {
    const total = this.repliesByComment.get(parentId)?.length ?? 0;

    this.replyDisplayLimit.set(parentId, Math.min(this.INITIAL_REPLY_LIMIT, total));
  }


  // ======================
  // Single input UX — set/clear reply context
  // ======================
  startReplyTo(commentId: string, replyingToUsername: string) {
    this.pendingReplyToCommentId = commentId;
    this.pendingReplyToUsername = replyingToUsername;

    setTimeout(() => this.commentInputReference?.nativeElement?.focus(), 0);
  }


  clearReplyContext() {
    this.pendingReplyToCommentId = null;
    this.pendingReplyToUsername = null;
  }


  // ======================
  // Moderated submission (comment or reply)
  // ======================
  private submitting = false;

  private buildCommentContext(): CommentContext {
    return {
      postId: this.feedPost.id,
      authorUsername: this.feedPost.author?.username ?? '',
      type: this.pendingReplyToCommentId ? 'reply' : 'comment',
      parentCommentId: this.pendingReplyToCommentId ?? undefined,
      parentAuthorUsername: this.pendingReplyToUsername ?? undefined,
      existing: this.reversedComments.map(c => ({
        id: c.commentId,
        authorUsername: c.username,
        text: c.comment
      })),
      nowIso: new Date().toISOString()
    };
  }

  async onPostComment() {
    if (this.submitting) return;
    const raw = (this.commentInput ?? '').trim();
    if (!raw) return;

    const result = this.commentModerationService.validate(raw, this.buildCommentContext());

    if (!result.ok) {
      const saved = this.commentInput;

      this.errorState = true;
      this.commentInput = result.error;
      this.commentInputReference?.nativeElement.blur();

      if (this.errorTimer) clearTimeout(this.errorTimer);

      this.errorTimer = setTimeout(() => {
        this.commentInput = saved;
        this.errorState = false;
        this.commentInputReference?.nativeElement.focus();
        this.changeDetectorRef.markForCheck();
      }, 2500);

      this.changeDetectorRef.markForCheck();

      return;
    }

    const input = result.text;
    this.submitting = true;

    try {
      if (!this.pendingReplyToCommentId) {
        const row = await this.commentsService.addComment(this.feedPost.id, input);
        const v = mapRowToView(row);

        this.reversedComments.unshift({
          commentId: v.id,
          username: v.authorUsername,
          profilePicture: v.authorAvatar,
          comment: v.text,
          likes: [],
          likeCount: v.likeCount,
          commentDate: v.createdAt,
          author_id: v.authorId
        });

        this.highlightAndScroll('c-' + v.id);

      } else {
        const parentId = this.pendingReplyToCommentId;
        const row = await this.commentsService.addReply(parentId, input);
        const v = mapRowToView(row);
        const bucket = this.repliesByComment.get(parentId) ?? [];
        const replyingToUsername = this.pendingReplyToUsername ?? '';

        bucket.push({
          replyId: v.id,
          username: v.authorUsername,
          replyingToUsername,
          profilePicture: v.authorAvatar,
          comment: v.text,
          likes: [],
          likeCount: v.likeCount,
          commentDate: v.createdAt,
          author_id: v.authorId
        });

        this.repliesByComment.set(parentId, bucket);

        const total = this.repliesByComment.get(parentId)?.length ?? 0;
        const current = this.replyLimit(parentId);

        if (total > current) {
          this.replyDisplayLimit.set(parentId, current + 1);
        }

        this.highlightAndScroll('r-' + v.id);
      }

      this.commentInput = '';
      this.clearReplyContext();
      this.onCommentBlur();
      this.commentInputReference?.nativeElement.blur();

    } finally {
      this.submitting = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  onCommentFocus() {
    if (this.errorState) return;

    this.isPromptActive = true;

    queueMicrotask(() => this.commentInputReference?.nativeElement.focus());
  }
  onCommentBlur()  {
    this.commentInputReference?.nativeElement.blur();

    this.isPromptActive = false;
  }


  // ======================
  // Post like (optimistic)
  // ======================
  async togglePostLike() {
    const next = !this.liked;

    this.feedPost.like_count += next ? 1 : -1;
    this.liked = next;

    try {
      await this.likesService.toggleLike('post', this.feedPost.id, next);

    } catch {
      this.feedPost.like_count += next ? -1 : 1;
      this.liked = !next;
    }
  }

  // ======================
  // Seen-by on hover (debounced)
  // ======================
  async onHoverSeen() {
    if (this.seenOnce) return;
    if (this.seenTimer) clearTimeout(this.seenTimer);

    this.seenTimer = setTimeout(async () => {
      try {
        await this.viewsService.markSeen(this.feedPost.id);
        this.seenOnce = true;
       
      } finally {
        this.seenTimer = null;
      }
    }, 120);
  }

  // ======================
  // Utilities used by template
  // ======================
  private highlightAndScroll(elementId: string) {
    const host = this.scrollBoxRef?.nativeElement ?? document;
    const el = host.querySelector<HTMLElement>(`#${CSS.escape(elementId)}`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
  }

  ///  trims the number of likes from 1200 to 1.2k or 1200000 to 1.2m  \\\
  trimNumber(n: number) {
    const s = String(n);

    if (s.length < 4) return n;
    if (s.length === 4) return s[1] === '0' ? `${s[0]}k` : `${s[0]}.${s[1]}k`;
    if (s.length === 5) return s[2] === '0' ? `${s.slice(0, 2)}k` : `${s.slice(0, 2)}.${s[2]}k`;
    if (s.length === 6) return s[3] === '0' ? `${s.slice(0, 3)}k` : `${s.slice(0, 3)}.${s[3]}k`;
    if (s.length === 7) return s[1] === '0' ? `${s[0]}M` : `${s[0]}.${s[1]}M`;
    if (s.length === 8) return s[2] === '0' ? `${s.slice(0, 2)}M` : `${s.slice(0, 2)}.${s[2]}M`;

    return n;
  }


  ///  changes date format from YYYY-MM-DD to Month Day, Year  \\\
  fixCommentDate(date?: string) {
    if (!date) return '';

    const d = new Date(date);

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
 
    const month = monthNames[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();

    return `${month} ${day}, ${year}`;
  }

  onShare() {
    //! Needs to be implemented
  }

  onSave() {
    //! Needs to be implemented
  }

  onPosterClick() {
    if (!this.hasVisibleTags) return;
   
    this.showTags.update(v => !v);
  }

  onPosterDoubleClick() {
    this.togglePostLike();
    
    this.showThumbAnimation.set(true);
    setTimeout(() => this.showThumbAnimation.set(false), 800);
  }

  onPosterMouseleave() {
    if (!this.hasVisibleTags) return;

    if (this.showTags()) this.showTags.set(false);
  }

  ///  generates account link for atted users (@JohnDoe)  \\\
  tokensOf(caption: string | null | undefined) {
    return this.commentModerationService.tokenizeMentions(caption);
  }

  get hasVisibleTags(): boolean {
    return (this.revisedTaggedUsernames?.length ?? 0) > 0;
  }

  toggleTagsViaPoster() {
    if (!this.hasVisibleTags) return;

    this.showTags.update(v => !v);
  }

  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }
}