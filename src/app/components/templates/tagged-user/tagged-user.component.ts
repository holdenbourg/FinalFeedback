import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RoutingService } from '../../../services/routing.service';
import { TaggedUser } from '../../../models/helper-models/film-data.model';

@Component({
  selector: 'app-tagged-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tagged-user.component.html',
  styleUrl: './tagged-user.component.css'
})
export class TaggedUserComponent {
  @Input() user!: TaggedUser;
  @Input() isTagged: boolean = false;
  
  @Output() tagToggle = new EventEmitter<void>();

  routingService = inject(RoutingService);

  get buttonText(): string {
    return this.isTagged ? 'Undo' : 'Tag';
  }

  onButtonClick() {
    this.tagToggle.emit();
  }

  onUsernameClick() {
    this.routingService.navigateToAccountsPosts(this.user.username);
  }
}