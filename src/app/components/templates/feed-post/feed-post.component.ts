import { Component, Input, ViewChild, ElementRef, ChangeDetectorRef, inject, OnInit, signal, EventEmitter, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentComponent } from '../comment/comment.component';
import { ReplyComponent } from '../reply/reply.component';
import { CommentView, mapRowToView } from '../../../models/database-models/comment.model';
import { PostModelWithAuthor } from '../../../models/database-models/post.model';
import { CommentModerationService, CommentContext } from '../../../services/comment-moderation.service';
import { CommentsService } from '../../../services/comments.service';
import { LikesService } from '../../../services/likes.service';
import { ViewsService } from '../../../services/views.service';
import { TagsService } from '../../../services/tags.service';
import { RatingsService, PostRating, MovieCriteria, SeriesCriteria } from '../../../services/ratings.service';
import { AuthService } from '../../../core/auth.service';
import { UserModel } from '../../../models/database-models/user.model';
import { UsersService } from '../../../services/users.service';

type UiComment = {
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
  isLikedByCurrentUser?: boolean;
};

@Component({
  selector: 'app-feed-post',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentComponent, ReplyComponent],
  templateUrl: './feed-post.component.html',
  styleUrls: ['./feed-post.component.css'],
})

export class FeedPostComponent implements OnInit, OnChanges {
  @Input() feedPost!: PostModelWithAuthor;
  @Output() postLikeChanged = new EventEmitter<number>();

  @ViewChild('scrollBox') scrollBoxRef!: ElementRef<HTMLDivElement>;
  @ViewChild('commentInputReference') commentInputReference?: ElementRef<HTMLInputElement>;

  private commentsService = inject(CommentsService);
  private usersService = inject(UsersService);
  private likesService = inject(LikesService);
  private viewsService = inject(ViewsService);
  private commentModerationService = inject(CommentModerationService);
  private tagsService = inject(TagsService);
  private ratingsService = inject(RatingsService);
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

  private seenOnce = false;
  private seenTimer: any = null;

  readonly showTags = signal(false);
  showThumbAnimation = signal(false);

  taggedUsernames: string[] = [];

  postRating: PostRating | null = null;
  isLoadingData = true;
  isLoadingComments = true;

  currentUser = signal<UserModel | null>(null);

  async ngOnInit() {
    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);

    // Phase 1: Show poster immediately
    this.isLoadingData = false;
    this.changeDetectorRef.detectChanges();
    
    // Phase 2: Load data (but keep comments hidden)
    await Promise.all([
      this.loadLikeStatusAndCount(),
      this.loadRatingData(),
      this.loadThread(),
      this.loadTaggedUsers()
    ]);
    
    // Phase 3: Load comment/reply counts AND liked status
    await Promise.all([
      this.loadCommentLikeCounts(),
      this.loadCommentLikedStatus()  // ← ADD THIS
    ]);

