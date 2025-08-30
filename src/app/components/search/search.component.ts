import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing-service';
import { SearchService } from '../../services/search-service';

import { AccountInformationModel } from '../../models/database-models/account-information-model';

import { SearchType } from '../../models/search-models/search.types';  ///  'movies' | 'series' | 'users'  \\\

import { SearchedFilmComponent } from '../templates/searched-film/searched-film.component';
import { SearchedUserComponent } from '../templates/searched-user/searched-user.component';


@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    SearchedFilmComponent, 
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
  public localStorageService = inject(LocalStorageService);

  readonly sidebarActive = signal(true);
  public currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user');

  public type: SearchType = 'movies';
  public searchInput = '';
  public results: any[] = [];
  public showWarning = false;
  public inputFocused = false;


  ngOnInit() {
    ///  react to both :type and ?q= changes  \\\
    this.route.paramMap.subscribe(pm => {
      this.type = (pm.get('type') as SearchType) ?? 'movies';

      const q = (this.route.snapshot.queryParamMap.get('q') ?? '').trim();

      if (q) this.runSearch(q); else this.clearResults();
    });

    this.route.queryParamMap.subscribe(qm => {
      const q = (qm.get('q') ?? '').trim();

      if (q !== this.searchInput) this.searchInput = q;

      if (q && q.length >= 2) this.runSearch(q);

      if (!q) this.clearResults();
    });

    /// automatically closes side bar if screen width gets to low \\\
    this.applySidebarByWidth(window.innerWidth);

    this.localStorageService.cleanTemporaryLocalStorages();
  }

  onSearch() {
    const q = (this.searchInput || '').trim();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null },  ///  null removes param if empty  \\\
      queryParamsHandling: 'merge'
    });
  }

  private runSearch(q: string) {
    this.searchService.search(this.type, q).subscribe({
      next: items => {
        this.results = items ?? [];
        this.showWarning = this.results.length === 0;
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

  toggleMoviesActive() {
    this.router.navigate(['/search', 'movies'], { queryParams: { q: this.searchInput || null } });
  }
  toggleSeriesActive() {
    this.router.navigate(['/search', 'series'], { queryParams: { q: this.searchInput || null } });
  }
  toggleUsersActive() {
    this.router.navigate(['/search', 'users'], { queryParams: { q: this.searchInput || null } });
  }


  /// ---------------------------------------- Responsive Sidebar ---------------------------------------- \\\
  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.applySidebarByWidth(width);
  }

  private applySidebarByWidth(width: number) {
    if (width <= 1275 && this.sidebarActive()) this.sidebarActive.set(false);
    if (width >= 1275 && !this.sidebarActive()) this.sidebarActive.set(true);
  }
  
  toggleSidebar() {
    this.sidebarActive.update(v => !v);
  }
}