import { Injectable, inject, signal, effect } from "@angular/core";
import { LocalStorageService } from "./local-storage.service";

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private localStorageService = inject(LocalStorageService);

  private initialSidebar =
    (this.localStorageService.getInformation('sidebar-open') as boolean | null | undefined);

  readonly sidebarActive = signal<boolean>(
    typeof this.initialSidebar === 'boolean' ? this.initialSidebar : (window.innerWidth >= 1275)
  );

  private persistSidebar = effect(() => {
    this.localStorageService.setInformation('sidebar-open', this.sidebarActive());
  });

  toggle() {
    this.sidebarActive.update(v => !v);
  }

  set(open: boolean) {
    this.sidebarActive.set(open);
  }

  applySidebarByWidth(width: number) {
    if (width <= 1275 && this.sidebarActive()) this.set(false);
    if (width >= 1275 && !this.sidebarActive()) this.set(true);
  }

  navDelay(i: number, filmKind: 'movie' | 'series'): number {
    const active = filmKind === 'series' ? 3 : 2;
    return 1 + Math.abs(i - active);
  }
}