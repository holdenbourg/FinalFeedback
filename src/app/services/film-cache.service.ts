import { Injectable, inject, signal, effect } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { RatingModel } from '../models/database-models/rating-model';

/** Basic cache entry structure */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  timeToLiveMs: number;
}

/** Unified cache structure */
interface FilmCacheStore {
  v: number;
  api: Record<string, CacheEntry<any>>;            // used for search/API caching
  drafts: Record<string, CacheEntry<RatingModel>>; // used for both new + edit drafts
}

@Injectable({ providedIn: 'root' })
export class FilmCacheService {
  private localStorageService = inject(LocalStorageService);

  private readonly STORAGE_KEY = 'film-cache';
  readonly DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;  // 2 days
  readonly DEFAULT_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days


  /// -======================================-  Read/Write from Cache  -======================================- \\\
  private readStore(): FilmCacheStore {
    const store = this.localStorageService.getInformation(this.STORAGE_KEY);
    if (store?.v === 2) return store;
    return { v: 2, api: {}, drafts: {} };
  }

  private writeStore(store: FilmCacheStore) {
    this.localStorageService.setInformation(this.STORAGE_KEY, store);
  }


  /// -======================================-  API Response Caching  -======================================- \\\
  setApiCache(key: string, data: any, timeToLiveMs = this.DEFAULT_TTL_MS) {
    const store = this.readStore();
    store.api[key] = { data, cachedAt: Date.now(), timeToLiveMs };

    this.writeStore(store);
  }

  getApiCache<T = any>(key: string): T | null {
    const store = this.readStore();

    const entry = store.api[key];
    if (!entry) return null;

    const expired = Date.now() - entry.cachedAt > entry.timeToLiveMs;
    return expired ? null : entry.data;
  }


  /// -======================================-  Cache for Rating/Editing  -======================================- \\\
  setDraft(postId: string, model: RatingModel, timeToLiveMs = this.DEFAULT_DRAFT_TTL_MS) {
    const store = this.readStore();
    store.drafts[postId] = { data: model, cachedAt: Date.now(), timeToLiveMs };

    this.writeStore(store);
  }

  getDraft(postId: string): RatingModel | null {
    const store = this.readStore();

    const entry = store.drafts[postId];
    if (!entry) return null;

    const expired = Date.now() - entry.cachedAt > entry.timeToLiveMs;
    if (expired) {
      delete store.drafts[postId];
      this.writeStore(store);
      return null;
    }

    return entry.data;
  }

  patchDraft(postId: string, partial: Partial<RatingModel>): RatingModel | null {
    const existing = this.getDraft(postId);
    if (!existing) return null;

    const merged = { ...existing, ...partial } as RatingModel;
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


  /// -======================================-  Clear the Cache  -======================================- \\\
  clearAll() {
    this.localStorageService.clearInformation(this.STORAGE_KEY);
  }
}