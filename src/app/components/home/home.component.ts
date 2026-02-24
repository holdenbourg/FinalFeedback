import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck, HostBinding, HostListener, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoutingService } from '../../services/routing.service';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { ShareRatingModalComponent } from '../share-rating-modal/share-rating-modal.component';
import { PostModelWithAuthor } from '../../models/database-models/post.model';
import { FeedService } from '../../services/feed.service';
import { UsersService } from '../../services/users.service';
import { FollowsService } from '../../services/follow.service';
import { UserModel } from '../../models/database-models/user.model';
import { RatingModel } from '../../models/database-models/rating.model';
import { DeviceService } from '../../services/device.service';
import { ModalOverlayService } from '../../services/modal-overlay.service';

export type FollowState = 'none' | 'following' | 'requested' | 'self' | 'anonymous';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FeedPostComponent, ShareRatingModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, DoCheck {
  readonly routingService = inject(RoutingService);
  readonly sidebarService = inject(SidebarService);
  readonly usersService = inject(UsersService);
  private feedService = inject(FeedService);
  private followsService = inject(FollowsService);
  private router = inject(Router);
  public deviceService = inject(DeviceService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private modalOverlayService = inject(ModalOverlayService);

  public currentUser = signal<UserModel | null>(null);
  public authUserId = signal<string | null>(null);
  public isAuthenticated = signal(false);

  usersFeedPosts: PostModelWithAuthor[] = [];
  usersMemoryLanePosts: PostModelWithAuthor[] = [];

  mode: 'feed' | 'memory' = 'feed';

  // Follow state tracking
  followingSet = new Set<string>();
  requestedSet = new Set<string>();

  // Share rating modal state
  showShareModal = false;
  shareRatingData: RatingModel | null = null;

  @HostBinding('class.modal-open')
  get isModalOpen() { return this.showShareModal; }

  ngDoCheck() {
    if (this.isModalOpen) this.modalOverlayService.show();
    else this.modalOverlayService.hide();
  }

  @ViewChild('feedScroll') feedScrollRef?: ElementRef<HTMLDivElement>;

  private FEED_FETCH_BATCH = 60;
  private MEMORY_FETCH_BATCH = 60;
  private PAGE = 20;
  private PREFETCH_THRESHOLD = 20;
  private NEAR_BOTTOM_PX = 700;

  private feedCache: PostModelWithAuthor[] = [];
  private memoryCache: PostModelWithAuthor[] = [];
  private feedServerOffset = 0;
  private memoryServerOffset = 0;
  private visibleCount = 0;

  loadingFeed = signal(false);
  loadingMemory = signal(false);
  error = signal<string | null>(null);
  readonly initialFeedLoaded = signal(false);


  async ngOnInit() {
    try {
      const uid = await this.usersService.getCurrentUserId();

      if (uid) {
        this.authUserId.set(uid);
        this.isAuthenticated.set(true);

        this.usersService.getCurrentUserProfile()
          .then(u => this.currentUser.set(u))
          .catch(() => this.currentUser.set(null));

        await this.fetchFeedBatch();
        this.revealMoreFromCache();
        await this.refreshFollowStatuses();

        await this.fetchMemoryBatch();
        this.usersMemoryLanePosts = this.memoryCache.slice(0, this.PAGE);
      } else {
        // Unauthenticated — load discover feed only
        await this.fetchFeedBatch();
        this.revealMoreFromCache();
      }

      this.initialFeedLoaded.set(true);
      this.loadingFeed.set(false);
      this.changeDetectorRef.markForCheck();

    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load feed');
    }
  }


  /// -======================================-  Feed/Memory Lane Logic  -======================================- \\\
  private async fetchFeedBatch() {
    this.loadingFeed.set(true);

    try {
      const uid = this.authUserId();
      const { posts, followedAuthorIds } = await this.feedService.getUserFeed(uid, this.FEED_FETCH_BATCH, this.feedServerOffset);
      this.feedCache.push(...posts);
      this.feedServerOffset += this.FEED_FETCH_BATCH;

      // Merge followed author IDs from the RPC into the local set
      for (const id of followedAuthorIds) this.followingSet.add(id);

      this.changeDetectorRef.markForCheck();

    } finally {
      this.loadingFeed.set(false);
    }
  }

  private async fetchMemoryBatch() {
    const uid = this.authUserId();
    if (!uid) return;

    this.loadingMemory.set(true);

    try {
      const data = await this.feedService.getMemoryLane(uid, this.MEMORY_FETCH_BATCH, this.memoryServerOffset);
      this.memoryCache.push(...data);
      this.memoryServerOffset += this.MEMORY_FETCH_BATCH;

      this.changeDetectorRef.markForCheck();

    } finally {
      this.loadingMemory.set(false);
    }
  }

  private revealMoreFromCache() {
    const cache = this.mode === 'feed' ? this.feedCache : this.memoryCache;
    this.visibleCount = Math.min(cache.length, this.visibleCount + this.PAGE);
    this.usersFeedPosts = cache.slice(0, this.visibleCount);

    this.changeDetectorRef.markForCheck();

    const remaining = cache.length - this.visibleCount;
    if (remaining <= this.PREFETCH_THRESHOLD) {
      if (this.mode === 'feed') this.fetchFeedBatch().catch(() => {});
      else this.fetchMemoryBatch().catch(() => {});
    }

    if (this.isAuthenticated()) this.refreshFollowStatuses().catch(() => {});
  }

  async activateMemoryLane() {
    if (this.mode === 'memory') return;

    this.mode = 'memory';
    this.visibleCount = 0;

    if (this.memoryCache.length === 0) await this.fetchMemoryBatch();
    this.revealMoreFromCache();
    this.scrollToTop();

    this.changeDetectorRef.markForCheck();
  }

  // --- Follow state management ---
  private async refreshFollowStatuses() {
    const uid = this.authUserId();
    if (!uid) return;

    const authorIds = [...new Set(this.usersFeedPosts.map(p => p.author_id))];
    const [following, requested] = await Promise.all([
      this.followsService.getFollowingSet(uid, authorIds),
      this.followsService.getRequestedSet(uid, authorIds),
    ]);

    // Merge database follows into the set (keeps RPC data + catches any the RPC missed)
    for (const id of following) this.followingSet.add(id);
    this.requestedSet = requested;
    this.changeDetectorRef.markForCheck();
  }

  getFollowState(authorId: string): FollowState {
    if (!this.isAuthenticated()) return 'anonymous';
    if (authorId === this.authUserId()) return 'self';
    if (this.followingSet.has(authorId)) return 'following';
    if (this.requestedSet.has(authorId)) return 'requested';
    return 'none';
  }

  async onFollowUser(authorId: string) {
    if (!this.isAuthenticated()) {
      this.router.navigateByUrl('/login');
      return;
    }
    try {
      await this.followsService.follow(authorId);
      // Optimistically update local state
      // Check if the target is private to determine follow vs request
      this.followingSet.add(authorId);
      this.changeDetectorRef.markForCheck();
      // Refresh to get accurate state (in case it was a request, not a follow)
      await this.refreshFollowStatuses();
    } catch (err) {
      console.error('Follow failed', err);
    }
  }


  /// -======================================-  Helpers  -======================================- \\\
  private scrollToTop() {
    const feedScrollBox = this.feedScrollRef?.nativeElement;
    if (feedScrollBox) feedScrollBox.scrollTop = 0;
  }

  onFeedScroll(): void {
    const feedScrollBox = this.feedScrollRef?.nativeElement;
    if (!feedScrollBox) return; // element not ready yet

    const nearBottom =
      feedScrollBox.scrollHeight -
        (feedScrollBox.scrollTop + feedScrollBox.clientHeight) <=
      this.NEAR_BOTTOM_PX;

    if (!nearBottom) return;

    // If there is still more cached posts, reveal the next batch
    const cache = this.mode === 'feed' ? this.feedCache : this.memoryCache;

    if (this.visibleCount < cache.length) {
      this.revealMoreFromCache();
      return;
    }

    // If the cache is fully revealed, ensure a prefetch is in-flight
    if (this.mode === 'feed' && !this.loadingFeed()) {
      this.fetchFeedBatch().then(() => this.revealMoreFromCache());
    } else if (this.mode === 'memory' && !this.loadingMemory()) {
      this.fetchMemoryBatch().then(() => this.revealMoreFromCache());
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }

  onShareRating(rating: RatingModel) {
    this.shareRatingData = rating;
    this.showShareModal = true;
    this.changeDetectorRef.markForCheck();
  }

  onShareComplete() {
    this.showShareModal = false;
    this.shareRatingData = null;
    this.changeDetectorRef.markForCheck();
  }

  onCancelShare() {
    this.showShareModal = false;
    this.shareRatingData = null;
    this.changeDetectorRef.markForCheck();
  }

  trackPost = (_: number, post: PostModelWithAuthor) => post.id ?? _;
}