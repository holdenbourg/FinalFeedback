import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { supabase } from '../../core/supabase.client';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

@Component({
  selector: 'app-add-chat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-chat-modal.component.html',
  styleUrl: './add-chat-modal.component.css'
})
export class AddChatModalComponent implements OnInit, OnDestroy {
  @Output() cancel = new EventEmitter<void>();
  @Output() create = new EventEmitter<string[]>();

  private usersService = inject(UsersService);

  searchTerm = '';
  
  // Suggested users (followers/following combined)
  suggestedUsers = signal<UserModel[]>([]);
  
  // Search results (filtered suggested + database results)
  searchResults = signal<UserModel[]>([]);
  
  // Selected users for creating chat
  selectedUsers = signal<UserModel[]>([]);
  
  // Loading states
  isLoadingSuggested = signal(true);
  isSearching = signal(false);
  
  // Track if we're in search mode (user has typed something)
  isSearchMode = signal(false);

  currentUser = signal<UserModel | null>(null);
  
  // Store all suggested users for filtering
  private allSuggestedUsers: UserModel[] = [];

  // Debounce for database search
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  
  // Number of shimmer placeholders to show while searching
  shimmerCount = signal(0);

  async ngOnInit() {
    console.log('[AddChatModal] Initializing...');
    
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    console.log('[AddChatModal] Current user:', current?.username);
    
    await this.loadSuggestedUsers();
    
    // Set up debounced database search (400ms delay)
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        filter(term => term.length > 0) // Only search if there's a term
      )
      .subscribe(term => {
        console.log('[AddChatModal] Debounced search triggered for:', term);
        this.performDatabaseSearch(term);
      });
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.searchSubject.complete();
  }

  /**
   * Load suggested users (followers + following)
   */
  private async loadSuggestedUsers() {
    const currentUser = this.currentUser();
    if (!currentUser) {
      console.log('[AddChatModal] No current user, skipping suggested load');
      this.isLoadingSuggested.set(false);
      return;
    }

    this.isLoadingSuggested.set(true);
    console.log('[AddChatModal] Loading suggested users...');

    try {
      // Get follower IDs
      const { data: followerData, error: followerError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followee_id', currentUser.id);

      if (followerError) {
        console.error('[AddChatModal] Error fetching followers:', followerError);
      }

      // Get following IDs
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', currentUser.id);

      if (followingError) {
        console.error('[AddChatModal] Error fetching following:', followingError);
      }

      const userIds = new Set<string>();
      
      if (followerData) {
        followerData.forEach(f => userIds.add(f.follower_id));
      }
      if (followingData) {
        followingData.forEach(f => userIds.add(f.followee_id));
      }

      console.log('[AddChatModal] Found user IDs:', Array.from(userIds));

      // Fetch user profiles
      const profiles = await Promise.all(
        Array.from(userIds).map(id => this.usersService.getUserProfileById(id))
      );

      this.allSuggestedUsers = profiles.filter(p => p !== null) as UserModel[];
      this.suggestedUsers.set(this.allSuggestedUsers);
      
      console.log('[AddChatModal] Loaded suggested users:', this.allSuggestedUsers.map(u => u.username));

    } catch (error) {
      console.error('[AddChatModal] Error loading suggested users:', error);
    } finally {
      this.isLoadingSuggested.set(false);
    }
  }

  /**
   * Handle search input changes - Instagram style
   */
  onSearchInput() {
    const term = this.searchTerm.trim().toLowerCase();
    console.log('[AddChatModal] Search input changed:', term);
    
    if (!term) {
      // Clear search mode - show suggested
      console.log('[AddChatModal] Empty search, showing suggested');
      this.isSearchMode.set(false);
      this.searchResults.set([]);
      this.shimmerCount.set(0);
      this.isSearching.set(false);
      return;
    }

    // Enter search mode
    this.isSearchMode.set(true);

    // Immediately filter suggested users (instant feedback)
    const filteredSuggested = this.allSuggestedUsers.filter(user =>
      user.username.toLowerCase().includes(term) ||
      user.first_name?.toLowerCase().includes(term) ||
      user.last_name?.toLowerCase().includes(term)
    );

    console.log('[AddChatModal] Filtered suggested:', filteredSuggested.map(u => u.username));

    // Show filtered suggested at top
    this.searchResults.set(filteredSuggested);
    
    // Show shimmer placeholders for incoming database results
    this.shimmerCount.set(5);
    this.isSearching.set(true);
    
    // Trigger debounced database search
    this.searchSubject.next(term);
  }

  /**
   * Perform database search for users not in suggested list
   */
  private async performDatabaseSearch(term: string) {
    const currentUser = this.currentUser();
    if (!currentUser) {
      console.log('[AddChatModal] No current user for database search');
      this.shimmerCount.set(0);
      this.isSearching.set(false);
      return;
    }

    console.log('[AddChatModal] Performing database search for:', term);

    try {
      // Search database
      const searchResults = await this.usersService.searchUsersExcludingBlockedAndSelf(
        term,
        currentUser.id,
        20,
        0
      );

      console.log('[AddChatModal] Database search returned:', searchResults?.length || 0, 'users');

      // Get current filtered suggested (re-filter in case searchTerm changed)
      const currentTerm = this.searchTerm.trim().toLowerCase();
      const filteredSuggested = this.allSuggestedUsers.filter(user =>
        user.username.toLowerCase().includes(currentTerm) ||
        user.first_name?.toLowerCase().includes(currentTerm) ||
        user.last_name?.toLowerCase().includes(currentTerm)
      );

      // Filter out users already in suggested from database results
      const suggestedIds = new Set(filteredSuggested.map(u => u.id));
      const otherUsers = (searchResults || []).filter(user => !suggestedIds.has(user.id));

      console.log('[AddChatModal] Other users from DB:', otherUsers.map(u => u.username));

      // Combine: suggested matches first, then other users
      this.searchResults.set([...filteredSuggested, ...otherUsers]);
      
    } catch (error) {
      console.error('[AddChatModal] Error searching users:', error);
    } finally {
      this.shimmerCount.set(0);
      this.isSearching.set(false);
    }
  }

  /**
   * Toggle user selection
   */
  toggleUser(user: UserModel) {
    const current = this.selectedUsers();
    const isSelected = current.some(u => u.id === user.id);

    if (isSelected) {
      this.selectedUsers.set(current.filter(u => u.id !== user.id));
    } else {
      this.selectedUsers.set([...current, user]);
    }
    
    console.log('[AddChatModal] Selected users:', this.selectedUsers().map(u => u.username));
  }

  /**
   * Check if user is selected
   */
  isSelected(user: UserModel): boolean {
    return this.selectedUsers().some(u => u.id === user.id);
  }

  onCancel() {
    this.cancel.emit();
  }

  onCreate() {
    const userIds = this.selectedUsers().map(u => u.id);
    console.log('[AddChatModal] Creating chat with user IDs:', userIds);
    this.create.emit(userIds);
  }

  /**
   * Generate array for shimmer placeholders
   */
  getShimmerArray(): number[] {
    return Array(this.shimmerCount()).fill(0).map((_, i) => i);
  }
}