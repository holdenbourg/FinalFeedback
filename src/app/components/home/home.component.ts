import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoutingService } from '../../services/routing.service';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { PostModelWithAuthor } from '../../models/database-models/post-model';
import { FeedService } from '../../services/feed.service';
import { UsersService } from '../../services/users.service';
import { UserModel } from '../../models/database-models/user-model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FeedPostComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  readonly routingService = inject(RoutingService);
  readonly sidebarService = inject(SidebarService);
  readonly usersService = inject(UsersService);
  private feedService = inject(FeedService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  public currentUser = signal<UserModel | null>(null);
  public authUserId = signal<string | null>(null);

  usersFeedPosts: PostModelWithAuthor[] = [];
  usersMemoryLanePosts: PostModelWithAuthor[] = [];

  mode: 'feed' | 'memory' = 'feed';

  @ViewChild('feedScroll') feedScrollRef?: ElementRef<HTMLDivElement>;

  private FEED_FETCH_BATCH = 60;
  private MEMORY_FETCH_BATCH = 60;
  private PAGE = 20;
  private PREFETCH_THRESHOLD = 20;
  private NEAR_BOTTOM_PX = 700;

  private followersCache: PostModelWithAuthor[] = [];
  private memoryCache: PostModelWithAuthor[] = [];
  private feedServerOffset = 0;
  private memoryServerOffset = 0;
  private visibleCount = 0;

  loadingFeed = signal(false);
  loadingMemory = signal(false);
  error = signal<string | null>(null);
  readonly initialFeedLoaded = signal(false);


  async ngOnInit() {
    this.usersService.getCurrentUserProfile()
      .then(u => this.currentUser.set(u))
      .catch(err => {
        console.error('Failed to load current user', err);
        this.currentUser.set(null);
      });
      
    try {
      const uid = await this.usersService.getCurrentUserId();
      if (!uid) { this.error.set('Not signed in'); return; }

      this.authUserId.set(uid);

      await this.fetchFollowersBatch();
      this.revealMoreFromCache();

      await this.fetchMemoryBatch();
      this.usersMemoryLanePosts = this.memoryCache.slice(0, this.PAGE);

      this.initialFeedLoaded.set(true);
      this.loadingFeed.set(false);
      this.changeDetectorRef.markForCheck();

    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load feed');
    }
  }

  
  /// -======================================-  Feed/Memory Lane Logic  -======================================- \\\
  ///  Fetch the current users feed and store it in the cache  \\\
  private async fetchFollowersBatch() {
    const uid = this.authUserId();
    if (!uid) return;

    this.loadingFeed.set(true);

    try {
      const data = await this.feedService.getFollowersFeed(uid, this.FEED_FETCH_BATCH, this.feedServerOffset);
      this.followersCache.push(...data);
      this.feedServerOffset += this.FEED_FETCH_BATCH;

      this.changeDetectorRef.markForCheck();

    } finally {
      this.loadingFeed.set(false);
    }
  }

  ///  Fetch the current users memeory lane and store it in the cache  \\\
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

  ///  Grab more posts from the cache if the user nears the end on the current list  \\\
  private revealMoreFromCache() {
    const cache = this.mode === 'feed' ? this.followersCache : this.memoryCache;
    this.visibleCount = Math.min(cache.length, this.visibleCount + this.PAGE);
    this.usersFeedPosts = cache.slice(0, this.visibleCount);

    this.changeDetectorRef.markForCheck();

    ///  Pre-fetch more posts if we’re getting low  \\\
    const remaining = cache.length - this.visibleCount;
    if (remaining <= this.PREFETCH_THRESHOLD) {
      if (this.mode === 'feed') this.fetchFollowersBatch().catch(() => {});
      else this.fetchMemoryBatch().catch(() => {});
    }
  }

  ///  Switch to memory lane when button clicked  \\\
  async activateMemoryLane() {
    if (this.mode === 'memory') return;

    this.mode = 'memory';
    this.visibleCount = 0;
    
    ///  Make sure we have memory batches ready (if not, fetch some)  \\\
    if (this.memoryCache.length === 0) await this.fetchMemoryBatch();
    this.revealMoreFromCache();
    this.scrollToTop();

    this.changeDetectorRef.markForCheck();
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
    const cache = this.mode === 'feed' ? this.followersCache : this.memoryCache;

    if (this.visibleCount < cache.length) {
      this.revealMoreFromCache();
      return;
    }

    // If the cache is fully revealed, ensure a prefetch is in-flight
    if (this.mode === 'feed' && !this.loadingFeed()) {
      this.fetchFollowersBatch().then(() => this.revealMoreFromCache());
    } else if (this.mode === 'memory' && !this.loadingMemory()) {
      this.fetchMemoryBatch().then(() => this.revealMoreFromCache());
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }

  trackPost = (_: number, post: PostModelWithAuthor) => post.id ?? _;
}