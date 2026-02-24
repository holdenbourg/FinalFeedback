import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MessageModel } from "../../../models/database-models/message.model";
import { SharedRatingComponent } from "../shared-rating/shared-rating.component";

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule, RouterLink, SharedRatingComponent],
  templateUrl: `./message.component.html`,
  styleUrl: `./message.component.css`
})
export class MessageComponent {
  @Input() message!: MessageModel;
  @Input() isOwnMessage = false;
  @Input() showAvatar = false;  // ✅ NEW: Show profile picture for last message in chain
  
  @Output() reply = new EventEmitter<MessageModel>();
  @Output() edit = new EventEmitter<MessageModel>();
  @Output() delete = new EventEmitter<MessageModel>();
  @Output() viewRating = new EventEmitter<string>();
  
  // ✅ Computed properties
  get hasReply(): boolean {
    return !!this.message.replied_message;
  }
  
  get hasSharedRating(): boolean {
    return !!this.message.shared_rating;
  }
  
  get hasTextContent(): boolean {
    return !!this.message.content?.trim();
  }
  
  get isEdited(): boolean {
    if (!this.message.updated_at || !this.message.created_at) return false;
    return new Date(this.message.updated_at).getTime() !== new Date(this.message.created_at).getTime();
  }
  
  // ✅ Get profile picture URL
  get avatarUrl(): string {
    return this.message.sender?.profile_picture_url || '/assets/images/default-avatar.png';
  }
}