    // Phase 4: Now show comments with likes ready
    this.isLoadingComments = false;
    this.changeDetectorRef.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Whenever post input changes, trigger detection
    if (changes['post']) {
      this.changeDetectorRef.markForCheck();
      this.changeDetectorRef.detectChanges();
    }
  }

  private async loadLikeStatusAndCount() {
    try {
      const [liked, count] = await Promise.all([
        this.likesService.isLiked('post', this.feedPost.id),
        this.likesService.count('post', this.feedPost.id)
      ]);
      
      this.liked = liked;
      this.feedPost.like_count = count;
      this.changeDetectorRef.markForCheck();
    } catch (err) {
      console.error('Error loading like data:', err);
      this.liked = false;
      this.feedPost.like_count = 0;
    }
  }

  private async refreshPostCount() {
    try {
      const likeCount = await this.likesService.count('post', this.feedPost.id);
      this.feedPost.like_count = likeCount;
      this.changeDetectorRef.markForCheck();
    } catch (err) {
      console.error('Error refreshing post count:', err);
    }
  }

  private async loadLikeState() {
    try {
      this.liked = await this.likesService.isLiked('post', this.feedPost.id);
    } catch (err) {
      console.error('Failed to load like state:', err);
      this.liked = false;
    }
  }

  private async loadRatingData() {
    try {
      const rating = await this.ratingsService.getRatingByPostId(this.feedPost.id);
      if (rating) {
        this.postRating = rating;
      }
    } catch (err) {
      console.error('Failed to load rating data:', err);
      this.postRating = null;
    }
  }

  private async loadTaggedUsers() {
    try {
      const tags = await this.tagsService.getVisibleTaggedUsers(this.feedPost.id);
      this.taggedUsernames = tags.map(t => t.username);
    } catch (err) {
      console.error('Failed to load tags:', err);
      this.taggedUsernames = [];
    }
  }

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
      
      // ✅ TikTok-style: Start with all replies hidden (limit = 0)
      this.replyDisplayLimit.set(parentId, 0);
    }
  }

  /**
   * Batch load like counts for all comments and replies
   */
  private async loadCommentLikeCounts() {
    try {
      // Get all comment IDs
      const commentIds = this.reversedComments.map(c => c.commentId);
      
      // Get all reply IDs
      const replyIds: string[] = [];
      for (const replies of this.repliesByComment.values()) {
        replyIds.push(...replies.map(r => r.replyId));
      }
      
      // Batch load counts in parallel
      const [commentCounts, replyCounts] = await Promise.all([
        commentIds.length > 0 
          ? this.likesService.countMultiple('comment', commentIds)
          : Promise.resolve(new Map<string, number>()),
        replyIds.length > 0
          ? this.likesService.countMultiple('comment', replyIds)  // replies are also 'comment' type
          : Promise.resolve(new Map<string, number>())
      ]);
      
      // Apply counts to comments
      this.reversedComments.forEach(comment => {
        comment.likeCount = commentCounts.get(comment.commentId) ?? 0;
      });
      
      // Apply counts to replies
      for (const replies of this.repliesByComment.values()) {
        replies.forEach(reply => {
          reply.likeCount = replyCounts.get(reply.replyId) ?? 0;
        });
      }
      
    } catch (err) {
      console.error('Error loading comment like counts:', err);
    }
  }

  /**
   * Batch load liked status for all comments and replies
   */
  private async loadCommentLikedStatus() {
    try {
      // Get all comment IDs
      const commentIds = this.reversedComments.map(c => c.commentId);
      
      // Get all reply IDs
      const replyIds: string[] = [];
      for (const replies of this.repliesByComment.values()) {
        replyIds.push(...replies.map(r => r.replyId));
      }
      
      // Batch check liked status in parallel
      const [likedComments, likedReplies] = await Promise.all([
        commentIds.length > 0 
          ? this.likesService.checkMultipleLiked('comment', commentIds)
          : Promise.resolve(new Set<string>()),
        replyIds.length > 0
          ? this.likesService.checkMultipleLiked('comment', replyIds)  // replies are also 'comment' type
          : Promise.resolve(new Set<string>())
      ]);
      
      // Apply liked status to comments
      this.reversedComments.forEach(comment => {
        comment.isLikedByCurrentUser = likedComments.has(comment.commentId);
      });
      
      // Apply liked status to replies
      for (const replies of this.repliesByComment.values()) {
        replies.forEach(reply => {
          reply.isLikedByCurrentUser = likedReplies.has(reply.replyId);
        });
      }
      
    } catch (err) {
      console.error('Error loading comment liked status:', err);
    }
  }


  // ======================
  // TikTok-style reply reveal logic
  // ======================
  replyLimit(parentId: string): number {
    // Return the current display limit (default 0 = hidden)
    return this.replyDisplayLimit.get(parentId) ?? 0;
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

  getTotalReplies(parentId: string): number {
    return this.repliesByComment.get(parentId)?.length ?? 0;
  }

  // ✅ TikTok-style: First click shows 3, subsequent clicks add 5
  onViewMoreReplies(parentId: string) {
    const total = this.repliesByComment.get(parentId)?.length ?? 0;
    const current = this.replyLimit(parentId);

    let next: number;
    
    if (current === 0) {
      // First click: show 3 replies
      next = Math.min(3, total);
    } else {
      // Subsequent clicks: add 5 more
      next = Math.min(total, current + 5);
    }

    this.replyDisplayLimit.set(parentId, next);
  }

  // ✅ TikTok-style: Hide all replies
  onHideReplies(parentId: string) {
    this.replyDisplayLimit.set(parentId, 0);
  }

  // ✅ Check if replies are currently visible
  areRepliesVisible(parentId: string): boolean {
    return this.replyLimit(parentId) > 0;
  }


  // ======================
  // Single input UX – set/clear reply context
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

        this.changeDetectorRef.detectChanges();
        setTimeout(() => this.highlightAndScroll('c-' + v.id), 100);

      } else {
        const parentId = this.pendingReplyToCommentId;
        const row = await this.commentsService.addReply(parentId, input);
        const v = mapRowToView(row);
        const bucket = this.repliesByComment.get(parentId) ?? [];
        const replyingToUsername = this.pendingReplyToUsername ?? '';

        bucket.unshift({
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

        // ✅ Ensure new reply is visible by expanding limit by 1
        const current = this.replyLimit(parentId);
        
        // Always show at least 1 (the new reply)
        this.replyDisplayLimit.set(parentId, Math.max(1, current + 1));

        this.changeDetectorRef.detectChanges();
        setTimeout(() => this.highlightAndScroll('r-' + v.id), 100);
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

  async onDeleteComment(commentId: string) {
    try {
      // Optimistic UI update
      this.reversedComments = this.reversedComments.filter(c => c.commentId !== commentId);
      
      // Also remove its replies from the map
      this.repliesByComment.delete(commentId);
      this.replyDisplayLimit.delete(commentId);
      
      // Update comment count
      if (this.feedPost.comment_count !== undefined) {
        // Count how many replies were deleted
        const replyCount = this.repliesByComment.get(commentId)?.length || 0;
        this.feedPost.comment_count -= (1 + replyCount);
      }
      
      // Force UI update
      this.changeDetectorRef.detectChanges();
      
      // Delete from database
      await this.commentsService.deleteComment(commentId);
      
    } catch (err) {
      console.error('Error deleting comment:', err);
      
      // Reload thread on error
      await this.loadThread();
      this.changeDetectorRef.detectChanges();
    }
  }

  async onDeleteReply(event: { replyId: string; parentCommentId: string }) {
    try {
      // Get replies array for this comment
      const replies = this.repliesByComment.get(event.parentCommentId);
      if (!replies) return;
      
      // Optimistic UI update
      const updatedReplies = replies.filter(r => r.replyId !== event.replyId);
      this.repliesByComment.set(event.parentCommentId, updatedReplies);
      
      // Update comment count
      if (this.feedPost.comment_count !== undefined) {
        this.feedPost.comment_count -= 1;
      }
      
      // Force UI update
      this.changeDetectorRef.detectChanges();
      
      // Delete from database
      await this.commentsService.deleteComment(event.replyId);
      
    } catch (err) {
      console.error('Error deleting reply:', err);
      
      // Reload thread on error
      await this.loadThread();
      this.changeDetectorRef.detectChanges();
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
    const prevCount = this.feedPost.like_count ?? 0;
    
    // Optimistic update
    this.liked = next;
    this.feedPost.like_count = prevCount + (next ? 1 : -1);
    
    // FORCE DETECTION - Try both methods
    this.changeDetectorRef.markForCheck();
    this.changeDetectorRef.detectChanges();
    
    // Also force Angular to re-evaluate bindings
    setTimeout(() => {
      this.changeDetectorRef.detectChanges();
    }, 0);
    
    try {
      await this.likesService.toggleLike('post', this.feedPost.id, next);
      await this.refreshPostCount();

      this.postLikeChanged.emit(this.feedPost.like_count);
      
    } catch (err) {
      console.error('Error toggling post like:', err);
      
      // Revert on error
      this.liked = !next;
      this.feedPost.like_count = prevCount;
      
      this.changeDetectorRef.markForCheck();
      this.changeDetectorRef.detectChanges();
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
        await this.viewsService.markPostSeen(this.feedPost.id);
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
    const scrollContainer = this.scrollBoxRef?.nativeElement;
    if (!scrollContainer) return;

    const el = scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(elementId)}`);
    if (!el) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = el.getBoundingClientRect();
    
    const relativeTop = elementRect.top - containerRect.top;
    const targetScroll = scrollContainer.scrollTop + relativeTop - (containerRect.height / 2) + (elementRect.height / 2);

    scrollContainer.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

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
    if (!this.liked) {
      this.togglePostLike();
      
      this.showThumbAnimation.set(true);
      setTimeout(() => this.showThumbAnimation.set(false), 800);
    }
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
    return (this.taggedUsernames?.length ?? 0) > 0;
  }

  toggleTagsViaPoster() {
    if (!this.hasVisibleTags) return;

    this.showTags.update(v => !v);
  }

  ///  Type-safe criteria accessors for template  \\\
  getMovieCriteria(criteria: MovieCriteria | SeriesCriteria): MovieCriteria {
    return criteria as MovieCriteria;
  }

  getSeriesCriteria(criteria: MovieCriteria | SeriesCriteria): SeriesCriteria {
    return criteria as SeriesCriteria;
  }

  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }
}