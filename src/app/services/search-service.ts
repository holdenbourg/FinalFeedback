import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiService } from '../services/api-service';
import { SearchType } from '../models/search-models/search.types';
import { UsersDatabase } from '../databases/users-database';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);
  private usersDatabase = inject(UsersDatabase);

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

  private searchUsers(search: string): Observable<any[]> {
    const rawUsers = this.usersDatabase.getAllUsersFromDatabase();
    const query = search.toLowerCase();

    const match = (s: string) => s?.toLowerCase().includes(query);
    const starts = (s: string) => s?.toLowerCase().startsWith(query);

    const users = rawUsers
      .filter(u => match(u.username))
      .sort((a, b) => Number(starts(b.username)) - Number(starts(a.username)))
      .slice(0, 20);

    return of(users);
  }
}