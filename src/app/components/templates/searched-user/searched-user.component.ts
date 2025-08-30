import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoutingService } from '../../../services/routing-service';

export interface SearchedUser {
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
}

@Component({
  selector: 'app-searched-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './searched-user.component.html',
  styleUrls: ['./searched-user.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SearchedUserComponent {
  public routingService = inject(RoutingService);

  @Input({ required: true })
  userDetails!: SearchedUser;

  noAvatar = false;


  get avatar(): string | null {
    const profilePic = this.userDetails?.profilePicture;

    if (!profilePic || this.noAvatar) return null;

    return profilePic;
  }

  get fullName(): string {
    const first = this.userDetails?.firstName || '';
    const last = this.userDetails?.lastName || '';

    return (first + ' ' + last).trim();
  }

  onAvatarError() {
    this.noAvatar = true;
  }

  goToProfile() {
    this.routingService.navigateToAccountsPosts(this.userDetails.username);
  }
}