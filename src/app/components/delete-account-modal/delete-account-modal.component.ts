import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delete-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delete-account-modal.component.html',
  styleUrl: './delete-account-modal.component.css'
})
export class DeleteAccountModalComponent {
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  confirmationText = signal('');
  isValid = signal(false);

  onTextChange(value: string) {
    this.confirmationText.set(value);
    this.isValid.set(value === 'DELETE MY ACCOUNT');
  }

  onConfirm() {
    if (this.isValid()) {
      this.confirm.emit();
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}