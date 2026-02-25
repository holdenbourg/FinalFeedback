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
    imports: [CommonModule, MobileLayoutComponent, DesktopLayoutComponent],
    templateUrl: './app.component.html'
})

export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  public deviceService = inject(DeviceService);

  async ngOnInit() {
    localStorage.removeItem('ff-remember-me');
    await this.checkSessionValidity();
  }

  private async checkSessionValidity() {
    const wasSessionOnly = localStorage.getItem('ff-session-only');
    const sessionActive = sessionStorage.getItem('ff-session-active');

    if (wasSessionOnly === 'true' && !sessionActive) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await this.authService.signOut();
      }
    }
  }
}