// src/app/components/logout-modal/logout-modal.component.ts

import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-logout-modal',
    imports: [CommonModule],
    templateUrl: './logout-modal.component.html',
    styleUrl: './logout-modal.component.css'
})
export class LogoutModalComponent {
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}