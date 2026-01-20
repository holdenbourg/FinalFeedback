import { Component, OnInit, inject, signal } from '@angular/core';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-desktop-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './desktop-layout.component.html',
  styleUrl: './desktop-layout.component.css'
})
export class DesktopLayoutComponent implements OnInit {
  public sidebarService = inject(SidebarService);
  public routingService = inject(RoutingService);
  public usersService = inject(UsersService);
  
  currentUser = signal<UserModel | null>(null);

  async ngOnInit() {
    // Load current user
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
  }
}
