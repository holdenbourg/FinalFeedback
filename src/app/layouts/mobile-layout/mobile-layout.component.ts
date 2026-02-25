import { Component, OnInit, OnDestroy, inject, signal, HostBinding, NgZone } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { UserModel } from '../../models/database-models/user.model';
import { CommonModule } from '@angular/common';
import { supabase } from '../../core/supabase.client';
import { RatingsService } from '../../services/ratings.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-mobile-layout',
    imports: [CommonModule, RouterOutlet],
    templateUrl: './mobile-layout.component.html',
    styleUrl: './mobile-layout.component.css'
})
export class MobileLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private usersService = inject(UsersService);
  private ratingsService = inject(RatingsService);
  private ngZone = inject(NgZone);

  @HostBinding('style.--bg-dim') get bgDim(): number {
    const url = this.router.url;
    if (url.startsWith('/login') || url.startsWith('/privacy-policy') || url.startsWith('/auth')) return 0;
    return 0.8;
  }

  currentUser = signal<UserModel | null>(null);
  authResolved = signal(false);
  hasRatings = signal(true);
  unreadCount = 0;

  private navigationResolved = false;
  private wasAlreadySignedIn = false;
  private authSubscription?: { unsubscribe: () => void };
  private navSubscription?: Subscription;

  async ngOnInit() {
    this.addRandomStartPointForRows();

    this.navSubscription = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      take(1)
    ).subscribe(() => this.navigationResolved = true);

    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    this.authResolved.set(true);

    if (current) {
      this.wasAlreadySignedIn = true;
      this.ratingsService.hasAnyRatings(current.id)
        .then(has => this.hasRatings.set(has))
        .catch(() => this.hasRatings.set(false));

      // Sync OAuth avatar on initial load too (not just on auth state change)
      this.syncOAuthAvatar(current);
    } else {
      this.hasRatings.set(false);
    }

    // Listen for auth state changes so bottom nav updates on sign-in/sign-out
    // Wrapped in NgZone.run() so Angular change detection fires after signal updates
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      this.ngZone.run(async () => {
        if (event === 'SIGNED_IN') {
          const user = await this.usersService.getCurrentUserProfile();
          this.currentUser.set(user);
          if (user) {
            this.ratingsService.hasAnyRatings(user.id)
              .then(has => this.hasRatings.set(has))
              .catch(() => this.hasRatings.set(false));

            // Sync OAuth avatar if user has no profile picture
            this.syncOAuthAvatar(user);

            // Fire login alert email only on genuine new sign-ins
            // (not on session restore / tab refocus / token refresh)
            if (!this.wasAlreadySignedIn && user.email_notifications?.login_alerts) {
              supabase.functions.invoke('send-notification-email', {
                body: {
                  notification_type: 'login_alert',
                  recipient_email: user.email,
                  recipient_name: user.first_name || user.username,
                  actor_username: user.username,
                  metadata: { timestamp: new Date().toLocaleString(), method: 'Web browser' },
                },
              }).catch(() => {});
            }
            this.wasAlreadySignedIn = true;
          }
        } else if (event === 'SIGNED_OUT') {
          this.currentUser.set(null);
          this.hasRatings.set(false);
        }
      });
    });
    this.authSubscription = data.subscription;
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.navSubscription?.unsubscribe();
  }

  isAuthenticated(): boolean {
    return !!this.currentUser();
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  navigateOrLogin(path: string) {
    if (this.isAuthenticated()) {
      this.router.navigateByUrl(path);
    } else {
      this.router.navigateByUrl('/login');
    }
  }

  isActive(path: string): boolean {
    if (path === '/') {
      const url = this.router.url;
      return url === '/' || url.startsWith('/?');
    }
    if (path === '/account') {
      const cu = this.currentUser();
      if (!cu) return false;
      return this.router.url.startsWith(`/account/${cu.username}`);
    }
    return this.router.url.startsWith(path);
  }

  showBottomNav() {
    if (!this.navigationResolved) return false;
    const url = this.router.url;
    if (url === '/' || url.startsWith('/?')) return true;
    if (url.startsWith('/search')) return true;
    if (url.startsWith('/library')) return true;
    if (url.startsWith('/summary')) return true;
    if (url.startsWith('/account')) return true;
    if (url.startsWith('/settings')) return true;

    return false;
  }

  // Sync Google/GitHub OAuth avatar to profile_picture_url if missing
  private async syncOAuthAvatar(user: UserModel) {
    if (user.profile_picture_url) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const avatarUrl = authUser?.user_metadata?.['avatar_url']
        || authUser?.user_metadata?.['picture'];
      if (avatarUrl) {
        await this.usersService.updateUserProfile(user.id, { profile_picture_url: avatarUrl });
        const updated = await this.usersService.getCurrentUserProfile();
        if (updated) this.currentUser.set(updated);
      }
    } catch {
      // non-critical — silently ignore
    }
  }

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}