import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { RoutingService } from '../../services/routing.service';
import { AuthService } from '../../core/auth.service';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { PostModelWithAuthor } from '../../models/database-models/post-model';
import { FeedService } from '../../services/feed.service';

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
  private authService = inject(AuthService);
  private feedService = inject(FeedService);

  currentUser = { id: '', username: '' };
  usersFeedPosts: PostModelWithAuthor[] = [];
  usersMemoryLanePosts: PostModelWithAuthor[] = [];

  mode: 'feed' | 'memory' = 'feed';

  @ViewChild('feedScroll', { static: true }) feedScrollRef!: ElementRef<HTMLDivElement>;

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


  async ngOnInit() {
    try {
      ///  Grab the current user  \\\
      const user = await this.authService.getCurrentUser();
      if (!user?.id) { this.error.set('Not signed in'); return; }

      this.currentUser.id = user.id;

      ///  Load the current users feed  \\\
      await this.fetchFollowersBatch();
      this.revealMoreFromCache();

      ///  Pre-load the user memory lane  \\\
      await this.fetchMemoryBatch();
      this.usersMemoryLanePosts = this.memoryCache.slice(0, this.PAGE);

    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load feed');
    }
  }

  /// -======================================-  Feed/Memory Lane Logic  -======================================- \\\
  ///  Fetch the current users feed and store it in the cache  \\\
  private async fetchFollowersBatch() {
    if (!this.currentUser.id) return;
    this.loadingFeed.set(true);

    try {
      const data = await this.feedService.getFollowersFeed(this.currentUser.id, this.FEED_FETCH_BATCH, this.feedServerOffset);
      this.followersCache.push(...data);
      this.feedServerOffset += this.FEED_FETCH_BATCH;

    } finally {
      this.loadingFeed.set(false);
    }
  }

  ///  Fetch the current users memeory lane and store it in the cache  \\\
  private async fetchMemoryBatch() {
    if (!this.currentUser.id) return;
    this.loadingMemory.set(true);
    try {
      const data = await this.feedService.getMemoryLane(this.currentUser.id, this.MEMORY_FETCH_BATCH, this.memoryServerOffset);
      this.memoryCache.push(...data);
      this.memoryServerOffset += this.MEMORY_FETCH_BATCH;
    } finally {
      this.loadingMemory.set(false);
    }
  }

  ///  Grab more posts from the cache if the user nears the end on the current list  \\\
  private revealMoreFromCache() {
    const cache = this.mode === 'feed' ? this.followersCache : this.memoryCache;
    this.visibleCount = Math.min(cache.length, this.visibleCount + this.PAGE);
    this.usersFeedPosts = cache.slice(0, this.visibleCount);

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
  }


  /// -======================================-  Helpers  -======================================- \\\
  private scrollToTop() {
    const feedScrollBox = this.feedScrollRef?.nativeElement;
    if (feedScrollBox) feedScrollBox.scrollTop = 0;
  }

  onFeedScroll() {
    const feedScrollBox = this.feedScrollRef.nativeElement;

    const nearBottom = feedScrollBox.scrollHeight - (feedScrollBox.scrollTop + feedScrollBox.clientHeight) <= this.NEAR_BOTTOM_PX;
    if (!nearBottom) return;

    ///  If there is still more cached post, reveal the next batch  \\\
    const cache = this.mode === 'feed' ? this.followersCache : this.memoryCache;
    
    if (this.visibleCount < cache.length) {
      this.revealMoreFromCache();
      return;
    }

    ///  If the cache is fully revealed, ensure a prefetch is in-flight  \\\
    if (this.mode === 'feed' && !this.loadingFeed()) this.fetchFollowersBatch().then(() => this.revealMoreFromCache());
    if (this.mode === 'memory' && !this.loadingMemory()) this.fetchMemoryBatch().then(() => this.revealMoreFromCache());
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }

  trackPost = (_: number, post: PostModelWithAuthor) => post.id ?? _;
}