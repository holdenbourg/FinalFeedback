import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { supabase } from '../../core/supabase.client';

@Component({
    selector: 'app-reset-password',
    imports: [CommonModule, FormsModule],
    templateUrl: './reset-password.component.html',
    styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;

  isSubmitting = false;
  isRecoverySession = false;

  message = '';
  messageType: 'success' | 'error' | '' = '';

  private authSubscription?: { unsubscribe: () => void };

  ngOnInit() {
    this.addRandomStartPointForRows();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.isRecoverySession = true;
      }
    });
    this.authSubscription = data.subscription;
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }

  async onSubmit() {
    const validationError = this.validate();
    if (validationError) {
      this.showMessage('error', validationError);
      return;
    }

    this.isSubmitting = true;

    try {
      await this.authService.updatePassword(this.newPassword);
      this.showMessage('success', 'Password updated!');

      setTimeout(() => {
        this.router.navigateByUrl('/login');
      }, 2000);
    } catch (e: any) {
      this.showMessage('error', e?.message ?? 'Failed to update password');
    } finally {
      this.isSubmitting = false;
    }
  }

  private validate(): string | null {
    const pw = this.newPassword;
    const confirm = this.confirmPassword;

    if (pw.length < 8 || pw.length > 24) return 'Password must be 8–24 characters';
    if (/\s/.test(pw)) return 'Password cannot contain spaces';
    if (!/[A-Z]/.test(pw)) return 'Password must contain a capital letter';
    if (!/\d/.test(pw)) return 'Password must contain a number';
    if (!/[!@#$%^&*]/.test(pw)) return 'Password must contain one of ! @ # $ % ^ & *';
    if (pw !== confirm) return 'Passwords do not match';

    return null;
  }

  private showMessage(type: 'success' | 'error', text: string) {
    this.message = text;
    this.messageType = type;
  }

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}
