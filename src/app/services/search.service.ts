import { Injectable, inject } from '@angular/core';
import { catchError, from, map, Observable, of } from 'rxjs';
import { ApiService } from './api.service';
import { SearchType } from '../models/search-models/search.types';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);

  ///  Search movies or shows using there respective API calls  \\\
  search(type: SearchType, search: string): Observable<any[]> {
    const query = (search || '').trim();
    if (!query) return of([]);

    switch (type) {
      case 'movies':
        return this.api.search10Films(query, 'movie');
      case 'series':
        return this.api.search10Films(query, 'series');
      case 'users':
        return this.searchUsers(query);
    }
  }

  ///  Search users using a Supabase RPC function with ILIKE fallback  \\\
  private searchUsers(search: string): Observable<any[]> {
    const q = (search || '').trim();
    if (!q) return of([]);

    const limit = 20;
    const offset = 0;

    ///  Call the SQL function: public.search_users(q, lim, off)  \\\
    return from(
      supabase.rpc('search_users', { q, lim: limit, off: offset })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        return (data ?? []) as any[];
      }),

      ///  Fallback to ILIKE-based search if RPC unavailable  \\\
      catchError(() => from(this.searchUsersFallback(q, limit, offset)))
    );
  }

  ///  ILIKE fallback  \\\
  private async searchUsersFallback(q: string, limit = 20, offset = 0): Promise<any[]> {
    const results: any[] = [];
    const seen = new Set<string>();

    ///  If user typed @username, try exact hit first  \\\
    const at = q.startsWith('@') ? q.slice(1).toLowerCase() : null;
    const term = (at ?? q).toLowerCase();

    ///  Columns we actually return (whitelist avoids leaking email, etc.)  \\\
    const cols = `
      id, username, first_name, last_name, bio,
      profile_picture_url, private, post_count, follower_count, following_count
    `;

    if (at && at.length > 0) {
      const { data: exact, error } = await supabase
        .from('users')
        .select(cols)
        .eq('username', at)
        .single();

      if (!error && exact) {
        results.push(exact);
        seen.add(exact.id);
      }
    }

    ///  Prefix pass: username / first_name / last_name  \\\
    const { data: prefixData } = await supabase
      .from('users')
      .select(cols)
      .or(`username.ilike.${term}%,first_name.ilike.${term}%,last_name.ilike.${term}%`)
      .order('username', { ascending: true })
      .range(offset, offset + limit - 1);

    for (const u of prefixData ?? []) {
      if (!seen.has(u.id)) {
        results.push(u);
        seen.add(u.id);
      }
    }

    ///  Broad contains on username, first_name, last_name, bio  \\\
    const ilikeQ = `%${term}%`;
    const { data: broadData } = await supabase
      .from('users')
      .select(cols)
      .or([
        `username.ilike.${ilikeQ}`,
        `first_name.ilike.${ilikeQ}`,
        `last_name.ilike.${ilikeQ}`,
        `bio.ilike.${ilikeQ}`,
      ].join(','))
      .range(0, 199);

    for (const u of broadData ?? []) {
      if (!seen.has(u.id)) {
        results.push(u);
        seen.add(u.id);
      }
    }

    return results.slice(0, limit);
  }
}