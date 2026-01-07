import { Component, Input, Output, EventEmitter, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostModelWithAuthor } from '../../models/database-models/post.model';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { PostWithRating } from '../../models/helper-models/post-with-ratings.interface';

@Component({
  selector: 'app-post-detail-modal',
  standalone: true,
  imports: [CommonModule, FeedPostComponent],
  templateUrl: './post-detail-modal.component.html',
  styleUrl: './post-detail-modal.component.css'
})
export class PostDetailModalComponent {
  @Input() post!: PostWithRating;
  @Input() currentIndex: number = 0;
  @Input() totalPosts: number = 0;
  @Input() canNavigatePrevious: boolean = false;
  @Input() canNavigateNext: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() navigatePrevious = new EventEmitter<void>();
  @Output() navigateNext = new EventEmitter<void>();

  // Convert PostWithRating to PostModelWithAuthor for feed-post component
  get feedPost(): PostModelWithAuthor {
    return {
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
        profile_picture_url: this.post.author.profile_picture_url || 'assets/images/default-avatar.png'
      }
    };
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
    switch (event.key) {
      case 'Escape':
        this.onClose();
        break;
      case 'ArrowLeft':
        this.onPrevious();
        break;
      case 'ArrowRight':
        this.onNext();
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