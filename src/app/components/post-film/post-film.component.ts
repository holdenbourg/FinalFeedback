import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { UsersService } from '../../services/users.service';
import { RoutingService } from '../../services/routing.service';
import { CommentModerationService } from '../../services/comment-moderation.service';
import { PostsService } from '../../services/posts.service';
import { RatingsService, MovieCriteria, SeriesCriteria } from '../../services/ratings.service';
import { TagsService } from '../../services/tags.service';

import { TaggedUserComponent } from '../templates/tagged-user/tagged-user.component';
import { UserModel } from '../../models/database-models/user.model';
import { FilmData, TaggedUser, FilmType } from '../../models/helper-models/film-data.model';

@Component({
    selector: 'app-post-film',
    imports: [CommonModule, FormsModule, TaggedUserComponent],
    templateUrl: './post-film.component.html',
    styleUrl: './post-film.component.css'
})
export class PostFilmComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);
  private routingService = inject(RoutingService);
  private commentModerationService = inject(CommentModerationService);
  private postsService = inject(PostsService);
  private ratingsService = inject(RatingsService);
  private tagsService = inject(TagsService);

  // Signals
  currentUser = signal<UserModel | null>(null);
  filmData = signal<FilmData | null>(null);
  taggedUsers = signal<TaggedUser[]>([]);
  searchResults = signal<TaggedUser[]>([]);

  // Form data
  filmType: FilmType = 'movie';
  caption = '';
  captionWarning = '';
  tagWarning = '';
  searchInput = '';
  searchLabelActive = false;
  isSearching = false;
  isPosting = false;

  get isMovie(): boolean {
    return this.filmType === 'movie';
  }

  get isSeries(): boolean {
    return this.filmType === 'series';
  }

  async ngOnInit() {
    // Get film type from route
    this.filmType = (this.route.snapshot.paramMap.get('type') as FilmType) ?? 'movie';

    // Load current user
    const user = await this.usersService.getCurrentUserProfile();
    if (!user) {
      this.routingService.navigateToHome();
      return;
    }
    this.currentUser.set(user);      

    // Load film data from session storage
    const storedFilmData = sessionStorage.getItem('currentFilmRating');

    if (storedFilmData) {
      try {
        const filmData: FilmData = JSON.parse(storedFilmData);
        this.filmData.set(filmData);
      } catch (err) {
        console.error('Failed to parse film data:', err);
        this.routingService.navigateToHome();
        return;
      }
    } else {
      this.routingService.navigateToHome();
      return;
    }

    // Load saved caption if exists
    const savedCaption = sessionStorage.getItem('currentCaption');
    if (savedCaption) {
      this.caption = savedCaption;
    }

    // Load saved tagged users if exists
    const savedTags = sessionStorage.getItem('taggedUsers');
    if (savedTags) {
      try {
        const tags: TaggedUser[] = JSON.parse(savedTags);
        this.taggedUsers.set(tags);
      } catch (err) {
        console.error('Failed to parse tagged users:', err);
      }
    }
  }

  ngOnDestroy() {
    sessionStorage.removeItem('currentFilmRating');
    sessionStorage.removeItem('taggedUsers');
    sessionStorage.removeItem('currentCaption');
  }

  // ========== Search & Tagging ==========

  async onSearchUsers() {
    const query = this.searchInput.trim();
    
    if (!query) {
      this.searchResults.set([]);
      return;
    }

    const currentUser = this.currentUser();
    const currentUsername = currentUser?.username.toLowerCase();
    
    if (query.toLowerCase() === currentUsername) {
      this.tagWarning = 'You cannot tag yourself';
      setTimeout(() => this.tagWarning = '', 3000);
      return;
    }

    if (!currentUser?.id) {
      console.error('No current user ID');
      return;
    }

    this.isSearching = true;

    try {
      // Use the new method that filters out blocked users
      const results = await this.usersService.searchUsersExcludingBlockedAndSelf(
        query, 
        currentUser.id, 
        10, 
        0
      );
      
      const taggedIds = new Set(this.taggedUsers().map(u => u.id));
      
      // Filter out already tagged users
      const filtered = results
        .filter(u => !taggedIds.has(u.id))
        .map(u => ({
          id: u.id,
          username: u.username,
          profile_picture_url: u.profile_picture_url
        }));

      this.searchResults.set(filtered);
    } catch (err) {
      console.error('Failed to search users:', err);
      this.searchResults.set([]);
    } finally {
      this.isSearching = false;
    }
  }

  onTagUser(user: TaggedUser) {
    const current = this.taggedUsers();
    
    if (current.length >= 15) {
      this.tagWarning = 'You can only tag up to 15 people';
      setTimeout(() => this.tagWarning = '', 3000);
      return;
    }

    const updated = [...current, user];
    this.taggedUsers.set(updated);
    
    // Save to session storage
    sessionStorage.setItem('taggedUsers', JSON.stringify(updated));
    
    // Remove from search results
    this.searchResults.set(this.searchResults().filter(u => u.id !== user.id));
    
    // Clear search input AND reset label state
    // this.searchInput = '';
    // this.searchLabelActive = false;
  }

  onUntagUser(user: TaggedUser) {
    const updated = this.taggedUsers().filter(u => u.id !== user.id);
    this.taggedUsers.set(updated);
    
    // Update session storage
    if (updated.length === 0) {
      sessionStorage.removeItem('taggedUsers');
    } else {
      sessionStorage.setItem('taggedUsers', JSON.stringify(updated));
    }
  }

  // ========== Caption Management ==========

  validateCaption(): boolean {
    const trimmed = this.caption.trim();

    // Use the caption-specific validation (allows empty captions)
    const result = this.commentModerationService.validateCaption(
      trimmed,
      this.currentUser()?.username ?? ''
    );

    if (!result.ok) {
      this.captionWarning = result.error;
      return false;
    }

    return true;
  }

  saveCaption() {
    sessionStorage.setItem('currentCaption', this.caption);
  }

  // ========== Post Actions ==========

  async onPost() {
    await this.createFilmPost('public');
  }

  async onArchive() {
    await this.createFilmPost('archived');
  }

  private async createFilmPost(visibility: 'public' | 'archived') {
    if (this.isPosting) return;

    if (!this.validateCaption()) {
      setTimeout(() => this.captionWarning = '', 3000);
      return;
    }

    const user = this.currentUser();
    const film = this.filmData();
    
    if (!user || !film) return;

    this.isPosting = true;

    try {
      // Step 1: Create the rating - createRating calculates rating internally
      console.log('[PostFilm] Creating rating...');
      
      const ratingId = await this.ratingsService.createRating(
        film.type,
        film.imdbId,
        film.title,
        this.posterSrc,
        film.criteria as MovieCriteria | SeriesCriteria,  // Criteria with runtime/seasons/episodes
        film.releaseDate,      // From API
        film.rated,            // From API (PG, PG-13, R, etc.)
        film.genres            // From API
      );
      
      console.log('[PostFilm] Rating created:', ratingId);

      // Step 2: Create the post
      console.log('[PostFilm] Creating post...');
      const postId = await this.postsService.createPost({
        rating_id: ratingId,
        poster_url: this.posterSrc,
        caption: this.caption.trim() || undefined,
        visibility: visibility
      });
      console.log('[PostFilm] Post created:', postId);

      // Step 3: Create tags (if any) with matching status
      const taggedUserIds = this.taggedUsers().map(u => u.id);
      if (taggedUserIds.length > 0) {
        console.log('[PostFilm] Creating tags with status:', visibility);
        await this.tagsService.createTags(postId, taggedUserIds, visibility);
        console.log('[PostFilm] Tags created successfully');
      }

      // Step 4: Create tags from @mentions in caption
      if (this.caption.trim()) {
        console.log('[PostFilm] Creating tags from caption @mentions');
        await this.tagsService.createTagsFromMentions(
          this.caption,
          'post',      // Target type is 'post' for captions
          postId,      // Target ID is the post ID
          postId       // Post ID for status checking (same as target)
        );
        console.log('[PostFilm] Caption tags created successfully');
      }

      // Success! Navigate to appropriate page
      if (visibility === 'public') {
        this.routingService.navigateToAccountsPosts(user.username);
      } else {
        this.routingService.navigateToAccountsArchive(user.username);
      }


    } catch (err) {
      console.error('[PostFilm] Failed to create post:', err);
      this.captionWarning = `Failed to ${visibility === 'public' ? 'post' : 'archive'}. Please try again.`;
      setTimeout(() => this.captionWarning = '', 3000);
    } finally {
      this.isPosting = false;
    }
  }

  // ========== Helper Methods ==========

  /**
   * Type-safe helper to get MovieCriteria from union type
   */
  getMovieCriteria(criteria: MovieCriteria | SeriesCriteria): MovieCriteria | null {
    if (this.isMovie) {
      return criteria as MovieCriteria;
    }
    return null;
  }

  /**
   * Type-safe helper to get SeriesCriteria from union type
   */
  getSeriesCriteria(criteria: MovieCriteria | SeriesCriteria): SeriesCriteria | null {
    if (this.isSeries) {
      return criteria as SeriesCriteria;
    }
    return null;
  }

  fixCommentDate(isoDate?: string): string {
    if (!isoDate) return '';
    
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return '';
      
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

  toggleSearchLabel() {
    this.searchLabelActive = true;
  }

  untoggleSearchLabel() {
    if (this.searchInput.length === 0) {
      this.searchLabelActive = false;
    }
  }

  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  // ✅ Get high-quality poster (w500 or original)
  get posterSrc(): string {
    if (!this.filmData()?.poster) {
      return 'assets/images/no-poster.png';
    }

    return `${this.tmdbImgBase}/original${this.filmData()?.poster}`;
    // Use w500 for good balance of quality and load time
    // Can also use 'w780' or 'original' for even higher quality
  }

  // ========== Template Helpers ==========

  get combinedUserList(): (TaggedUser & { isTagged: boolean })[] {
    const tagged = this.taggedUsers().map(u => ({ ...u, isTagged: true }));
    const search = this.searchResults().map(u => ({ ...u, isTagged: false }));
    return [...tagged, ...search];
  }
}