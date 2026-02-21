import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalOverlayService {
  readonly active = signal(false);

  show() { this.active.set(true); }
  hide() { this.active.set(false); }
}
