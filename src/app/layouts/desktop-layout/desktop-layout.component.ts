import { Component, OnInit, OnDestroy, inject, signal, HostBinding } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { LogoutModalComponent } from '../../components/logout-modal/logout-modal.component';
import { AuthService } from '../../core/auth.service';
import { ModalOverlayService } from '../../services/modal-overlay.service';
import { NotificationsService } from '../../services/notifications.service';
import { RatingsService } from '../../services/ratings.service';
import { supabase } from '../../core/supabase.client';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-desktop-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LogoutModalComponent],
  templateUrl: './desktop-layout.component.html',
  styleUrl: './desktop-layout.component.css'
})
export class DesktopLayoutComponent implements OnInit, OnDestroy {
  public sidebarService = inject(SidebarService);
  public routingService = inject(RoutingService);
  public usersService = inject(UsersService);
  private authService = inject(AuthService);
  private router = inject(Router);
  public modalOverlayService = inject(ModalOverlayService);
  public notificationsService = inject(NotificationsService);
  private ratingsService = inject(RatingsService);

  @HostBinding('style.--bg-dim') get bgDim(): number {
    const url = this.router.url;
    if (url.startsWith('/login') || url.startsWith('/privacy-policy')) return 0;
    return 0.8;
  }

  currentUser = signal<UserModel | null>(null);
  authResolved = signal(false);
  hasRatings = signal(true); // default true to avoid flash of disabled state
  showLogoutModal = false;

  private navigationResolved = false;
  private authSubscription?: { unsubscribe: () => void };
  private navSubscription?: Subscription;

  async ngOnInit() {
    this.addRandomStartPointForRows();

    // Wait for the first NavigationEnd before showing sidebar to prevent
    // flash during async AuthGuard resolution
    this.navSubscription = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      take(1)
    ).subscribe(() => this.navigationResolved = true);

    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    this.authResolved.set(true);

    if (current) {
      await this.notificationsService.initialize();
      this.ratingsService.hasAnyRatings(current.id)
        .then(has => this.hasRatings.set(has))
        .catch(() => this.hasRatings.set(false));
    } else {
      this.hasRatings.set(false);
    }

    // Listen for auth state changes so sidebar updates on sign-in/sign-out
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const user = await this.usersService.getCurrentUserProfile();
        this.currentUser.set(user);
        if (user) {
          await this.notificationsService.initialize();
          this.ratingsService.hasAnyRatings(user.id)
            .then(has => this.hasRatings.set(has))
            .catch(() => this.hasRatings.set(false));
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser.set(null);
        this.hasRatings.set(false);
        this.notificationsService.unsubscribe();
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

  isActive(path: string): boolean {
    if (path === '/account') {
      const cu = this.currentUser();
      if (!cu) return false;
      const url = this.router.url;
      return url.startsWith(`/account/${cu.username}`);
    }
    if (path === '/') {
      const url = this.router.url;
      return url === '/' || url.startsWith('/?');
    }
    return this.router.url.startsWith(path);
  }
  isActiveSettings(path: string): boolean {
    return this.router.url === path;
  }

  // ✅ Check if any settings page is active
  isSettingsActive(): boolean {
    return this.router.url.startsWith('/settings') || this.router.url === '/logout';
  }

  showSidebar(): boolean {
    if (!this.navigationResolved) return false;
    const url = this.router.url;
    if (url === '/' || url.startsWith('/?')) return true;
    if (url.startsWith('/search')) return true;
    if (url.startsWith('/messages')) return true;
    if (url.startsWith('/library')) return true;
    if (url.startsWith('/summary')) return true;
    if (url.startsWith('/account')) return true;
    if (url.startsWith('/notifications')) return true;
    if (url.startsWith('/settings')) return true;

    return false;
  }

  onDisabledNavClick() {
    this.routingService.navigateToLogin();
  }

  getNavDelay(): string[] {
    const home = ['0', '1', '2', '3', '4', '5', '6', '7', '0'];
    const search = ['1', '0', '1', '2', '3', '4', '5', '6', '0'];
    const messages = ['2', '1', '0', '1', '2', '3', '4', '5', '0'];
    const library = ['3', '2', '1', '0', '1', '2', '3', '4', '0'];
    const summary = ['4', '3', '2', '1', '0', '1', '2', '3', '0'];
    const account = ['5', '4', '3', '2', '1', '0', '1', '2', '0'];
    const notifications = ['6', '5', '4', '3', '2', '1', '0', '1', '0'];
    const settings = ['7', '6', '5', '4', '3', '2', '1', '0', '0'];

    const url = this.router.url;
    if (url === '/' || url.startsWith('/?')) return home;
    if (url.startsWith('/search')) return search;
    if (url.startsWith('/messages')) return messages;
    if (url.startsWith('/library')) return library;
    if (url.startsWith('/summary')) return summary;
    if (url.startsWith('/account')) return account;
    if (url.startsWith('/notifications')) return notifications;
    if (url.startsWith('/settings')) return settings;

    return home;
  }

  async onLogout() {
    this.showLogoutModal = false;
    
    try {
      this.notificationsService.unsubscribe();
      await this.authService.signOut();
      this.routingService.navigateToLogin();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  // ✅ Background animation: Give each row a random starting position
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}