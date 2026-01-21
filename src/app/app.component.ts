import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { supabase } from './core/supabase.client';
import { MobileLayoutComponent } from './layouts/mobile-layout/mobile-layout.component';
import { DesktopLayoutComponent } from './layouts/desktop-layout/desktop-layout.component';
import { DeviceService } from './services/device.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MobileLayoutComponent, DesktopLayoutComponent],
  templateUrl: './app.component.html'
})

export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  public deviceService = inject(DeviceService); // ✅ ADD THIS LINE

  async ngOnInit() {
    // Clean up old flag
    localStorage.removeItem('w2w-remember-me');
    
    console.log('[App] Checking session validity...');
    console.log('[App] Device info:', this.deviceService.getDeviceInfo()); // ✅ Debug log
    await this.checkSessionValidity();
  }

  private async checkSessionValidity() {
    const wasSessionOnly = localStorage.getItem('w2w-session-only');
    const sessionActive = sessionStorage.getItem('w2w-session-active');
    
    console.log('[App] wasSessionOnly:', wasSessionOnly);
    console.log('[App] sessionActive:', sessionActive);

    // Browser was closed if: localStorage flag exists BUT sessionStorage is empty
    if (wasSessionOnly === 'true' && !sessionActive) {
      console.log('[App] Browser was closed with session-only login. Checking for session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[App] Session found:', session ? 'YES' : 'NO');
      
      if (session) {
        console.log('[App] Signing out session-only login');
        await this.authService.signOut();
      }
    } else {
      console.log('[App] Session check passed - no action needed');
      
      // ✅ Verify user is actually logged in
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[App] Current session:', session ? 'ACTIVE' : 'NONE');
    }
  }
}