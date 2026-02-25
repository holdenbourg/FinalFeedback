import { ChangeDetectionStrategy, Component, Input, inject, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoutingService } from '../../../services/routing.service';
import { FollowsService } from '../../../services/follow.service';
import { UsersService } from '../../../services/users.service';
import { UserModel } from '../../../models/database-models/user.model';

type RelationshipState = 
  | 'follow'        // Can follow (public, not following)
  | 'request'       // Can request (private, not requested)
  | 'following'     // Currently following
  | 'requested'     // Request pending
  | 'accept-decline'// User has requested you (you are private)
  | 'self';         // It's your own account

@Component({
    selector: 'app-searched-user',
    imports: [CommonModule],
    templateUrl: './searched-user.component.html',
    styleUrls: ['./searched-user.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchedUserComponent implements OnInit {
  public routingService = inject(RoutingService);
  private followsService = inject(FollowsService);
  private usersService = inject(UsersService);
  private cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) userDetails!: UserModel;

  relationshipState = signal<RelationshipState | null>(null);
  isProcessing = signal(false);
  currentUserId = signal<string | null>(null);

  async ngOnInit() {
    // Get current user ID
    const user = await this.usersService.getCurrentUserProfile();
    this.currentUserId.set(user?.id || null);
    
    // Determine relationship
    await this.loadRelationship();
  }

  private async loadRelationship() {
    const currentUserId = this.currentUserId();
    if (!currentUserId) return;

    // Check if it's own account
    if (this.userDetails.id === currentUserId) {
      this.relationshipState.set('self');
      this.cdr.markForCheck();
      return;
    }

    try {
      // Check if they requested you (you're private)
      const currentUser = await this.usersService.getCurrentUserProfile();
      if (currentUser?.private) {
        const hasRequested = await this.followsService.hasRequestedToFollow(
          this.userDetails.id,
          currentUserId
        );
        if (hasRequested) {
          this.relationshipState.set('accept-decline');
          this.cdr.markForCheck();
          return;
        }
      }

      // Check if you're following them
      const isFollowing = await this.followsService.isFollowing(
        currentUserId,
        this.userDetails.id
      );
      if (isFollowing) {
        this.relationshipState.set('following');
        this.cdr.markForCheck();
        return;
      }

      // Check if you requested them (they're private)
      if (this.userDetails.private) {
        const hasRequested = await this.followsService.hasRequestedToFollow(
          currentUserId,
          this.userDetails.id
        );
        if (hasRequested) {
          this.relationshipState.set('requested');
          this.cdr.markForCheck();
          return;
        }
        this.relationshipState.set('request');
      } else {
        this.relationshipState.set('follow');
      }

      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error loading relationship:', err);
    }
  }

  get avatar(): string {
    return this.userDetails?.profile_picture_url || 'assets/images/default-avatar.png';
  }

  get fullName(): string {
    const first = this.userDetails?.first_name || '';
    const last = this.userDetails?.last_name || '';
    return (first + ' ' + last).trim();
  }

  // ========== Actions ==========

  async onFollow() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.follow(this.userDetails.id);
      this.relationshipState.set('following');
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error following user:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async onUnfollow() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.unfollow(this.userDetails.id);
      
      // Determine new state
      if (this.userDetails.private) {
        this.relationshipState.set('request');
      } else {
        this.relationshipState.set('follow');
      }
      
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error unfollowing user:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async onRequest() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.follow(this.userDetails.id);
      this.relationshipState.set('requested');
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error requesting to follow:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async onCancelRequest() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.cancelRequest(this.userDetails.id);
      this.relationshipState.set('request');
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error canceling request:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async onAccept() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.acceptRequest(this.userDetails.id);
      
      // After accepting, they're now following you
      // Determine button state based on if you follow them back
      if (this.userDetails.private) {
        this.relationshipState.set('request');
      } else {
        this.relationshipState.set('follow');
      }
      
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error accepting request:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async onDecline() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    try {
      const currentUserId = this.currentUserId();
      if (!currentUserId) return;

      await this.followsService.rejectRequest(this.userDetails.id);
      
      // After declining, same as accept - show follow/request
      if (this.userDetails.private) {
        this.relationshipState.set('request');
      } else {
        this.relationshipState.set('follow');
      }
      
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error declining request:', err);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  goToProfile(event: Event) {
    // Only navigate if clicking the item itself, not a button
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    
    this.routingService.navigateToAccountsPosts(this.userDetails.username);
  }
}