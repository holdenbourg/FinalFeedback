// src/app/components/settings-account-info/settings-account-info.component.ts
// COMPLETE FIXED VERSION

import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { LogoutModalComponent } from '../logout-modal/logout-modal.component';
import { AuthService } from '../../core/auth.service';
import { DeleteAccountModalComponent } from '../delete-account-modal/delete-account-modal.component';

@Component({
  selector: 'app-settings-account-info',
  standalone: true,
  imports: [CommonModule, 
            FormsModule, 
            LogoutModalComponent, 
            DeleteAccountModalComponent
          ],
  templateUrl: './settings-account-info.component.html',
  styleUrl: './settings-account-info.component.css'
})
export class SettingsAccountInfoComponent implements OnInit, OnDestroy {
  public routingService = inject(RoutingService);
  public sidebarService = inject(SidebarService);
  private usersService = inject(UsersService);
  private authService = inject(AuthService);

  showLogoutModal = false;

  // State signals
  currentUser = signal<UserModel | null>(null);
  isOAuthUser = signal(false);
  authProvider = signal<string>('');
  
  // Form fields
  username = '';
  email = '';
  firstName = '';
  lastName = '';
  bio = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  
  // Original values (to track changes)
  originalUsername = '';
  originalEmail = '';
  originalFirstName = '';
  originalLastName = '';
  originalBio = '';
  
  // Status messages
  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  private messageTimeout: any = null;
  
  // Loading states
  isUpdatingProfile = signal(false);
  isUpdatingEmail = signal(false);
  isUpdatingPassword = signal(false);
  isUploadingPicture = signal(false);
  
  // Track if form has changes
  hasProfileChanges = signal(false);
  
  // Drag and drop state (FIXED)
  isDraggingOver = signal(false);
  private dragCounter = 0; // Prevents flickering from child elements

  showDeleteAccountModal = false;
  isDeletingAccount = signal(false);
  
  async ngOnInit() {    
    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    
    if (current) {
      // Set current values
      this.username = current.username;
      this.email = current.email;
      this.firstName = current.first_name || '';
      this.lastName = current.last_name || '';
      this.bio = current.bio || '';
      
      // Store original values
      this.originalUsername = current.username;
      this.originalEmail = current.email;
      this.originalFirstName = current.first_name || '';
      this.originalLastName = current.last_name || '';
      this.originalBio = current.bio || '';
    }
    
    // Check if OAuth user
    await this.checkAuthMethod();
  }
  
  ngOnDestroy() {
    // Clear timeout on component destroy
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }
  
  // ========== Track Form Changes ==========
  
  checkForChanges() {
    const hasChanges = 
      this.username !== this.originalUsername ||
      this.firstName !== this.originalFirstName ||
      this.lastName !== this.originalLastName ||
      this.bio !== this.originalBio;
    
    this.hasProfileChanges.set(hasChanges);
  }
  
  // ========== Auto-Dismiss Messages ==========
  
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
  
  ///  -======================================-  Login/Register Logic  -======================================-  \\\  
  async checkAuthMethod() {
    try {
      const authUser = await this.usersService.getCurrentAuthUser();
      if (!authUser) return;
      
      // Access providers using bracket notation to avoid TS error
      const providers = authUser.app_metadata?.['providers'] as string[] || [];
      const oauthProviders = ['google', 'github', 'facebook', 'twitter', 'apple'];
      
      const oauthProvider = providers.find((p: string) => oauthProviders.includes(p));
      
      if (oauthProvider) {
        this.isOAuthUser.set(true);
        this.authProvider.set(this.capitalizeProvider(oauthProvider));
      }
    } catch (err) {
      console.error('Error checking auth method:', err);
    }
  }
  
