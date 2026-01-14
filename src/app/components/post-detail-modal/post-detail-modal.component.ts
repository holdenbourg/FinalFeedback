import { Component, Input, Output, EventEmitter, inject, HostListener, ChangeDetectorRef, OnInit, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostModelWithAuthor } from '../../models/database-models/post.model';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { PostWithRating } from '../../models/helper-models/post-with-ratings.interface';
import { RatingsService } from '../../services/ratings.service';
import { supabase } from '../../core/supabase.client';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-post-detail-modal',
  standalone: true,
  imports: [CommonModule, FeedPostComponent],
  templateUrl: './post-detail-modal.component.html',
  styleUrl: './post-detail-modal.component.css'
})
export class PostDetailModalComponent implements OnInit, OnChanges {
  private changeDetectorRef = inject(ChangeDetectorRef);
  private ratingsService = inject(RatingsService);
  private usersService = inject(UsersService);
  
  @Input() post!: PostWithRating;
  @Input() currentIndex: number = 0;
  @Input() totalPosts: number = 0;
  @Input() canNavigatePrevious: boolean = false;
  @Input() canNavigateNext: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() navigatePrevious = new EventEmitter<void>();
  @Output() navigateNext = new EventEmitter<void>();
  @Output() postUpdated = new EventEmitter<{ index: number; likeCount: number }>();
  @Output() postDeleted = new EventEmitter<{ postId: string; ratingId: string }>();
  @Output() postVisibilityChanged = new EventEmitter<{ postId: string; visibility: 'public' | 'archived' }>();

  currentUser = signal<UserModel | null>(null);

  feedPost!: PostModelWithAuthor;

  // ========== Menu / Confirm UI state ==========
  menuOpen = false;
  confirmOpen = false;
  confirmMode: 'delete' | 'archive' | 'unarchive' | null = null;


  async ngOnInit() {
    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    
    this.updateFeedPost();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['post'] && !changes['post'].firstChange) {
      this.updateFeedPost();
      this.changeDetectorRef.markForCheck();
    }
  }


  private updateFeedPost() {
    this.feedPost = {
      id: this.post.post.id,
      author_id: this.post.post.author_id,
      poster_url: this.post.rating.poster_url,
      caption: this.post.post.caption,
      visibility: this.post.post.visibility,
      like_count: this.post.post.like_count,
      save_count: this.post.post.save_count,
      comment_count: this.post.post.comment_count,
      tag_count: this.post.post.tag_count,
      created_at: this.post.post.created_at,
      rating_id: this.post.rating.id,
      author: {
        username: this.post.author.username,
        profile_picture_url:
          this.post.author.profile_picture_url || 'assets/images/default-avatar.png'
      }
    };
  }

  // ========== Menu ==========
  toggleMenu(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  openConfirm(mode: 'delete' | 'archive' | 'unarchive') {
    this.closeMenu();
    this.confirmMode = mode;
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.confirmMode = null;
  }

  get isArchived(): boolean {
    return this.feedPost?.visibility === 'archived';
  }

  // ========== Actions ==========
  async confirmAction() {
    if (!this.confirmMode) return;

    try {
      if (this.confirmMode === 'delete') {
        // Deleting the rating cascades the post + all post footprints.
        await this.ratingsService.deleteRating(this.feedPost.rating_id);
        this.postDeleted.emit({ postId: this.feedPost.id, ratingId: this.feedPost.rating_id });
        this.closeConfirm();
        this.onClose();
        return;
      }

      const newVisibility: 'public' | 'archived' = this.confirmMode === 'archive' ? 'archived' : 'public';

      const { error } = await supabase
        .from('posts')
        .update({ visibility: newVisibility })
        .eq('id', this.feedPost.id);

      if (error) throw error;

      // Update local state so UI updates instantly
      this.feedPost.visibility = newVisibility;
      this.post.post.visibility = newVisibility;
      this.postVisibilityChanged.emit({ postId: this.feedPost.id, visibility: newVisibility });

      this.closeConfirm();
      this.changeDetectorRef.markForCheck();
      this.changeDetectorRef.detectChanges();
    } catch (err) {
      console.error('Post action failed', err);
      alert('Something went wrong. Please try again.');
    }
  }

  onPostLikeChanged(newCount: number) {
    // Update the underlying post data
    this.post.post.like_count = newCount;
    this.feedPost.like_count = newCount;
    
    // Emit to parent (account component)
    this.postUpdated.emit({
      index: this.currentIndex,
      likeCount: newCount
    });
    
    // Trigger detection
    this.changeDetectorRef.markForCheck();
    this.changeDetectorRef.detectChanges();
  }

  // ========== Navigation ==========

  onClose() {
    this.close.emit();
  }

  onPrevious() {
    if (this.canNavigatePrevious) {
      this.navigatePrevious.emit();
    }
  }

  onNext() {
    if (this.canNavigateNext) {
      this.navigateNext.emit();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // ✅ FIX: Check if user is typing in an input or textarea
    const target = event.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;

    switch (event.key) {
      case 'Escape':
        if (this.confirmOpen) {
          this.closeConfirm();
        } else if (this.menuOpen) {
          this.closeMenu();
        } else {
          this.onClose();
        }
        break;
      case 'ArrowLeft':
        if (!isTyping) {
          this.onPrevious();
        }
        break;
      case 'ArrowRight':
        if (!isTyping) {
          this.onNext();
        }
        break;
    }
  }

  onBackdropClick(event: MouseEvent) {
    // Only close if clicking the backdrop itself, not the content
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}