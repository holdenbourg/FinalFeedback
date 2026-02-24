import { Component, OnInit, OnDestroy, inject, signal, HostBinding } from '@angular/core';
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
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.css'
})
export class MobileLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private usersService = inject(UsersService);
  private ratingsService = inject(RatingsService);

  @HostBinding('style.--bg-dim') get bgDim(): number {
    const url = this.router.url;
    if (url.startsWith('/login') || url.startsWith('/privacy-policy')) return 0;
    return 0.8;
  }

  currentUser = signal<UserModel | null>(null);
  authResolved = signal(false);
  hasRatings = signal(true);
  unreadCount = 0;

  private navigationResolved = false;
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
      this.ratingsService.hasAnyRatings(current.id)
        .then(has => this.hasRatings.set(has))
        .catch(() => this.hasRatings.set(false));
    } else {
      this.hasRatings.set(false);
    }

    // Listen for auth state changes so bottom nav updates on sign-in/sign-out
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const user = await this.usersService.getCurrentUserProfile();
        this.currentUser.set(user);
        if (user) {
          this.ratingsService.hasAnyRatings(user.id)
            .then(has => this.hasRatings.set(has))
            .catch(() => this.hasRatings.set(false));
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser.set(null);
        this.hasRatings.set(false);
      }
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

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}