  capitalizeProvider(provider: string): string {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  
  
  ///  -======================================-  Update Logic  -======================================-  \\\
  async onUpdateProfile() {
    const user = this.currentUser();
    if (!user) return;
    
    // Check if there are actually changes
    if (!this.hasProfileChanges()) {
      this.showMessage('error', 'No changes to save', 3000);
      return;
    }

    const validationError = this.validateProfileChanges();
    if (validationError) {
      this.showMessage('error', validationError);
      return;
    }
    
    this.clearMessages();
    this.isUpdatingProfile.set(true);
    
    try {
      const result = await this.usersService.updateUserProfile(user.id, {
        username: this.username.trim(),
        first_name: this.firstName.trim(),
        last_name: this.lastName.trim(),
        bio: this.bio.trim()
      });
      
      if (result.success) {
        this.showMessage('success', 'Profile updated successfully!');
        
        // Reload user data
        const updated = await this.usersService.getCurrentUserProfile();
        this.currentUser.set(updated);
        
        // Update original values
        if (updated) {
          this.originalUsername = updated.username;
          this.originalFirstName = updated.first_name || '';
          this.originalLastName = updated.last_name || '';
          this.originalBio = updated.bio || '';
          
          // ✅ UPDATE FORM FIELDS TOO
          this.username = updated.username;
          this.firstName = updated.first_name || '';
          this.lastName = updated.last_name || '';
          this.bio = updated.bio || '';
        }
        
        // Reset changes flag
        this.hasProfileChanges.set(false);
      } else {
        this.showMessage('error', result.error || 'Failed to update profile');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Update profile error:', err);
    } finally {
      this.isUpdatingProfile.set(false);
    }
  }

  async onUpdateEmail() {
    if (this.isOAuthUser()) {
      this.showMessage('error', `Cannot change email for ${this.authProvider()} accounts`);
      return;
    }

    const validationError = this.validateEmail();
    if (validationError) {
      this.showMessage('error', validationError);
      return;
    }
    
    this.clearMessages();
    this.isUpdatingEmail.set(true);
    
    try {
      const result = await this.usersService.updateUserEmail(this.email.trim());
      
      if (result.success) {
        this.showMessage('success', 'Email update initiated! Please check your new email for confirmation.', 7000);
        this.originalEmail = this.email.trim();
      } else {
        this.showMessage('error', result.error || 'Failed to update email');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Update email error:', err);
    } finally {
      this.isUpdatingEmail.set(false);
    }
  }

  async onUpdatePassword() {
    if (this.isOAuthUser()) {
      this.showMessage('error', `Cannot set password for ${this.authProvider()} accounts`);
      return;
    }

    const validationError = this.validatePassword();
    if (validationError) {
      this.showMessage('error', validationError);
      return;
    }
    
    this.clearMessages();
    this.isUpdatingPassword.set(true);
    
    try {
      const result = await this.usersService.updateUserPassword(this.newPassword);
      
      if (result.success) {
        this.showMessage('success', 'Password updated successfully!');
        this.newPassword = '';
        this.confirmPassword = '';
      } else {
        this.showMessage('error', result.error || 'Failed to update password');
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Update password error:', err);
    } finally {
      this.isUpdatingPassword.set(false);
    }
  }


  // ========== Delete Account ==========
  async onDeleteAccount() {
    const user = this.currentUser();
    if (!user) return;
    
    this.showDeleteAccountModal = false;
    this.clearMessages();
    this.isDeletingAccount.set(true);
    
    try {
      const result = await this.usersService.deleteUserAccount(user.id);
      
      if (result.success) {
        await this.authService.signOut();
        this.routingService.navigateToLogin();
      } else {
        this.showMessage('error', result.error || 'Failed to delete account');
        this.isDeletingAccount.set(false);
      }
    } catch (err) {
      console.error('Delete account error:', err);
      this.showMessage('error', 'An unexpected error occurred');
      this.isDeletingAccount.set(false);
    }
  }
  
  // ========== Drag and Drop Handlers (FIXED) ==========
  
  onDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Increment counter to track nested elements
    this.dragCounter++;
    
    // Only set dragging state on first enter
    if (this.dragCounter === 1) {
      this.isDraggingOver.set(true);
    }
  }
  
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Don't change state, just allow drop
  }
  
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Decrement counter
    this.dragCounter--;
    
    // Only hide when all elements have been left
    if (this.dragCounter === 0) {
      this.isDraggingOver.set(false);
    }
  }
  
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Reset drag state
    this.dragCounter = 0;
    this.isDraggingOver.set(false);
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      this.showMessage('error', 'Please drop an image file (JPG, PNG, GIF, or WebP)');
      return;
    }
    
    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showMessage('error', 'Image too large. Maximum size is 5MB.');
      return;
    }
    
    // Upload the file
    this.uploadFile(file);
  }
  
  // ========== Upload Profile Picture ==========
  async uploadFile(file: File) {
    const user = this.currentUser();
    if (!user) return;
    
    this.clearMessages();
    this.isUploadingPicture.set(true);
    
    try {
      const result = await this.usersService.uploadProfilePicture(user.id, file);
      
      if (result.success) {
        this.showMessage('success', 'Profile picture updated!');
        
        // Reload user data to get new picture URL
        const updated = await this.usersService.getCurrentUserProfile();
        this.currentUser.set(updated);
      } else {
        const errorMsg = result.error || 'Failed to upload picture';
        if (errorMsg.includes('Bucket not found')) {
          this.showMessage('error', 'Storage not configured. Please contact support.', 7000);
        } else {
          this.showMessage('error', errorMsg);
        }
      }
    } catch (err) {
      this.showMessage('error', 'An unexpected error occurred');
      console.error('Upload picture error:', err);
    } finally {
      this.isUploadingPicture.set(false);
    }
  }
  
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    await this.uploadFile(file);
    input.value = ''; // Reset file input
  }


  // -======================================-  Validator Helper Methods  -======================================- \\
  private containsAnySpecialCharacters(input: string): boolean {
    const specialCharacters = /[.,\[\]{}()_\-+=!@#$%^&*:;'"<>?|~\/\\]/;
    return specialCharacters.test(input);
  }

  private containsAllowedSpecialCharacters(input: string): boolean {
    const specialCharacters = /[!@#$%^&*]/;
    return specialCharacters.test(input);
  }

  private containsCapitalLetter(input: string): boolean {
    const capitalLetter = /[A-Z]/;
    return capitalLetter.test(input);
  }

  private containsNumber(input: string): boolean {
    const number = /\d/;
    return number.test(input);
  }

  private containsWhiteSpace(input: string): boolean {
    const whiteSpace = /\s/;
    return whiteSpace.test(input);
  }

  private inputWithinRange(input: string, min: number, max: number): boolean {
    return input.length >= min && input.length <= max;
  }

  private isUsernameValid(username: string): boolean {
    const allowedCharacters = /^[A-Za-z0-9]+$/;
    return allowedCharacters.test(username);
  }

  private isEmailValid(email: string): boolean {
    const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailFormat.test(email);
  }

  // -======================================-  Validation Methods  -======================================- \\

  private validateProfileChanges(): string | null {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const username = this.username.trim();

    // First Name validation
    if (firstName.length > 0) { // Only validate if not empty
      if (!this.inputWithinRange(firstName, 2, 16)) return 'First name must be 2–16 characters';
      if (this.containsWhiteSpace(firstName)) return `First name can't contain spaces`;
      if (this.containsAnySpecialCharacters(firstName)) return `First name can't have special characters`;
    }

    // Last Name validation
    if (lastName.length > 0) { // Only validate if not empty
      if (!this.inputWithinRange(lastName, 2, 16)) return 'Last name must be 2–16 characters';
      if (this.containsWhiteSpace(lastName)) return `Last name can't contain spaces`;
      if (this.containsAnySpecialCharacters(lastName)) return `Last name can't have special characters`;
    }

    // Username validation (required)
    if (!this.inputWithinRange(username, 6, 14)) return 'Username must be 6–14 characters';
    if (this.containsWhiteSpace(username)) return `Username cannot contain spaces`;
    if (!this.isUsernameValid(username)) return 'Username can only use letters and numbers';

    // Bio validation (optional)
    if (this.bio.length > 150) return 'Bio must be 150 characters or less';

    return null;
  }

  private validateEmail(): string | null {
    const email = this.email.trim();

    if (!this.inputWithinRange(email, 6, 60)) return 'Email must be 6–60 characters';
    if (this.containsWhiteSpace(email)) return `Email cannot contain spaces`;
    if (!this.isEmailValid(email)) return `Email must look like "name@host.tld"`;

    return null;
  }

  private validatePassword(): string | null {
    const password = this.newPassword;
    const confirm = this.confirmPassword;

    if (!this.inputWithinRange(password, 8, 24)) return 'Password must be 8–24 characters';
    if (this.containsWhiteSpace(password)) return `Password cannot contain spaces`;
    if (!this.containsCapitalLetter(password)) return 'Password must contain a capital letter';
    if (!this.containsNumber(password)) return 'Password must contain a number';
    if (!this.containsAllowedSpecialCharacters(password))
      return 'Password must contain one of ! @ # $ % ^ & *';

    if (password !== confirm) return 'Passwords do not match';

    return null;
  }



  
  // ========== Helpers ==========

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
  
  clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
    
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }
  }
}