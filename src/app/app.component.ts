import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { supabase } from './core/supabase.client';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})

export class AppComponent implements OnInit {
  private authService = inject(AuthService);

  async ngOnInit() {
    // ✅ Check if this was a session-only login
    const sessionOnly = sessionStorage.getItem('w2w-session-only');
    const rememberedLogin = localStorage.getItem('w2w-remember-me');
    
    // If they had a session-only login flag, but browser was closed and reopened
    // (sessionStorage is now empty but localStorage still has auth)
    if (!sessionOnly && !rememberedLogin) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // They have a session but no remember-me flag = sign them out
        await this.authService.signOut();
      }
    }
  }
}