import { Injectable, inject, signal, effect, NgZone } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private localStorageService = inject(LocalStorageService);
  private zone   = inject(NgZone);
  private router = inject(Router);

  readonly breakpoint = 1275;

  private initialSidebar = this.localStorageService.getInformation('sidebar-open') as boolean | null | undefined;

  readonly sidebarActive = signal<boolean>(
    typeof this.initialSidebar === 'boolean' ? this.initialSidebar : (window.innerWidth >= this.breakpoint)
  );

  private persistSidebar = effect(() => {
    this.localStorageService.setInformation('sidebar-open', this.sidebarActive());
  });

  // --- Transition suppression guard ---
  readonly suppressAnim = signal(true);

  constructor() {
    // Arm guard for the first app paint
    this.armGuard();

    // Re-arm the guard for EACH navigation, so new pages don't animate from closed->open (or vice versa)
    this.router.events.subscribe(evt => {
      if (evt instanceof NavigationStart) {
        // Before the next view renders, kill transitions
        this.suppressAnim.set(true);
      }
      if (evt instanceof NavigationEnd || evt instanceof NavigationCancel || evt instanceof NavigationError) {
        // After the view is in the DOM, drop the guard on the next two frames
        this.armGuard();
      }
    });
  }

  private armGuard() {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.zone.run(() => this.suppressAnim.set(false));
        });
      });
    });
  }

  toggle() { this.sidebarActive.update(v => !v); }

  // Keep if your components call it; harmless otherwise.
  applySidebarByWidth(width: number = window.innerWidth, opts: { force?: boolean } = {}) {
    const hasSaved = typeof this.localStorageService.getInformation('sidebar-open') === 'boolean';
    if (!opts.force && hasSaved) return;
    const shouldOpen = width >= this.breakpoint;
    if (this.sidebarActive() !== shouldOpen) this.sidebarActive.set(shouldOpen);
  }
}