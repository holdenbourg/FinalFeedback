import { Component, inject } from '@angular/core';
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
export class MobileLayoutComponent {
  private router = inject(Router);
  private usersService = inject(UsersService);

  // TODO: Get unread message count from messaging service
  unreadCount = 0;

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }
}
