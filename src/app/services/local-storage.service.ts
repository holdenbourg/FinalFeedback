import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  setInformation(storageName: string, data: any): void {
    try {
      if (data === undefined || data === null) {
        localStorage.removeItem(storageName);
        return;
      }

      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(storageName, serialized);

    } catch (err) {
      console.error(`[LocalStorageService] Failed to save "${storageName}":`, err);
    }
  }

  getInformation<T = any>(storageName: string): T | null {
    const raw = localStorage.getItem(storageName);
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  clearInformation(storageName: string): void {
    localStorage.removeItem(storageName);
  }

  cleanAll(): void {
    localStorage.clear()
  }

  cleanTemporaryLocalStorages(): void {
    const keys = [
      'currentPostNumber',
      'currentArchivedPostNumber',
      'currentTaggedPostNumber',
      'currentEditSeries',
      'currentEditMovie',
      'currentPostSeries',
      'currentPostMovie',
      'currentRateSeries',
      'currentRateMovie',
      'current-rating-model'
    ];

    for (const key of keys) localStorage.removeItem(key);
  }
}
