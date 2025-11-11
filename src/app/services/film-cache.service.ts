import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { RatingModel } from '../models/database-models/rating-model';

type CacheEntry<T> = { data: T; cachedAt: number; timeToLiveMs: number };

@Injectable({ providedIn: 'root' })
export class FilmCacheService {
  readonly DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;        ///  2 days
  readonly DEFAULT_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7;  ///  7 days

  ///  in-memory only (per app session)  \\\
  private api = new Map<string, CacheEntry<any>>();
  private drafts = new Map<string, CacheEntry<RatingModel>>();

  ///  ---------- API response cache ----------
  setApiCache<T = any>(key: string, data: T, timeToLiveMs = this.DEFAULT_TTL_MS): void {
    this.api.set(key, { data: this.clone(data), cachedAt: Date.now(), timeToLiveMs });
  }
  getApiCache<T = any>(key: string): T | null {
    const entry = this.api.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) { this.api.delete(key); return null; }
    return this.clone(entry.data) as T;
  }

  // Convenience aliases so existing code like set(imdbId, film) works:
  set<T = any>(key: string, data: T, ttl = this.DEFAULT_TTL_MS) { this.setApiCache(key, data, ttl); }
  get<T = any>(key: string) { return this.getApiCache<T>(key); }

  // ---------- Drafts (persisted in Supabase) ----------
  async setDraft(postId: string, model: RatingModel, timeToLiveMs = this.DEFAULT_DRAFT_TTL_MS): Promise<void> {
    const entry: CacheEntry<RatingModel> = { data: this.clone(model), cachedAt: Date.now(), timeToLiveMs };
    this.drafts.set(postId, entry);

    const expiresAt = new Date(entry.cachedAt + timeToLiveMs).toISOString();
    const { error } = await supabase
      .from('rating_drafts')
      .upsert({
        id: postId,
        user_id: model.user_id,
        payload: entry.data as any,
        expires_at: expiresAt
      }, { onConflict: 'id' });

    if (error) console.error('setDraft upsert error:', error.message);
  }

  async getDraft(postId: string): Promise<RatingModel | null> {
    const mem = this.drafts.get(postId);
    if (mem) {
      if (this.isExpired(mem)) { await this.clearDraft(postId); return null; }
      return this.clone(mem.data);
    }

    // Fallback to Supabase (after refresh)
    const { data, error } = await supabase
      .from('rating_drafts')
      .select('payload, expires_at')
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      console.error('getDraft select error:', error.message);
      return null;
    }
    if (!data) return null;

    // Respect TTL if set
    const expired = data.expires_at && Date.now() > Date.parse(data.expires_at);
    if (expired) { await this.clearDraft(postId); return null; }

    const payload = data.payload as RatingModel;
    // re-hydrate memory with a fresh TTL window (optional)
    this.drafts.set(postId, {
      data: this.clone(payload),
      cachedAt: Date.now(),
      timeToLiveMs: this.DEFAULT_DRAFT_TTL_MS
    });
    return this.clone(payload);
  }

  async patchDraft(postId: string, partial: Partial<RatingModel>): Promise<RatingModel | null> {
    const existing = await this.getDraft(postId);
    if (!existing) return null;

    const merged = { ...existing, ...partial } as RatingModel;
    await this.setDraft(postId, merged); // re-upsert + refresh mem
    return merged;
  }

  async clearDraft(postId: string): Promise<void> {
    this.drafts.delete(postId);
    const { error } = await supabase.from('rating_drafts').delete().eq('id', postId);
    if (error) console.error('clearDraft delete error:', error.message);
  }

  // ---------- Helpers ----------
  clearAllSession() {
    this.api.clear();
    this.drafts.clear();
  }

  private clone<T>(obj: T): T {
    return ('structuredClone' in globalThis) ? (structuredClone as any)(obj) : JSON.parse(JSON.stringify(obj));
  }
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.cachedAt > entry.timeToLiveMs;
  }
}