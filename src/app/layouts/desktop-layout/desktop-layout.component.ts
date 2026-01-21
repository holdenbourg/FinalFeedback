import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { LogoutModalComponent } from '../../components/logout-modal/logout-modal.component';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-desktop-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LogoutModalComponent],
  templateUrl: './desktop-layout.component.html',
  styleUrl: './desktop-layout.component.css'
})
export class DesktopLayoutComponent implements OnInit {
  public sidebarService = inject(SidebarService);
  public routingService = inject(RoutingService);
  public usersService = inject(UsersService);
  private authService = inject(AuthService);
  private router = inject(Router);
  
  currentUser = signal<UserModel | null>(null);
  showLogoutModal = false;

  async ngOnInit() {
    // ✅ Initialize background rows with random start points
    this.addRandomStartPointForRows();

    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
  }

  // ✅ Check if current route is active
  isActive(path: string): boolean {
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
    if (this.router.url.startsWith('/home')) return true;
    if (this.router.url.startsWith('/search')) return true;
    if (this.router.url.startsWith('/library')) return true;
    if (this.router.url.startsWith('/summary')) return true;
    if (this.router.url.startsWith('/account')) return true;
    if (this.router.url.startsWith('/settings')) return true;

    return false;
  }

  getNavDelay(): string[] {
    const home = ['0', '1', '2', '3', '4', '5', '0'];
    const search = ['1', '0', '1', '2', '3', '4', '0'];
    const library = ['2', '1', '0', '1', '2', '3', '0'];
    const summary = ['3', '2', '1', '0', '1', '2', '0'];
    const account = ['4', '3', '2', '1', '0', '1', '0'];
    const settings = ['5', '4', '3', '2', '1', '0', '0'];

    if (this.router.url.startsWith('/home')) return home;
    if (this.router.url.startsWith('/search')) return search;
    if (this.router.url.startsWith('/library')) return library;
    if (this.router.url.startsWith('/summary')) return summary;
    if (this.router.url.startsWith('/account')) return account;
    if (this.router.url.startsWith('/settings')) return settings;

    return home;
  }

  async onLogout() {
    this.showLogoutModal = false;
    
    try {
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