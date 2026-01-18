import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, from, map, Observable, of, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import { SearchType } from '../models/search-models/search.types';
import { UsersService } from './users.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private apiService = inject(ApiService);
  private usersService = inject(UsersService);

  ///  Search based on type  \\\
  search(type: SearchType, search: string): Observable<any[]> {
    const query = (search || '').trim();
    if (!query) return of([]);

    switch (type) {
      case 'all':
        return this.searchAll(query);
        
      case 'movies':
        return this.apiService.searchMoviesTmdb(query).pipe(map(movies => movies.map(m => ({ ...m, media_type: 'movie' }))));
        
      case 'shows':
        return this.apiService.searchTvTmdb(query).pipe(map(shows => shows.map(s => ({ ...s, media_type: 'tv' }))));
        
      case 'people':
        return this.apiService.searchPeopleTmdb(query);
        
      case 'users':
        return this.searchUsers(query);
    }
  }

  ///  Search both TMDb and database users for "All" tab  \\\
  private searchAll(query: string): Observable<any[]> {
    return forkJoin({
      tmdb: this.apiService.searchMultiTmdb(query),
      users: this.searchUsers(query)
    }).pipe(
      map(results => {
        return [...results.users, ...results.tmdb];
      }),
      catchError(err => {
        console.error('Combined search error:', err);
        return of([]);
      })
    );
  }

  ///  Search users excluding blocked relationships and self  \\\
  private searchUsers(search: string): Observable<any[]> {
    const q = (search || '').trim();
    if (!q) return of([]);

    return from(this.usersService.getCurrentUserId()).pipe(
      switchMap(currentUserId => {
        if (!currentUserId) {
          return from(this.usersService.searchUsersRpc(q, 20, 0));
        }

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