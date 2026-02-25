import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing.service';
import { SearchService } from '../../services/search.service';

import { SearchType } from '../../models/search-models/search.types';

import { SearchedUserComponent } from '../templates/searched-user/searched-user.component';
import { SidebarService } from '../../services/sidebar.service';
import { UsersService } from '../../services/users.service';
import { UserModel } from '../../models/database-models/user.model';
import { ApiService } from '../../services/api.service';
import { SearchedFilmComponent } from '../templates/searched-film/searched-film.component';
import { SearchedPersonComponent } from '../templates/searched-person/searched-person.component';


@Component({
    selector: 'app-search',
    imports: [
        CommonModule,
        FormsModule,
        SearchedFilmComponent,
        SearchedPersonComponent,
        SearchedUserComponent,
        RouterModule
    ],
    templateUrl: './search.component.html',
    styleUrl: './search.component.css'
})

export class SearchComponent implements OnInit {
  public routingService = inject(RoutingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchService = inject(SearchService);
  readonly usersService = inject(UsersService);
  public localStorageService = inject(LocalStorageService);
  readonly sidebarService = inject(SidebarService);
  public apiService = inject(ApiService);

  public currentUser = signal<UserModel | null>(null);

  public type: SearchType = 'all';
  public searchInput = '';
  public results: any[] = [];
  public showWarning = false;
  public inputFocused = false;


  ngOnInit() {    
    // ✅ Clear results immediately when type changes
    this.route.paramMap.subscribe(pm => {
      const newType = (pm.get('type') as SearchType) ?? 'all';
      
      // If type changed, clear results immediately
      if (newType !== this.type) {
        this.clearResults();
      }
      
      this.type = newType;

      const q = (this.route.snapshot.queryParamMap.get('q') ?? '').trim();
      if (q) this.runSearch(q); else this.clearResults();
    });

    this.route.queryParamMap.subscribe(qm => {
      const q = (qm.get('q') ?? '').trim();
      if (q !== this.searchInput) this.searchInput = q;
      if (q && q.length >= 2) this.runSearch(q);
      if (!q) this.clearResults();
    });

    this.usersService.getCurrentUserProfile()
      .then(u => this.currentUser.set(u))
      .catch(err => {
        console.error('Failed to load current user', err);
        this.currentUser.set(null);
      });

    this.localStorageService.cleanTemporaryLocalStorages();
  }


  /// -======================================-  Search Functionality  -======================================- \\\
  onSearch() {
    const query = (this.searchInput || '').trim();
    if (!query) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null },
      queryParamsHandling: 'merge'
    });
  }

  private runSearch(query: string) {
    this.searchService.search(this.type, query).subscribe({
      next: items => {
        this.results = items ?? [];
        this.showWarning = this.results.length === 0;
        console.log(`[Search] ${this.type} results:`, this.results);
      },
      error: err => {
        console.error(err);
        this.results = [];
        this.showWarning = true;
      }
    });
  }

  private clearResults() {
    this.results = [];
    this.showWarning = false;
  }


  /// -======================================-  Tab Navigation  -======================================- \\\
  navigateToTab(type: SearchType) {
    this.router.navigate(['/search', type], { 
      queryParams: { q: this.searchInput || null } 
    });
  }


  /// -======================================-  Helper Methods  -======================================- \\\


  /// -======================================-  Responsive Sidebar  -======================================- \\\
  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }
}