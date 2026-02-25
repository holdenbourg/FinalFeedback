import { Component, inject, signal, OnDestroy } from '@angular/core';
import { UserModel, EmailNotificationPreferences } from '../../models/database-models/user.model';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { UsersService } from '../../services/users.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-settings-notifications',
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-notifications.component.html',
    styleUrl: './settings-notifications.component.css'
})
export class SettingsNotificationsComponent implements OnDestroy {
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private usersService = inject(UsersService);

  currentUser = signal<UserModel | null>(null);
  preferences = signal<EmailNotificationPreferences>({
    messages: true,
    likes: true,
    comments: true,
    tags: true,
    ratings: true,
    follows: true,
    login_alerts: true,
  });

  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  isSaving = signal(false);
  private messageTimeout: any = null;

  async ngOnInit() {
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);

    if (current?.email_notifications) {
      this.preferences.set({ ...current.email_notifications });
    }
  }

  ngOnDestroy() {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }

  async onToggle(category: keyof EmailNotificationPreferences) {
    const user = this.currentUser();
    if (!user) return;

    this.clearMessages();
    this.isSaving.set(true);

    const updated = { ...this.preferences(), [category]: !this.preferences()[category] };

    try {
      const result = await this.usersService.updateEmailNotifications(user.id, updated);

      if (result.success) {
        this.preferences.set(updated);
        const label = this.getCategoryLabel(category);
        const state = updated[category] ? 'enabled' : 'disabled';
        this.showMessage('success', `${label} emails ${state}`);
      } else {
        this.showMessage('error', result.error || 'Failed to update preference');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Toggle notification preference error:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  private getCategoryLabel(category: keyof EmailNotificationPreferences): string {
    const labels: Record<keyof EmailNotificationPreferences, string> = {
      messages: 'Message',
      likes: 'Like',
      comments: 'Comment & Reply',
      tags: 'Tag',
      ratings: 'Rating',
      follows: 'Follow',
      login_alerts: 'Login alert',
    };
    return labels[category];
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
}
