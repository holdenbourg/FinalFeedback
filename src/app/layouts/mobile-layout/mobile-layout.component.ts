import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mobile-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.css'
})
export class MobileLayoutComponent implements OnInit {
  private router = inject(Router);
  private usersService = inject(UsersService);

  // TODO: Get unread message count from messaging service
  unreadCount = 0;

  ngOnInit() {
    // ✅ Initialize background rows with random start points
    this.addRandomStartPointForRows();
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  // ✅ Background animation: Give each row a random starting position
  private addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}