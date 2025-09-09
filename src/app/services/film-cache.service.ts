import { Injectable, Optional } from '@angular/core';
import { CombinedFilmApiResponseModel } from '../models/api-models/combined-film-api-response';
import { LocalStorageService } from './local-storage.service';
import { RatedMovieModel } from '../models/database-models/rated-movie-model';
import { RatedSeriesModel } from '../models/database-models/rated-series-model';

type FilmLike = CombinedFilmApiResponseModel;
type RatedItem = (RatedMovieModel & { kind: 'movie' }) | (RatedSeriesModel & { kind: 'series' });

export interface ILocalStorageService {
  getInformation<T = any>(key: string): T | null;
  setInformation<T = any>(key: string, value: T): void;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  timeToLiveMs: number;
}

/** v2 store: separate namespaces for API films and edit drafts */
interface FilmCacheStoreV2 {
  v: 2;
  api: Record<string, CacheEntry<FilmLike>>;      // key: imdbId
  drafts: Record<string, CacheEntry<RatedItem>>;  // key: postId
}

// v1 legacy shape (what you have today): flat map of API films only
type FilmCacheStoreV1 = Record<string, CacheEntry<FilmLike>>;

@Injectable({ providedIn: 'root' })
export class FilmCacheService {
  private readonly STORAGE_KEY = 'film-cache';
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  // drafts should basically never expire while user is editing
  private readonly DEFAULT_DRAFT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

  constructor(@Optional() private localStorageService: LocalStorageService) {}

  private getRaw(): any {
    if (this.localStorageService) {
      return this.localStorageService.getInformation(this.STORAGE_KEY);
    }
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private putRaw(store: FilmCacheStoreV2) {
    if (this.localStorageService) {
      this.localStorageService.setInformation(this.STORAGE_KEY, store);
    } else {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(store));
    }
  }

  /** Read and migrate legacy v1 -> v2 if needed */
  private readStore(): FilmCacheStoreV2 {
    try {
      const raw = this.getRaw();

      // Already v2
      if (raw && typeof raw === 'object' && raw.v === 2 && raw.api && raw.drafts) {
        return raw as FilmCacheStoreV2;
      }

      // Legacy v1 flat map
      if (raw && typeof raw === 'object' && raw.v === undefined) {
        const v1 = raw as FilmCacheStoreV1;
        const migrated: FilmCacheStoreV2 = { v: 2, api: v1, drafts: {} };
        this.putRaw(migrated);
        return migrated;
      }

      // Nothing or invalid -> fresh v2
      const fresh: FilmCacheStoreV2 = { v: 2, api: {}, drafts: {} };
      this.putRaw(fresh);
      return fresh;
    } catch {
      const fresh: FilmCacheStoreV2 = { v: 2, api: {}, drafts: {} };
      this.putRaw(fresh);
      return fresh;
    }
  }

  private writeStore(store: FilmCacheStoreV2) {
    this.putRaw(store);
  }


  /// ---------------------------------------- Rate Unrated Film (by IMDB id) ----------------------------------------  \\\
  set(imdbId: string, film: FilmLike, timeToLiveMs = this.DEFAULT_TTL_MS): void {
    const store = this.readStore();
    store.api[imdbId] = { data: film, cachedAt: Date.now(), timeToLiveMs };
    this.writeStore(store);
  }

  get(imdbId: string): FilmLike | null {
    const store = this.readStore();
    const entry = store.api[imdbId];
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
    if (store.api[imdbId]) {
      delete store.api[imdbId];
      this.writeStore(store);
    }
  }

  clearAll() {
    const store = this.readStore();
    store.api = {};
    this.writeStore(store);
  }


  /// ---------------------------------------- Edit Rated Films (by postId) ----------------------------------------  \\\
  setDraft(postId: string, item: RatedItem, timeToLiveMs = this.DEFAULT_DRAFT_TTL_MS) {
    const store = this.readStore();
    store.drafts[postId] = { data: item, cachedAt: Date.now(), timeToLiveMs };
    this.writeStore(store);
  }

  getDraft(postId: string): RatedItem | null {
    const store = this.readStore();
    const entry = store.drafts[postId];
    if (!entry) return null;
    const expired = Date.now() - entry.cachedAt > entry.timeToLiveMs;
    return expired ? null : entry.data;
  }

  patchDraft(postId: string, partial: Partial<RatedItem>): RatedItem | null {
    const existing = this.getDraft(postId);
    if (!existing) return null;
    const merged = { ...existing, ...partial } as RatedItem;
    this.setDraft(postId, merged);
    return merged;
  }

  clearDraft(postId: string) {
    const store = this.readStore();
    if (store.drafts[postId]) {
      delete store.drafts[postId];
      this.writeStore(store);
    }
  }

  clearAllDrafts() {
    const store = this.readStore();
    store.drafts = {};
    this.writeStore(store);
  }
}