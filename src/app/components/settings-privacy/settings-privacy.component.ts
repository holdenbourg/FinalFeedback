// src/app/components/settings-privacy/settings-privacy.component.ts

import { Component, inject, signal, OnDestroy } from '@angular/core';
import { UserModel } from '../../models/database-models/user.model';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { UsersService } from '../../services/users.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogoutModalComponent } from '../logout-modal/logout-modal.component';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings-privacy',
  standalone: true,
  imports: [CommonModule, FormsModule, LogoutModalComponent],
  templateUrl: './settings-privacy.component.html',
  styleUrl: './settings-privacy.component.css'
})
export class SettingsPrivacyComponent implements OnDestroy {
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private usersService = inject(UsersService);
  private authService = inject(AuthService);

  showLogoutModal = false;

  // State signals
  currentUser = signal<UserModel | null>(null);
  blockedUsers = signal<UserModel[]>([]);
  isPrivate = signal(false);
  
  // Loading states
  isTogglingPrivacy = signal(false);
  unblockingUserId = signal<string | null>(null);
  
  // Status messages
  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  private messageTimeout: any = null;
  
  async ngOnInit() {
    this.addRandomStartPointForRows();
    
    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    
    if (current) {
      this.isPrivate.set(current.private);
      
      // Load blocked users
      await this.loadBlockedUsers(current.id);
    }
  }
  
  ngOnDestroy() {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }
  
  // ========== Load Blocked Users ==========
  
  async loadBlockedUsers(userId: string) {
    try {
      const blocked = await this.usersService.getBlockedUsers(userId);
      this.blockedUsers.set(blocked);
    } catch (err) {
      console.error('Error loading blocked users:', err);
    }
  }
  
  // ========== Toggle Privacy ==========
  
  async onTogglePrivacy() {
    const user = this.currentUser();
    if (!user) return;
    
    this.clearMessages();
    this.isTogglingPrivacy.set(true);
    
    const newPrivacyValue = !this.isPrivate();
    
    try {
      const result = await this.usersService.updateAccountPrivacy(user.id, newPrivacyValue);
      
      if (result.success) {
        this.isPrivate.set(newPrivacyValue);
        
        const message = newPrivacyValue
          ? 'Account is now private'
          : 'Account is now public';
        
        this.showMessage('success', message);
        
        // Reload user data
        const updated = await this.usersService.getCurrentUserProfile();
        this.currentUser.set(updated);
      } else {
        this.showMessage('error', result.error || 'Failed to update privacy');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Toggle privacy error:', err);
    } finally {
      this.isTogglingPrivacy.set(false);
    }
  }
  
  // ========== Unblock User ==========
  
  async onUnblockUser(blockedUser: UserModel) {
    const user = this.currentUser();
    if (!user) return;
    
    this.clearMessages();
    this.unblockingUserId.set(blockedUser.id);
    
    try {
      const result = await this.usersService.unblockUser(user.id, blockedUser.id);
      
      if (result.success) {
        this.showMessage('success', `Unblocked @${blockedUser.username}`);
        
        // Remove from blocked list
        const currentBlocked = this.blockedUsers();
        this.blockedUsers.set(currentBlocked.filter(u => u.id !== blockedUser.id));
      } else {
        this.showMessage('error', result.error || 'Failed to unblock user');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Unblock user error:', err);
    } finally {
      this.unblockingUserId.set(null);
    }
  }
  
  // ========== Helper Methods ==========
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
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    
    if (type === 'success') {
      this.successMessage.set(message);
      this.errorMessage.set('');
    } else {
      this.errorMessage.set(message);
      this.successMessage.set('');
    }
    
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