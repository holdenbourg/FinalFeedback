import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, inject, Input, NgZone, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserPostModel } from '../../../models/database-models/post-model';
import { FeedCommentComponent } from '../feed-comment/feed-comment.component';
import { AccountInformationModel } from '../../../models/database-models/account-information-model';
import { CommentModel } from '../../../models/database-models/comment-model';
import { RatedMovieModel } from '../../../models/database-models/rated-movie-model';
import { RatedSeriesModel } from '../../../models/database-models/rated-series-model';
import { LocalStorageService } from '../../../services/local-storage.service';
import { RepliesService } from '../../../services/replies.service';
import { RatedMoviesDatabase } from '../../../databases/rated-movies-database';
import { RatedSeriesDatabase } from '../../../databases/rated-series-database';
import { CommentsDatabase } from '../../../databases/comments-database';
import { PostsService } from '../../../services/posts.service';
import { ReplyModel } from '../../../models/database-models/reply-model';
import { CommentsService } from '../../../services/comments.service';
import { CommentContext, CommentModerationService } from '../../../services/comment-moderation.service';

@Component({
  selector: 'app-feed-post',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedCommentComponent],
  templateUrl: './feed-post.component.html',
  styleUrls: ['./feed-post.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class FeedPostComponent implements OnInit {
  private readonly localStorageService = inject(LocalStorageService);
  readonly postsService = inject(PostsService);
  private readonly commentService = inject(CommentsService);
  readonly commentModerationService: CommentModerationService = inject(CommentModerationService);
  private readonly repliesService = inject(RepliesService);

  private readonly ratedMoviesDatabase: RatedMoviesDatabase = inject(RatedMoviesDatabase);
  private readonly ratedSeriesDatabase: RatedSeriesDatabase = inject(RatedSeriesDatabase);
  private readonly commentsDatabase: CommentsDatabase = inject(CommentsDatabase);

  private changeDetectorRef = inject(ChangeDetectorRef);

  errorState = false;
  private errorTimer: any;

  currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user')!;

  currentRatedMovie: RatedMovieModel | null = null;
  currentRatedSeries: RatedSeriesModel | null = null;

  feedPostComments: CommentModel[] = [];

  commentInput = '';
  isPromptActive = false;
  posterHovered = signal(false);
  readonly showTags = signal(false);
  showThumbAnimation = signal(false);

  revisedTaggedUsernames: string[] = [];

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';

  @ViewChild('commentInputReference') commentInputReference!: ElementRef<HTMLInputElement>;
  @ViewChild('scrollBox') scrollBoxReference!: ElementRef<HTMLDivElement>;

  @Input() feedPost: UserPostModel = {
    postId: '',
    profilePicture: '',
    username: '',
    poster: '',
    caption: '',
    likes: [],
    taggedUsers: [],
    postDate: '',
    seenBy: []
  };

  ngOnInit() {
    if (this.feedPost.postId?.charAt(0) === 'm') {
      this.currentRatedMovie = this.ratedMoviesDatabase.getRatedMovieById(this.feedPost.postId);
    } else {
      this.currentRatedSeries = this.ratedSeriesDatabase.getRatedSeriesById(this.feedPost.postId);
    }

    /// populate the comments for the post \\\
    this.feedPostComments = this.commentsDatabase.getAllCommentsByPostId(this.feedPost.postId);

    this.revisedTaggedUsernames = this.reviseTaggedUsernames();
  }


  /// ---------------------------------------- Actions ---------------------------------------- \\\
  onPostComment() {
    const commentContext: CommentContext = {
      postId: this.feedPost.postId,
      type: (this.repliesService.postId && this.repliesService.commentId && this.repliesService.postId === this.feedPost.postId) ? 'reply' : 'comment',
      commentId: this.repliesService.commentId ?? undefined,
      existingCommentsForPost: this.feedPostComments,
      authorUsername: this.currentUser.username
    };

    const result = this.commentModerationService.validate(this.commentInput ?? '', commentContext);

    if (!result.ok) {
      const saved = this.commentInput;

      this.errorState = true;
      this.commentInput = result.error;

      this.commentInputReference?.nativeElement.blur();

      ///  If a previous error timer is running, clear it  \\\
      if (this.errorTimer) clearTimeout(this.errorTimer); 

      setTimeout(() => {
        this.commentInput = saved;
        this.errorState = false;

        this.commentInputReference?.nativeElement.focus();

        this.changeDetectorRef.markForCheck();
      }, 2500);

      this.changeDetectorRef.markForCheck();

      return;
    }

    const input = result.text

    if (commentContext.type === 'comment') {
      const newComment: CommentModel = {
        postId: this.feedPost.postId,
        commentId: this.commentService.generateUniqueCommentId(),
        profilePicture: this.currentUser.profilePicture,
        username: this.currentUser.username,
        comment: input,
        likes: [],
        commentDate: new Date().toISOString()
      };

      this.feedPostComments = [...this.feedPostComments, newComment];
      this.commentsDatabase.addCommentToDatabase(newComment);

      ///  highlight and scroll to the new comment  \\\
      this.highlightAndScroll('c-' + newComment.commentId);

    } else {
      const newReply: ReplyModel = {
        postId: this.repliesService.postId!,
        commentId: this.repliesService.commentId!,
        replyId: this.repliesService.generateUniqueReplyId(),
        profilePicture: this.currentUser.profilePicture,
        username: this.currentUser.username,
        replyingToUsername: this.repliesService.replyingToUsername ?? '',
        comment: input,
        likes: [],
        commentDate: new Date().toISOString()
      };

      this.repliesService.addReply(newReply);

      ///  highlight and scroll to the new reply  \\\
      this.highlightAndScroll('r-' + newReply.replyId);
    }

    this.commentInput = '';
    this.clearReplyContext();
    this.onCommentBlur();
  }

  private highlightAndScroll(targetId: string) {
    requestAnimationFrame(() => {
      const scrollBox = this.scrollBoxReference?.nativeElement;
      const newElement = document.getElementById(targetId);

      if (!scrollBox || !newElement) return;

      const scrollBoxRect = scrollBox.getBoundingClientRect();
      const newElementRect  = newElement.getBoundingClientRect();
      const relativeTop  = (newElementRect.top - scrollBoxRect.top) + scrollBox.scrollTop;
      const destinationTop = relativeTop - (scrollBox.clientHeight / 2 - newElement.clientHeight / 2);

      scrollBox.scrollTo({ top: destinationTop, behavior: 'smooth' });
      newElement.classList.add('just-posted');

      setTimeout(() => newElement.classList.remove('just-posted'), 2400);
    });
  }

  onReplyFromComment(e: { postId: string; commentId: string; username: string }) {
    this.repliesService.setReplyContext(e.postId, e.commentId, e.username);

    this.onCommentFocus();
  }

  togglePostLike() {
    this.feedPost = this.postsService.togglePostLike(this.currentUser.username, this.feedPost);
  }

  clearReplyContext() {
    this.repliesService.clearReplyContext();
  } 

  onShare() {
    //! Needs to be implemented
  }

  onSave() {
    //! Needs to be implemented
  }


  /// ---------------------------------------- Formatting ---------------------------------------- \\\
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

  ///  generates account link for atted users (@JohnDoe)  \\\
  tokensOf(caption: string | null | undefined) {
    return this.commentModerationService.tokenizeMentions(caption);
  }


  /// ---------------------------------------- Helper Methods ---------------------------------------- \\\
  ///  doesn't allow the same user to be atted twice  \\\
  userAttedTwice(comment: string) {
    const atHandles = (comment.match(/@([A-Za-z0-9._-]+)/g) ?? []).map(h => h.toLowerCase());

    for (let i = 1; i < atHandles.length; i++) if (atHandles[i] === atHandles[i - 1]) return true;

    return false;
  }

  ///  removes users who are blocked or have currentUser blocked  \\\
  reviseTaggedUsernames() {
    const blocked = new Set<string>();

    (this.currentUser.blocked ?? []).forEach(b => blocked.add(b.username));
    (this.currentUser.isBlockedBy ?? []).forEach(b => blocked.add(b.username));

    const uniq = new Set<string>();

    (this.feedPost.taggedUsers ?? []).forEach(t => { if (!blocked.has(t.username)) uniq.add(t.username); });

    return Array.from(uniq);
  }

  get hasVisibleTags(): boolean {
    return (this.revisedTaggedUsernames?.length ?? 0) > 0;
  }

  toggleTagsViaPoster() {
    if (!this.hasVisibleTags) return;

    this.showTags.update(v => !v);
  }

  onPosterKeydown(evt: KeyboardEvent) {
    if (!this.hasVisibleTags) return;

    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      this.toggleTagsViaPoster();
    }
  }

  onPosterClick() {
    if (!this.hasVisibleTags) return;
    
    this.showTags.update(v => !v);
  }

  onPosterDoubleClick() {
    const alreadyLiked = this.feedPost.likes.includes(this.currentUser.username);

    if (!alreadyLiked) {
      this.feedPost = this.postsService.togglePostLike(this.currentUser.username, this.feedPost);
    
      this.showThumbAnimation.set(true);
      setTimeout(() => this.showThumbAnimation.set(false), 800);
    }
  }

  onPosterMouseleave() {
    if (!this.hasVisibleTags) return;

    if (this.showTags()) this.showTags.set(false);
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.feedPost?.poster;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
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

  get isMovie() { 
    return this.feedPost.postId?.charAt(0) === 'm'; 
  }
  get reversedComments() { 
    return [...this.feedPostComments].reverse(); 
  }
}
