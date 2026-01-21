import { Injectable } from '@angular/core';
import { RatingModel } from '../models/database-models/rating.model';

type CacheEntry<T> = { data: T; cachedAt: number; timeToLiveMs: number };

@Injectable({ providedIn: 'root' })
export class FilmCacheService {
  readonly DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;        ///  2 days
  readonly DEFAULT_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7;  ///  7 days

  private readonly API_PREFIX = 'ff:api_cache:';
  private readonly DRAFT_PREFIX = 'ff:rating_draft:';
  private readonly ORIGINAL_PREFIX = 'ff:rating_original:';

  ///  in-memory only (per app session)  \\
  private api = new Map<string, CacheEntry<any>>();
  private drafts = new Map<string, CacheEntry<RatingModel>>();
  private originals = new Map<string, CacheEntry<RatingModel>>();

  ///  ---------- API response cache ----------
  /// Persists to sessionStorage for IMDb-like keys (e.g., tt1234567) so Rate Film survives refresh.
  setApiCache<T = any>(key: string, data: T, timeToLiveMs = this.DEFAULT_TTL_MS): void {
    const entry: CacheEntry<T> = { data: this.clone(data), cachedAt: Date.now(), timeToLiveMs };
    this.api.set(key, entry);

    if (this.shouldPersistApiKey(key)) {
      sessionStorage.setItem(this.apiKey(key), JSON.stringify(entry));
    }
  }

  getApiCache<T = any>(key: string): T | null {
    // 1) memory
    const entry = this.api.get(key);
    if (entry) {
      if (this.isExpired(entry)) {
        this.api.delete(key);
      } else {
        return this.clone(entry.data) as T;
      }
    }

    // 2) sessionStorage (only for persisted keys)
    if (!this.shouldPersistApiKey(key)) return null;

    const raw = sessionStorage.getItem(this.apiKey(key));
    if (!raw) return null;

    try {
      const stored = JSON.parse(raw) as CacheEntry<T>;
      if (this.isExpired(stored)) {
        sessionStorage.removeItem(this.apiKey(key));
        return null;
      }

      // rehydrate memory
      this.api.set(key, stored as any);
      return this.clone(stored.data) as T;
    } catch {
      sessionStorage.removeItem(this.apiKey(key));
      return null;
    }
  }

  // Convenience aliases so existing code like set(imdbId, film) works:
  set<T = any>(key: string, data: T, ttl = this.DEFAULT_TTL_MS) { this.setApiCache(key, data, ttl); }
  get<T = any>(key: string) { return this.getApiCache<T>(key); }

  // ---------- Drafts (persisted in sessionStorage) ----------
  async setDraft(postId: string, model: RatingModel, timeToLiveMs = this.DEFAULT_DRAFT_TTL_MS): Promise<void> {
    const entry: CacheEntry<RatingModel> = { data: this.clone(model), cachedAt: Date.now(), timeToLiveMs };
    this.drafts.set(postId, entry);
    sessionStorage.setItem(this.draftKey(postId), JSON.stringify(entry));
  }

  async getDraft(postId: string): Promise<RatingModel | null> {
    // 1) memory
    const mem = this.drafts.get(postId);
    if (mem) {
      if (this.isExpired(mem)) { await this.clearDraft(postId); return null; }
      return this.clone(mem.data);
    }

    // 2) sessionStorage
    const raw = sessionStorage.getItem(this.draftKey(postId));
    if (!raw) return null;

    try {
      const stored = JSON.parse(raw) as CacheEntry<RatingModel>;
      if (this.isExpired(stored)) { await this.clearDraft(postId); return null; }
      this.drafts.set(postId, stored);
      return this.clone(stored.data);
    } catch {
      await this.clearDraft(postId);
      return null;
    }
  }

  async patchDraft(postId: string, partial: Partial<RatingModel>): Promise<RatingModel | null> {
    const existing = await this.getDraft(postId);
    if (!existing) return null;
    const merged = { ...existing, ...partial } as RatingModel;
    await this.setDraft(postId, merged); // refresh cache + TTL
    return merged;
  }

  async clearDraft(postId: string): Promise<void> {
    this.drafts.delete(postId);
    sessionStorage.removeItem(this.draftKey(postId));
  }

  
  // ---------- Original rating snapshot (persisted in sessionStorage) ----------
  async setOriginal(postId: string, model: RatingModel, timeToLiveMs = this.DEFAULT_DRAFT_TTL_MS): Promise<void> {
    const entry: CacheEntry<RatingModel> = { data: this.clone(model), cachedAt: Date.now(), timeToLiveMs };
    this.originals.set(postId, entry);
    sessionStorage.setItem(this.originalKey(postId), JSON.stringify(entry));
  }

  async getOriginal(postId: string): Promise<RatingModel | null> {
    // 1) memory
    const mem = this.originals.get(postId);
    if (mem) {
      if (this.isExpired(mem)) { await this.clearOriginal(postId); return null; }
      return this.clone(mem.data);
    }

    // 2) sessionStorage
    const raw = sessionStorage.getItem(this.originalKey(postId));
    if (!raw) return null;

    try {
      const stored = JSON.parse(raw) as CacheEntry<RatingModel>;
      if (this.isExpired(stored)) { await this.clearOriginal(postId); return null; }
      this.originals.set(postId, stored);
      return this.clone(stored.data);
    } catch {
      await this.clearOriginal(postId);
      return null;
    }
  }

  async clearOriginal(postId: string): Promise<void> {
    this.originals.delete(postId);
    sessionStorage.removeItem(this.originalKey(postId));
  }

// ---------- Helpers ----------
  clearAllSession() {
    this.api.clear();
    this.drafts.clear();
    this.originals.clear();

    // Remove our persisted keys from sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith(this.API_PREFIX) || k.startsWith(this.DRAFT_PREFIX) || k.startsWith(this.ORIGINAL_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  }

  private apiKey(key: string): string {
    return `${this.API_PREFIX}${key}`;
  }
  private draftKey(postId: string): string {
    return `${this.DRAFT_PREFIX}${postId}`;
  }
  private originalKey(postId: string): string {
    return `${this.ORIGINAL_PREFIX}${postId}`;
  }

  private shouldPersistApiKey(key: string): boolean {
    // Persist IMDb ids (Rate Film flow) and anything explicitly namespaced as persistable.
    return /^tt\d+$/.test(key) || key.startsWith('persist:');
  }

  private clone<T>(obj: T): T {
    return ('structuredClone' in globalThis) ? (structuredClone as any)(obj) : JSON.parse(JSON.stringify(obj));
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.cachedAt > entry.timeToLiveMs;
  }
}