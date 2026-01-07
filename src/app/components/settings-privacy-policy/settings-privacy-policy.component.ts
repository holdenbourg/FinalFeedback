import { Component, inject, OnInit, signal } from '@angular/core';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { LogoutModalComponent } from '../logout-modal/logout-modal.component';
import { AuthService } from '../../core/auth.service';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';

@Component({
  selector: 'app-settings-privacy-policy',
  standalone: true,
  imports: [CommonModule, PrivacyPolicyComponent, LogoutModalComponent],
  templateUrl: './settings-privacy-policy.component.html',
  styleUrl: './settings-privacy-policy.component.css'
})
export class SettingsPrivacyPolicyComponent implements OnInit {
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private usersService = inject(UsersService);
  private authService = inject(AuthService);

  currentUser = signal<UserModel | null>(null);
  
  showLogoutModal = false;

  // Status messages
  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  private messageTimeout: any = null;

  lastUpdated = 'January 7, 2026';
  companyName = 'What2Watch';
  contactEmail = 'privacy@what2watch.org';
  websiteUrl = 'https://what2watch.org';

  async ngOnInit() {
    this.addRandomStartPointForRows();

    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
  }


  async onLogout() {
    this.showLogoutModal = false;
    
    try {
      await this.authService.signOut();
      this.routingService.navigateToLogin();
    } catch (err) {
      console.error('Logout error:', err);
      this.showMessage('error', 'Failed to log out. Please try again.');
    }
  }

  showMessage(type: 'success' | 'error', message: string, duration = 5000) {
    // Clear any existing timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    
    // Set the message
    if (type === 'success') {
      this.successMessage.set(message);
      this.errorMessage.set('');
    } else {
      this.errorMessage.set(message);
      this.successMessage.set('');
    }
    
    // Auto-clear after duration
    this.messageTimeout = setTimeout(() => {
      this.clearMessages();
    }, duration);
  }

  clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
    
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
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
