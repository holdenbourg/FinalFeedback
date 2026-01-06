import { Injectable, inject } from '@angular/core';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import { SearchType } from '../models/search-models/search.types';
import { UsersService } from './users.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);
  private usersService = inject(UsersService);

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

  ///  Search users excluding blocked relationships and self  \\\
  private searchUsers(search: string): Observable<any[]> {
    const q = (search || '').trim();
    if (!q) return of([]);

    // Get current user ID first
    return from(this.usersService.getCurrentUserId()).pipe(
      switchMap(currentUserId => {
        if (!currentUserId) {
          // Not logged in - use RPC without filtering
          return from(this.usersService.searchUsersRpc(q, 20, 0));
        }

        // Logged in - filter out blocked users and self
        return from(
          this.usersService.searchUsersExcludingBlockedAndSelf(q, currentUserId, 20, 0)
        );
      }),
      catchError(err => {
        console.error('User search error:', err);
        return of([]);
      })
    );
  }
}