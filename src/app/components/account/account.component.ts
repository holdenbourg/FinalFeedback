import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed, ChangeDetectorRef, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { UsersService } from '../../services/users.service';
import { supabase } from '../../core/supabase.client';
import { UserModel } from '../../models/database-models/user.model';
import { AccountViewState } from '../../models/helper-models/account-view-state.enum';
import { PostWithRating } from '../../models/helper-models/post-with-ratings.interface';
import { FollowsService } from '../../services/follow.service';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { PostDetailModalComponent } from '../post-detail-modal/post-detail-modal.component';
import { BlocksService } from '../../services/blocks.service';

type TabType = 'posts' | 'tagged' | 'archive';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, PostDetailModalComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  // Services
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);
  private followsService = inject(FollowsService);
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private blocksService = inject(BlocksService);

  // State signals
  currentUser = signal<UserModel | null>(null);
  profileUser = signal<UserModel | null>(null);
  viewState = signal<AccountViewState>(AccountViewState.LOADING);
  activeTab = signal<TabType>('posts');

  postsTab = signal<any[]>([]);
  taggedTab = signal<any[]>([]);
  archiveTab = signal<any[]>([]);

  loadingPosts = signal(false);
  loadingTagged = signal(false);
  loadingArchive = signal(false);

  private tabCache: Record<TabType, PostWithRating[] | null> = {
    posts: null,
    tagged: null,
    archive: null,
  };

  private cachedProfileUserId: string | null = null;
  private cachedViewState: AccountViewState | null = null;

  posts: WritableSignal<PostWithRating[]> = signal<PostWithRating[]>([]);
  initialLoading = signal(true);
  loading: WritableSignal<boolean> = signal(true);

  username = signal('');

  postCount = signal<number>(0);
  followerCount = signal<number>(0);
  followingCount = signal<number>(0);
  
  // Social panel data
  followers = signal<UserModel[]>([]);
  following = signal<UserModel[]>([]);
  requests = signal<UserModel[]>([]);
  socialTab: 'followers' | 'following' | 'requests' = 'followers';

  // Expose enum to template
  AccountViewState = AccountViewState;

  // Track if profile user has requested current user
  private profileUserHasRequestedMe = signal(false);

  // Modal state
  selectedPostIndex = signal<number | null>(null);
  showPostModal = signal(false);

  // Modal navigation
  canNavigatePrevious = computed(() => {
    const index = this.selectedPostIndex();
    return index !== null && index > 0;
  });

  canNavigateNext = computed(() => {
    const index = this.selectedPostIndex();
    const total = this.posts().length;
    return index !== null && index < total - 1;
  });

  selectedPost = computed(() => {
    const index = this.selectedPostIndex();
    if (index === null) return null;
    return this.posts()[index] || null;
  });

  // Computed values
  isOwnAccount = computed(() => 
    this.viewState() === AccountViewState.OWN_ACCOUNT
  );
  
  canViewPosts = computed(() => {
    const state = this.viewState();
    return state === AccountViewState.OWN_ACCOUNT ||
           state === AccountViewState.FOLLOWING_PUBLIC ||
           state === AccountViewState.FOLLOWING_PRIVATE ||
           state === AccountViewState.NOT_FOLLOWING_PUBLIC;
  });
  
  canEditProfile = computed(() => this.isOwnAccount());
  
  canFollow = computed(() => {
    const state = this.viewState();
    return state === AccountViewState.NOT_FOLLOWING_PUBLIC ||
           state === AccountViewState.NOT_FOLLOWING_PRIVATE;
  });

  showFollowButton = computed(() => (this.canFollow() && this.profileUserHasRequestedMe() === false));

  showUnfollowButton = computed(() => {
    const state = this.viewState();
    return state === AccountViewState.FOLLOWING_PUBLIC ||
          state === AccountViewState.FOLLOWING_PRIVATE;
  });

  showRequestedButton = computed(() => 
    this.viewState() === AccountViewState.REQUESTED
  );

  showAcceptDeclineButtons = computed(() => {
    return this.hasRequestedMe();
  });

  followButtonText = computed(() => {
    const user = this.profileUser();
    return user?.private ? 'Request' : 'Follow';
  });

  async ngOnInit() {
    this.addRandomStartPointForRows();

    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);

    // Watch route params for username and tab changes
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap
    ]).subscribe(async ([params, query]) => {
      const username = params.get('username');
      const tab = (query.get('tab') || 'posts') as TabType;

      if (username) {
        this.username.set(username);
        await this.loadAccount(username, tab);
      }
    });
  }

  /**
   * Main method to load account and determine view state
   */
  private async loadAccount(username: string, tab: TabType) {
    this.loading.set(true);
    this.viewState.set(AccountViewState.LOADING);

    try {
      // Load profile user by username
      const profile = await this.usersService.getUserProfileByUsername(username);
      
      if (!profile) {
        this.viewState.set(AccountViewState.NOT_FOUND);
        this.loading.set(false);
        return;
      }

      this.profileUser.set(profile);

      // Load counts dynamically
      await this.loadUserCounts(profile.id);

      // Determine view state
      const state = await this.determineViewState();
      this.viewState.set(state);

      // Load posts based on tab and permissions
      this.activeTab.set(tab);
      await this.preloadAllTabs(profile.id, state);

      // Load social data (followers/following/requests)
      await this.loadSocialData(profile.id);

    } catch (err) {
      console.error('[Account] Failed to load account:', err);
      this.viewState.set(AccountViewState.NOT_FOUND);
    } finally {
      this.loading.set(false);
    }
  }

  private async determineViewState(): Promise<AccountViewState> {
    const current = this.currentUser();
    const profile = this.profileUser();
    
    if (!current || !profile) {
      return AccountViewState.NOT_FOUND;
    }

    // Own account
    if (current.id === profile.id) {
      return AccountViewState.OWN_ACCOUNT;
    }

    // Check for current user blocked by profile user
    const isBlocked = await this.usersService.isBlocked(
      current.id,
      profile.id
    );
    
    if (isBlocked) {
      console.log('blocked');
      return AccountViewState.BLOCKED;      
    }

    // Check for current user blocking profile user
    const isBlocker = await this.usersService.isBlocker(
      current.id,
      profile.id
    );
    
    if (isBlocker) {
      console.log('blocker');
      return AccountViewState.BLOCKER;
    }

    // ✅ NEW: Check if they requested you (takes priority)
    const theyRequestedMe = await this.followsService.hasRequestedToFollow(
      profile.id,
      current.id
    );
    this.profileUserHasRequestedMe.set(theyRequestedMe);

    // Check following status
    const following = await this.followsService.isFollowing(current.id, profile.id);

    if (following) {
      return profile.private 
        ? AccountViewState.FOLLOWING_PRIVATE 
        : AccountViewState.FOLLOWING_PUBLIC;
    }

    // Check if you requested them
    const requested = await this.followsService.hasRequestedToFollow(current.id, profile.id);
    
    if (requested) {
      return AccountViewState.REQUESTED;
    }

    // Not following
    if (profile.private) {
      return AccountViewState.NOT_FOLLOWING_PRIVATE;
    }

    return AccountViewState.NOT_FOLLOWING_PUBLIC;
  }

  /**
   * Check if profile user has requested to follow current user
   */
  private hasRequestedMe = computed(() => {
    // This will be set during loadSocialData
    return this.profileUserHasRequestedMe();
  });


  ///  -======================================-  Load Posts Logic (Posts, Tagged, and Archived)  -======================================- \\\
  /**
   * Load posts based on active tab and permissions
   */
  private async loadPostsForTab(tab: TabType, userId: string, state: AccountViewState) {
    // Archive tab only visible to own account
    if (tab === 'archive' && state !== AccountViewState.OWN_ACCOUNT) {
      this.switchTab('posts');
      return;
    }

    this.posts.set([]); // Clear current posts

    switch (tab) {
      case 'posts':
        await this.loadUserPosts(userId, state);
        break;
      case 'tagged':
        await this.loadTaggedPosts(userId, state);
        break;
      case 'archive':
        await this.loadArchivedPosts(userId);
        break;
    }
  }


  private async loadUserCounts(userId: string) {
    try {
      // Load all counts in parallel (fast!)
      const [postCountRes, followerCount, followingCount] = await Promise.all([
        // Count posts
        supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', userId)
          .eq('visibility', 'public'),
        
        // Count followers
        this.followsService.getFollowerCount(userId),
        
        // Count following
        this.followsService.getFollowingCount(userId)
      ]);

      // Update signals
      this.postCount.set(postCountRes.count || 0);
      this.followerCount.set(followerCount);
      this.followingCount.set(followingCount);
      
    } catch (err) {
      console.error('[Account] Failed to load counts:', err);
    }
  }

  /**
   * Load user's public/all posts
   */
  private async loadUserPosts(userId: string, state: AccountViewState) {
    try {
      // Determine which posts to show
      const canViewAll = state === AccountViewState.OWN_ACCOUNT ||
                         state === AccountViewState.FOLLOWING_PUBLIC ||
                         state === AccountViewState.FOLLOWING_PRIVATE;

      const { data, error } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', userId)
        .eq('visibility', 'public') // Only public posts for now
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postIds = (data || []).map(p => p.id);
      const postsWithRatings = await this.loadPostsWithRatings(postIds);

      this.posts.set(postsWithRatings);
    } catch (err) {
      console.error('[Account] Failed to load user posts:', err);
      this.posts.set([]);
    }
  }

  /**
   * Load posts where user is tagged
   */
  private async loadTaggedPosts(userId: string, state: AccountViewState) {
    try {
      // Get public tags where user is tagged
      const { data, error } = await supabase
        .from('tags')
        .select('target_id')
        .eq('tagged_id', userId)
        .eq('target_type', 'post')
        .eq('status', 'public') // Only public tags
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postIds = [...new Set((data || []).map(t => t.target_id))]; // Remove duplicates
      const postsWithRatings = await this.loadPostsWithRatings(postIds);

      this.posts.set(postsWithRatings);
    } catch (err) {
      console.error('[Account] Failed to load tagged posts:', err);
      this.posts.set([]);
    }
  }

  /**
   * Load archived posts (own account only)
   */
  private async loadArchivedPosts(userId: string) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', userId)
        .eq('visibility', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postIds = (data || []).map(p => p.id);
      const postsWithRatings = await this.loadPostsWithRatings(postIds);

      this.posts.set(postsWithRatings);
    } catch (err) {
      console.error('[Account] Failed to load archived posts:', err);
      this.posts.set([]);
    }
  }

  /**
   * Load complete post data with ratings, authors, tags, AND COUNTS
   */
  private async loadPostsWithRatings(postIds: string[]): Promise<PostWithRating[]> {
    if (postIds.length === 0) return [];

    try {
      // Batch 1: Get all posts at once
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds);

      if (postsError || !posts) {
        console.error('[Account] Failed to load posts:', postsError);
        return [];
      }

      // Extract unique IDs
      const ratingIds = [...new Set(posts.map(p => p.rating_id).filter(Boolean))];
      const authorIds = [...new Set(posts.map(p => p.author_id).filter(Boolean))];

      // Batch queries in parallel (including counts)
      const [ratingsRes, authorsRes, tagsRes, likeCounts, commentCounts] = await Promise.all([
        // Get all ratings
        supabase
          .from('ratings')
          .select('*')
          .in('id', ratingIds),
        
        // Get all authors
        supabase
          .from('users')
          .select('*')
          .in('id', authorIds),
        
        // Get all tags
        supabase
          .from('tags')
          .select('target_id, tagged_id')
          .eq('target_type', 'post')
          .eq('status', 'public')
          .in('target_id', postIds),
        
        // Get like counts for all posts
        this.getLikeCountsForPosts(postIds),
        
        // Get comment counts for all posts
        this.getCommentCountsForPosts(postIds)
      ]);

      if (ratingsRes.error || authorsRes.error) {
        console.error('[Account] Failed to load data:', ratingsRes.error || authorsRes.error);
        return [];
      }

      // Create lookup maps
      const ratingsMap = new Map(ratingsRes.data?.map(r => [r.id, r]) || []);
      const authorsMap = new Map(authorsRes.data?.map(a => [a.id, a]) || []);

      // Group tags by post
      const tagsByPost = new Map<string, string[]>();
      tagsRes.data?.forEach(tag => {
        const tags = tagsByPost.get(tag.target_id) || [];
        tags.push(tag.tagged_id);
        tagsByPost.set(tag.target_id, tags);
      });

      // Get tagged user profiles
      const allTaggedUserIds = [...new Set(tagsRes.data?.map(t => t.tagged_id) || [])];
      let taggedUsersMap = new Map();
      
      if (allTaggedUserIds.length > 0) {
        const { data: taggedUsers } = await supabase
          .from('users')
          .select('id, username, profile_picture_url')
          .in('id', allTaggedUserIds);

        taggedUsersMap = new Map(taggedUsers?.map(u => [u.id, u]) || []);
      }

      // Assemble results with counts
      const results: PostWithRating[] = [];

      for (const postId of postIds) {
        const post = posts.find(p => p.id === postId);
        if (!post) continue;

        const rating = ratingsMap.get(post.rating_id);
        if (!rating) continue;

        const author = authorsMap.get(post.author_id);
        if (!author) continue;

        const taggedUserIds = tagsByPost.get(postId) || [];
        const taggedUsersForPost = taggedUserIds
          .map(id => taggedUsersMap.get(id))
          .filter(u => u !== undefined) as any[];

        // Add counts to post object
        post.like_count = likeCounts.get(postId) || 0;
        post.comment_count = commentCounts.get(postId) || 0;

        results.push({
          post,
          rating,
          author,
          taggedUsers: taggedUsersForPost
        });
      }

      return results;

    } catch (err) {
      console.error('[Account] Exception in loadPostsWithRatings:', err);
      return [];
    }
  }

  private async preloadAllTabs(userId: string, state: AccountViewState) {
    this.cachedProfileUserId = userId;
    this.cachedViewState = state;

    this.loading.set(true);

    try {
      // POSTS
      await this.loadUserPosts(userId, state);
      this.tabCache.posts = this.posts();

      // TAGGED
      await this.loadTaggedPosts(userId, state);
      this.tabCache.tagged = this.posts();

      // ARCHIVE (only if own account)
      if (state === AccountViewState.OWN_ACCOUNT) {
        await this.loadArchivedPosts(userId);
        this.tabCache.archive = this.posts();
      } else {
        this.tabCache.archive = [];
      }

      // Put UI back onto currently selected tab dataset
      const tab = this.activeTab();
      this.posts.set(this.tabCache[tab] ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get like counts for multiple posts (efficient batch query)
   */
  private async getLikeCountsForPosts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();

    try {
      const { data, error } = await supabase
        .from('likes')
        .select('target_id')
        .eq('target_type', 'post')
        .in('target_id', postIds);

      if (error) {
        console.error('Error fetching like counts:', error);
        return new Map();
      }

      // Count occurrences of each post ID
      const counts = new Map<string, number>();
      (data || []).forEach((like: any) => {
        counts.set(like.target_id, (counts.get(like.target_id) || 0) + 1);
      });

      return counts;
    } catch (err) {
      console.error('Exception fetching like counts:', err);
      return new Map();
    }
  }

  /**
   * Get comment counts for multiple posts (efficient batch query)
   */
  private async getCommentCountsForPosts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();

    try {
      const { data, error } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds);

      if (error) {
        console.error('Error fetching comment counts:', error);
        return new Map();
      }

      // Count occurrences of each post ID
      const counts = new Map<string, number>();
      (data || []).forEach((comment: any) => {
        counts.set(comment.post_id, (counts.get(comment.post_id) || 0) + 1);
      });

      return counts;
    } catch (err) {
      console.error('Exception fetching comment counts:', err);
      return new Map();
    }
  }


  ///  -======================================-  Post Detail Modal Logic  -======================================- \\\
  openPostModal(index: number) {
    this.selectedPostIndex.set(index);
    this.showPostModal.set(true);
  }

  closePostModal() {
    this.showPostModal.set(false);
    this.selectedPostIndex.set(null);
  }

  navigateToPreviousPost() {
    const currentIndex = this.selectedPostIndex();
    if (currentIndex !== null && currentIndex > 0) {
      this.selectedPostIndex.set(currentIndex - 1);
    }
  }

  navigateToNextPost() {
    const currentIndex = this.selectedPostIndex();
    const totalPosts = this.posts().length;
    if (currentIndex !== null && currentIndex < totalPosts - 1) {
      this.selectedPostIndex.set(currentIndex + 1);
    }
  }

  // ← ADD THIS METHOD
  onPostUpdated(event: { index: number; likeCount: number }) {
    const currentPosts = this.posts();
    if (event.index >= 0 && event.index < currentPosts.length) {
      // Create a new array with updated post
      const updatedPosts = currentPosts.map((item, idx) => {
        if (idx === event.index) {
          return {
            ...item,
            post: {
              ...item.post,
              like_count: event.likeCount
            }
          };
        }
        return item;
      });
      
      this.posts.set(updatedPosts);
    }
  }

  onModalPostDeleted(event: { postId: string; ratingId: string }) {
    const tab = this.activeTab();

    // --- 1) Remove from ALL caches ---
    (['posts', 'tagged', 'archive'] as const).forEach(t => {
      const list = this.tabCache[t];
      if (!list) return;
      this.tabCache[t] = list.filter(x => x.post.id !== event.postId);
    });

    // --- 2) Update the currently shown list from its cache (source of truth) ---
    const after = this.tabCache[tab] ?? [];
    this.posts.set(after);

    // Optional: keep the count visually in sync (depends on how you define postCount)
    this.postCount.update(n => Math.max(0, n - 1));

    // --- 3) Keep modal navigation sane ---
    const currentIndex = this.selectedPostIndex();
    if (currentIndex === null) return;

    if (after.length === 0) {
      this.closePostModal();
      return;
    }

    // If we deleted the last item, clamp index
    const nextIndex = Math.min(currentIndex, after.length - 1);
    this.selectedPostIndex.set(nextIndex);
  }

  onModalVisibilityChanged(event: { postId: string; visibility: 'public' | 'archived' }) {
    const tab = this.activeTab();

    const moveBetweenPublicAndArchive = (item: any) => {
      // Posts tab holds PUBLIC posts, Archive tab holds ARCHIVED posts
      const isNowPublic = event.visibility === 'public';
      const isNowArchived = event.visibility === 'archived';

      // Remove from both lists first (prevents duplicates)
      this.tabCache.posts = (this.tabCache.posts ?? []).filter(x => x.post.id !== event.postId);
      this.tabCache.archive = (this.tabCache.archive ?? []).filter(x => x.post.id !== event.postId);

      if (isNowPublic) {
        this.tabCache.posts = [item, ...(this.tabCache.posts ?? [])];
      } else if (isNowArchived) {
        this.tabCache.archive = [item, ...(this.tabCache.archive ?? [])];
      }
    };

    // Find the item in ANY cache first (not just current tab)
    const allTabs = ['posts', 'tagged', 'archive'] as const;
    let found: any | null = null;

    for (const t of allTabs) {
      const list = this.tabCache[t];
      const idx = list?.findIndex(x => x.post.id === event.postId) ?? -1;
      if (idx !== -1 && list) {
        found = {
          ...list[idx],
          post: { ...list[idx].post, visibility: event.visibility }
        };
        // Update in-place in that cache
        this.tabCache[t] = list.map((x, i) => (i === idx ? found! : x));
        break;
      }
    }

    // Fallback: if not found in cache for some reason, use current visible list
    if (!found) {
      const before = this.posts();
      const idx = before.findIndex(x => x.post.id === event.postId);
      if (idx === -1) return;

      found = {
        ...before[idx],
        post: { ...before[idx].post, visibility: event.visibility }
      };
    }

    // If the action is archive/unarchive, move between posts<->archive caches
    moveBetweenPublicAndArchive(found);

    // Tagged tab: keep it there too (unless you specifically want to hide archived tagged posts)
    if (this.tabCache.tagged) {
      const taggedIdx = this.tabCache.tagged.findIndex(x => x.post.id === event.postId);
      if (taggedIdx !== -1) {
        this.tabCache.tagged = this.tabCache.tagged.map((x, i) => (i === taggedIdx ? found! : x));
      }
    }

    // --- Update current visible list from its cache ---
    const after = this.tabCache[tab] ?? [];
    this.posts.set(after);

    // --- Keep modal navigation sane ---
    const currentIndex = this.selectedPostIndex();
    if (currentIndex === null) return;

    if (after.length === 0) {
      this.closePostModal();
      return;
    }

    if (currentIndex >= after.length) {
      this.selectedPostIndex.set(after.length - 1);
    }
  }

  ///  -======================================-  Tab Navigation Logic  -======================================- \\\
  async switchTab(tab: TabType) {
    this.activeTab.set(tab);

    // If we already preloaded and cached it, just swap the list
    const cached = this.tabCache[tab];
    if (cached) {
      this.posts.set(cached);
      return;
    }

    // If not cached yet (edge case), load just once and cache it
    const userId = this.cachedProfileUserId;
    const state = this.cachedViewState;

    if (!userId || state === null) return;

    this.loading.set(true);
    try {
      if (tab === 'posts') await this.loadUserPosts(userId, state);
      if (tab === 'tagged') await this.loadTaggedPosts(userId, state);
      if (tab === 'archive') await this.loadArchivedPosts(userId);

      this.tabCache[tab] = this.posts();
    } finally {
      this.loading.set(false);
    }
  }

  ///  -======================================-  Follow Logic  -======================================- \\\
  async onFollow() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.follow(profile.id);
      await this.refreshFollowUiAfterAction('follow');
    } catch (err) {
      console.error('[Account] Failed to follow:', err);
    }
  }

  async onUnfollow() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.unfollow(profile.id);
      await this.refreshFollowUiAfterAction('unfollow');
    } catch (err) {
      console.error('[Account] Failed to unfollow:', err);
    }
  }

  async onCancelRequest() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.cancelRequest(profile.id);
      await this.refreshFollowUiAfterAction('cancel');
    } catch (err) {
      console.error('[Account] Failed to cancel request:', err);
    }
  }

  private async refreshFollowUiAfterAction(kind: 'follow' | 'unfollow' | 'cancel') {
    const profile = this.profileUser();
    if (!profile) return;

    // Update viewState + counts optimistically
    if (kind === 'follow') {
      if (profile.private) {
        // Private accounts -> request pending
        this.viewState.set(AccountViewState.REQUESTED);
        // followerCount should NOT change until they accept
      } else {
        this.viewState.set(AccountViewState.FOLLOWING_PUBLIC);
        this.followerCount.update(n => n + 1);
      }
    }

    if (kind === 'unfollow') {
      this.viewState.set(profile.private ? AccountViewState.NOT_FOLLOWING_PRIVATE : AccountViewState.NOT_FOLLOWING_PUBLIC);
      this.followerCount.update(n => Math.max(0, n - 1));
    }

    if (kind === 'cancel') {
      this.viewState.set(AccountViewState.NOT_FOLLOWING_PRIVATE);
    }

    // Refresh the right-side social panel lists (cheap compared to reloadAccount)
    await this.loadSocialData(profile.id);
  }


  ///  -======================================-  Request Logic  -======================================- \\\
  async onAcceptRequest(requesterId: string) {
    try {
      await this.followsService.acceptRequest(requesterId);
      
      // ✅ NEW: Reset the flag since request is now accepted
      this.profileUserHasRequestedMe.set(false);
      
      // Refresh data and re-determine view state
      const profile = this.profileUser();
      if (profile) {
        await this.loadUserCounts(profile.id);
        await this.loadSocialData(profile.id);
        
        // ✅ Re-determine view state to update buttons
        const newState = await this.determineViewState();
        this.viewState.set(newState);
      }
    } catch (err) {
      console.error('[Account] Failed to accept request:', err);
    }
  }

  async onRejectRequest(requesterId: string) {
    try {
      await this.followsService.rejectRequest(requesterId);
      
      // ✅ NEW: Reset the flag since request is now rejected
      this.profileUserHasRequestedMe.set(false);
      
      // Refresh data and re-determine view state
      const profile = this.profileUser();
      if (profile) {
        await this.loadSocialData(profile.id);
        
        // ✅ Re-determine view state to update buttons
        const newState = await this.determineViewState();
        this.viewState.set(newState);
      }
    } catch (err) {
      console.error('[Account] Failed to reject request:', err);
    }
  }


  ///  -======================================-  Unblock Logic  -======================================- \\\
  async onUnblock() {
    const profile = this.profileUser();
    if (!profile) return;

    await this.blocksService.unblockUserById(profile.id);

    window.location.reload()
  }


  ///  -======================================-  Helper Methods  -======================================- \\\
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }

  private async loadSocialData(userId: string) {
    try {
      // Load followers
      const { data: followerData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followee_id', userId);

      if (followerData) {
        const followerIds = followerData.map(f => f.follower_id);
        const followers = await Promise.all(
          followerIds.map(id => this.usersService.getUserProfileById(id))
        );
        this.followers.set(followers.filter(f => f !== null) as UserModel[]);
      }

      // Load following
      const { data: followingData } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', userId);

      if (followingData) {
        const followingIds = followingData.map(f => f.followee_id);
        const following = await Promise.all(
          followingIds.map(id => this.usersService.getUserProfileById(id))
        );
        this.following.set(following.filter(f => f !== null) as UserModel[]);
      }

      // Load requests (only for own account)
      if (this.isOwnAccount()) {
        const { data: requestData } = await supabase
          .from('follow_requests')
          .select('requester_id')
          .eq('target_id', userId);

        if (requestData) {
          const requesterIds = requestData.map(r => r.requester_id);
          const requesters = await Promise.all(
            requesterIds.map(id => this.usersService.getUserProfileById(id))
          );
          this.requests.set(requesters.filter(r => r !== null) as UserModel[]);
        }
      }
    } catch (err) {
      console.error('[Account] Failed to load social data:', err);
    }
  }

  formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();

      return `${month} ${day}, ${year}`;
    } catch {
      return '';
    }
  }
}