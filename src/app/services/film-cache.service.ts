import { Injectable, Optional } from '@angular/core';
import { CombinedFilmApiResponseModel } from '../models/api-models/combined-film-api-response';
import { LocalStorageService } from './local-storage.service';

type FilmLike = CombinedFilmApiResponseModel;

export interface ILocalStorageService {
  getInformation<T = any>(key: string): T | null;
  setInformation<T = any>(key: string, value: T): void;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  timeToLiveMs: number;
}

@Injectable({ providedIn: 'root' })
export class FilmCacheService {
  private readonly STORAGE_KEY = 'film-cache';
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;  ///  24 hours  \\\

  constructor(@Optional() private localStorageService: LocalStorageService) {}

  private readStore(): Record<string, CacheEntry<FilmLike>> {
    try {
      if (this.localStorageService) {
        return this.localStorageService.getInformation(this.STORAGE_KEY) ?? {};
      }

      const raw = localStorage.getItem(this.STORAGE_KEY);
      
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private writeStore(store: Record<string, CacheEntry<FilmLike>>) {
    if (this.localStorageService) {
      this.localStorageService.setInformation(this.STORAGE_KEY, store);
    } else {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(store));
    }
  }

  set(imdbId: string, film: FilmLike, timeToLiveMs = this.DEFAULT_TTL_MS): void {
    const store = this.readStore();

    store[imdbId] = { data: film, cachedAt: Date.now(), timeToLiveMs };

    this.writeStore(store);
  }

  get(imdbId: string): FilmLike | null {
    const store = this.readStore();
    const entry = store[imdbId];

    if (!entry) return null;

    const expired = Date.now() - entry.cachedAt > entry.timeToLiveMs;

    return expired ? null : entry.data;
  }

  getOrFetch = async (imdbId: string, fetcher: () => Promise<FilmLike>, timeToLiveMs = this.DEFAULT_TTL_MS): Promise<FilmLike> => {
    const cached = this.get(imdbId);

    if (cached) return cached;

    const fresh = await fetcher();

    this.set(imdbId, fresh, timeToLiveMs);

    return fresh;
  };

  clearOne(imdbId: string) {
    const store = this.readStore();

    if (store[imdbId]) {
      delete store[imdbId];
      this.writeStore(store);
    }
  }

  clearAll() {
    this.writeStore({});
  }
}