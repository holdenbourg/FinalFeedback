import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { UsersService } from '../../services/users.service';
import { PostsService } from '../../services/posts.service';
import { RatingsService } from '../../services/ratings.service';
import { TagsService } from '../../services/tags.service';
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
  private router = inject(Router);
  private usersService = inject(UsersService);
  private postsService = inject(PostsService);
  private ratingsService = inject(RatingsService);
  private tagsService = inject(TagsService);
  private followsService = inject(FollowsService);
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private blocksService = inject(BlocksService);

  // State signals
  currentUser = signal<UserModel | null>(null);
  profileUser = signal<UserModel | null>(null);
  viewState = signal<AccountViewState>(AccountViewState.LOADING);
  activeTab = signal<TabType>('posts');
  
  posts = signal<PostWithRating[]>([]);
  loading = signal(true);
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

  showFollowButton = computed(() => this.canFollow());
  
  showUnfollowButton = computed(() => {
    const state = this.viewState();
    return state === AccountViewState.FOLLOWING_PUBLIC ||
           state === AccountViewState.FOLLOWING_PRIVATE;
  });

  showRequestedButton = computed(() => 
    this.viewState() === AccountViewState.REQUESTED
  );

  followButtonText = computed(() => {
    const user = this.profileUser();
    return user?.private ? 'Request' : 'Follow';
  });

  async ngOnInit() {
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
      await this.loadPostsForTab(tab, profile.id, state);

      // Load social data (followers/following/requests)
      await this.loadSocialData(profile.id);

    } catch (err) {
      console.error('[Account] Failed to load account:', err);
      this.viewState.set(AccountViewState.NOT_FOUND);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Determine the account view state based on relationships
   */
  private async determineViewState(): Promise<AccountViewState> {
    const current = this.currentUser();
    const profile = this.profileUser();

    if (!current || !profile) {
      console.log('account not found');
      return AccountViewState.NOT_FOUND;
    }

    // Check if viewing own account
    if (current.id === profile.id) {
      console.log('own account');
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

    // Check if following
    const isFollowing = await this.followsService.isFollowing(
      current.id,
      profile.id
    );

    if (isFollowing) {
      console.log('following');
      return profile.private
        ? AccountViewState.FOLLOWING_PRIVATE
        : AccountViewState.FOLLOWING_PUBLIC;
    }

    // Check if follow request is pending
    const hasRequested = await this.followsService.hasRequestedToFollow(
      current.id,
      profile.id
    );

    if (hasRequested) {
      console.log('requested');
      return AccountViewState.REQUESTED;
    }

    // Not following - check if account is private
    console.log('not follwing');

    return profile.private
      ? AccountViewState.NOT_FOLLOWING_PRIVATE
      : AccountViewState.NOT_FOLLOWING_PUBLIC;
  }

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
   * Load complete post data with ratings, authors, and tags
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

      // Batch queries in parallel
      const [ratingsRes, authorsRes, tagsRes] = await Promise.all([
        // Get all ratings
        supabase
          .from('ratings')
          .select('*')
          .in('id', ratingIds),
        
        // Get all authors
        supabase
          .from('users')
          .select('*') // ✅ Get all fields to match UserModel
          .in('id', authorIds),
        
        // Get all tags
        supabase
          .from('tags')
          .select('target_id, tagged_id')
          .eq('target_type', 'post')
          .eq('status', 'public')
          .in('target_id', postIds)
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

      // Assemble results
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


  ///  -======================================-  Tab Navigation Logic  -======================================- \\\
  switchTab(tab: TabType) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }


  ///  -======================================-  Follow Logic  -======================================- \\\
  async onFollow() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.follow(profile.id);
      
      // Reload account to update state
      await this.loadAccount(this.username(), this.activeTab());
    } catch (err) {
      console.error('[Account] Failed to follow:', err);
    }
  }

  async onUnfollow() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.unfollow(profile.id);
      
      // Reload account to update state
      await this.loadAccount(this.username(), this.activeTab());
    } catch (err) {
      console.error('[Account] Failed to unfollow:', err);
    }
  }

  async onCancelRequest() {
    const profile = this.profileUser();
    if (!profile) return;

    try {
      await this.followsService.cancelRequest(profile.id);
      
      // Reload account to update state
      await this.loadAccount(this.username(), this.activeTab());
    } catch (err) {
      console.error('[Account] Failed to cancel request:', err);
    }
  }


  ///  -======================================-  Request Logic  -======================================- \\\
  async onAcceptRequest(requesterId: string) {
    try {
      await this.followsService.acceptRequest(requesterId);
      
      // Reload social data and account
      const profile = this.profileUser();
      if (profile) {
        await this.loadSocialData(profile.id);
        await this.loadAccount(this.username(), this.activeTab());
      }
    } catch (err) {
      console.error('[Account] Failed to accept request:', err);
    }
  }

  async onRejectRequest(requesterId: string) {
    try {
      await this.followsService.rejectRequest(requesterId);
      
      // Reload social data
      const profile = this.profileUser();
      if (profile) {
        await this.loadSocialData(profile.id);
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
  ///  -======================================-  Profile Options  -======================================- \\\
  onEditProfile() {
    //!this.routingService.navigateToEditProfile();
  }

  ///  -======================================-  Helper Methods  -======================================- \\\
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