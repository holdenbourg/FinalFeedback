import { Component, DoCheck, HostBinding, inject, OnInit, signal } from '@angular/core';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { LogoutModalComponent } from '../logout-modal/logout-modal.component';
import { PrivacyPolicyContentComponent } from '../privacy-policy-content/privacy-policy-content.component';
import { AuthService } from '../../core/auth.service';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { ModalOverlayService } from '../../services/modal-overlay.service';

@Component({
  selector: 'app-settings-privacy-policy',
  standalone: true,
  imports: [CommonModule, LogoutModalComponent, PrivacyPolicyContentComponent],
  templateUrl: './settings-privacy-policy.component.html',
  styleUrl: './settings-privacy-policy.component.css'
})
export class SettingsPrivacyPolicyComponent implements OnInit, DoCheck {
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private usersService = inject(UsersService);
  private authService = inject(AuthService);
  private modalOverlayService = inject(ModalOverlayService);

  currentUser = signal<UserModel | null>(null);
  showLogoutModal = false;

  @HostBinding('class.modal-open')
  get isModalOpen() { return this.showLogoutModal; }

  ngDoCheck() {
    if (this.isModalOpen) this.modalOverlayService.show();
    else this.modalOverlayService.hide();
  }

  async ngOnInit() {
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
    }
  }
}