import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { UsersService } from '../../services/users.service';
import { RoutingService } from '../../services/routing.service';
import { CommentModerationService } from '../../services/comment-moderation.service';

import { UserModel } from '../../models/database-models/user-model';
import { TaggedUserComponent } from '../templates/tagged-user/tagged-user.component';

type FilmType = 'movie' | 'series';

interface RatingCriteria {
  acting: number;
  visuals: number;
  story: number;
  pacing: number;
  ending: number;
  climax?: number;  // Movies only
  length?: number;  // Series only
}

interface FilmData {
  imdbId: string;
  title: string;
  poster: string;
  type: FilmType;
  criteria: RatingCriteria;
  rating: number;
  dateRated: string;
}

interface TaggedUser {
  id: string;
  username: string;
  profile_picture_url: string | null;  // Allow null from database
}

@Component({
  selector: 'app-post-film',
  standalone: true,
  imports: [CommonModule, FormsModule, TaggedUserComponent],
  templateUrl: './post-film.component.html',
  styleUrl: './post-film.component.css'
})

export class PostFilmComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);
  private routingService = inject(RoutingService);
  private commentModerationService = inject(CommentModerationService);

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

  // Computed
  get watchedWithText(): string {
    const tagged = this.taggedUsers();
    const user = this.currentUser();
    
    if (!user || !this.filmData() || tagged.length === 0) {
      return '';
    }

    const firstName = user.first_name || user.username;
    const title = this.filmData()!.title;
    
    if (tagged.length === 1) {
      return `${firstName} watched ${title} with ${tagged[0].username}`;
    } else if (tagged.length === 2) {
      return `${firstName} watched ${title} with ${tagged[0].username} and ${tagged[1].username}`;
    } else {
      const names = tagged.slice(0, -1).map(u => u.username).join(', ');
      return `${firstName} watched ${title} with ${names}, and ${tagged[tagged.length - 1].username}`;
    }
  }

  get isMovie(): boolean {
    return this.filmType === 'movie';
  }

  get isSeries(): boolean {
    return this.filmType === 'series';
  }

  async ngOnInit() {
    this.addRandomStartPointForRows();
    
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

    const currentUsername = this.currentUser()?.username.toLowerCase();
    
    if (query.toLowerCase() === currentUsername) {
      this.tagWarning = 'You cannot tag yourself';
      setTimeout(() => this.tagWarning = '', 3000);
      return;
    }

    this.isSearching = true;

    try {
      const results = await this.usersService.searchUsersRpc(query, 10, 0);
      
      const taggedIds = new Set(this.taggedUsers().map(u => u.id));
      
      const filtered = results.filter(u => 
        !taggedIds.has(u.id) && 
        u.username.toLowerCase() !== currentUsername
      ).map(u => ({
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
    
    // Clear search
    this.searchInput = '';
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

    if (trimmed.length > 150) {
      this.captionWarning = 'Your caption cannot exceed 150 characters';
      return false;
    }

    const result = this.commentModerationService.validate(trimmed, {
      postId: '',
      authorUsername: this.currentUser()?.username ?? '',
      type: 'comment',
      existing: [],
      nowIso: new Date().toISOString()
    });

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
      // TODO: Implement actual post creation via Supabase
      // This would:
      // 1. Create a rating record
      // 2. Create a post record
      // 3. Create tag records for tagged users
      
      console.log('Posting:', {
        filmData: film,
        caption: this.caption,
        taggedUsers: this.taggedUsers()
      });

      // Navigate to posts
      this.routingService.navigateToAccountsPosts(user.username);

    } catch (err) {
      console.error('Failed to create post:', err);
      this.captionWarning = 'Failed to create post. Please try again.';
      setTimeout(() => this.captionWarning = '', 3000);
    } finally {
      this.isPosting = false;
    }
  }

  async onArchive() {
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
      // TODO: Implement actual archive creation via Supabase
      
      console.log('Archiving:', {
        filmData: film,
        caption: this.caption,
        taggedUsers: this.taggedUsers()
      });

      // Navigate to archived
      this.routingService.navigateToAccountsArchived(user.username);

    } catch (err) {
      console.error('Failed to archive post:', err);
      this.captionWarning = 'Failed to archive post. Please try again.';
      setTimeout(() => this.captionWarning = '', 3000);
    } finally {
      this.isPosting = false;
    }
  }

  // ========== Helper Methods ==========

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

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }

  toggleSearchLabel() {
    this.searchLabelActive = true;
  }

  untoggleSearchLabel() {
    if (this.searchInput.length === 0) {
      this.searchLabelActive = false;
    }
  }

  // ========== Template Helpers ==========

  get combinedUserList(): (TaggedUser & { isTagged: boolean })[] {
    const tagged = this.taggedUsers().map(u => ({ ...u, isTagged: true }));
    const search = this.searchResults().map(u => ({ ...u, isTagged: false }));
    return [...tagged, ...search];
  }
}