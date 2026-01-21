import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { RoutingService } from '../../services/routing.service';
import { SidebarService } from '../../services/sidebar.service';
import { UsersService } from '../../services/users.service';
import { UserModel } from '../../models/database-models/user.model';
import { MovieCriteria, RatingModel, SeriesCriteria } from '../../models/database-models/rating.model';
import { RatingsService } from '../../services/ratings.service';

type FilmKind = 'movie' | 'series';
type TabType = 'all' | 'movies' | 'series';

interface TabAvailability {
  all: boolean;
  movies: boolean;
  series: boolean;
}

type ChartDatum = { 
  label: string; 
  value: number 
};

type FavoriteEntry = { 
  label: string; 
  movieTitle: string; 
  rated?: string; 
  poster?: string; 
  rating?: number; 
  runtimeMin: number;
  episodes?: number;  // ✅ For series 
};

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})

export class SummaryComponent implements OnInit {
  readonly routingService = inject(RoutingService);
  readonly sidebarService = inject(SidebarService);
  readonly usersService = inject(UsersService);
  readonly ratingsService = inject(RatingsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly filmKind = signal<FilmKind>('movie');

  // ✅ NEW: Tab system
  readonly currentTab = signal<TabType>('movies');
  readonly tabAvailability = signal<TabAvailability>({
    all: false,
    movies: false,
    series: false
  });

  readonly favIndex      = signal(0);
  readonly countIndex    = signal(0);
  readonly genreBarIndex = signal(0);
  readonly ratedBarIndex = signal(0);
  readonly ratedPieIndex = signal(0);
  readonly genrePieIndex = signal(0);

  readonly fallbackPoster = 'assets/images/no-poster.png';

  public currentUser = signal<UserModel | null>(null);

  ///  User's rated movies  \\\
  private allRatedMovies = signal<RatingModel[]>([]);
  public usersRatedMovies = computed(() =>
    this.allRatedMovies()
  );

  ///  User's rated series/shows  \\\ 
  private allRatedSeries = signal<RatingModel[]>([]);
  public usersRatedSeries = computed(() =>
    this.allRatedSeries()
  );

  // ✅ Combined list for current tab
  public combinedRatedList = computed<RatingModel[]>(() => {
    const tab = this.currentTab();
    
    if (tab === 'all') {
      return [...this.allRatedMovies(), ...this.allRatedSeries()];
    } else if (tab === 'movies') {
      return this.allRatedMovies();
    } else {
      return this.allRatedSeries();
    }
  });

  // ✅ Use combinedRatedList for all data display
  public usersRatedList = computed<RatingModel[]>(() =>
    this.combinedRatedList()
  );

  // ✅ Computed: Which tabs are clickable
  readonly canViewAll = computed(() => this.tabAvailability().all);
  readonly canViewMovies = computed(() => this.tabAvailability().movies);
  readonly canViewSeries = computed(() => this.tabAvailability().series);

  // ✅ Computed: Threshold messages
  readonly moviesThresholdMessage = computed(() => {
    const count = this.allRatedMovies().length;
    if (count >= 10) return '';
    return `Rate ${10 - count} more movie${10 - count === 1 ? '' : 's'} to unlock`;
  });

  readonly seriesThresholdMessage = computed(() => {
    const count = this.allRatedSeries().length;
    if (count >= 10) return '';
    return `Rate ${10 - count} more series to unlock`;
  });

  readonly allThresholdMessage = computed(() => {
    const movieCount = this.allRatedMovies().length;
    const seriesCount = this.allRatedSeries().length;
    
    if (movieCount >= 10 && seriesCount >= 10) return '';
    
    const moviesNeeded = Math.max(0, 10 - movieCount);
    const seriesNeeded = Math.max(0, 10 - seriesCount);
    
    if (moviesNeeded > 0 && seriesNeeded > 0) {
      return `Rate ${moviesNeeded} more movie${moviesNeeded === 1 ? '' : 's'} and ${seriesNeeded} more series to unlock`;
    } else if (moviesNeeded > 0) {
      return `Rate ${moviesNeeded} more movie${moviesNeeded === 1 ? '' : 's'} to unlock`;
    } else {
      return `Rate ${seriesNeeded} more series to unlock`;
    }
  });

  async ngOnInit() {    
    try {
      // Load user and ratings
      const u = await this.usersService.getCurrentUserProfile();
      this.currentUser.set(u);

      if (u) {
        const [movies, series] = await Promise.all([
          this.ratingsService.getUserMovies(u.id),
          this.ratingsService.getUserSeries(u.id),
        ]);

        this.allRatedMovies.set(movies);
        this.allRatedSeries.set(series);
        
        // ✅ Calculate tab availability
        const movieCount = movies.length;
        const seriesCount = series.length;
        
        const availability: TabAvailability = {
          movies: movieCount >= 10,
          series: seriesCount >= 10,
          all: movieCount >= 10 && seriesCount >= 10
        };
        
        this.tabAvailability.set(availability);
        
        console.log('[Summary] Tab availability:', availability);
        console.log(`[Summary] Movies: ${movieCount}, Series: ${seriesCount}`);
        
        // ✅ Handle initial routing
        await this.handleInitialRouting(availability);
      } else {
        this.allRatedMovies.set([]);
        this.allRatedSeries.set([]);
        this.tabAvailability.set({ all: false, movies: false, series: false });
      }
    } catch (err) {
      console.error('Failed to load current user', err);
      this.currentUser.set(null);
      this.allRatedMovies.set([]);
      this.allRatedSeries.set([]);
      this.tabAvailability.set({ all: false, movies: false, series: false });
    }

    // ✅ Listen to URL changes
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.updateTabFromUrl());
  }

  /**
   * Determine which tab to show on initial load
   */
  private async handleInitialRouting(availability: TabAvailability) {
    const currentUrl = this.router.url.toLowerCase();
    
    // Extract tab from URL query params
    let requestedTab: TabType = 'all'; // default
    
    if (currentUrl.includes('tab=all')) {
      requestedTab = 'all';
    } else if (currentUrl.includes('tab=series') || currentUrl.includes('tab=shows')) {
      requestedTab = 'series';
    } else if (currentUrl.includes('tab=movies')) {
      requestedTab = 'movies';
    } else {
      // No tab specified - determine default
      requestedTab = this.determineDefaultTab(availability);
    }
    
    // Check if requested tab is available
    const canView = this.canViewTab(requestedTab, availability);
    
    if (canView) {
      // Requested tab is available - navigate to it
      console.log(`[Summary] Showing requested tab: ${requestedTab}`);
      await this.navigateToTab(requestedTab);
    } else {
      // Requested tab not available - find first available
      const fallbackTab = this.determineDefaultTab(availability);
      console.log(`[Summary] Tab '${requestedTab}' locked, redirecting to: ${fallbackTab}`);
      await this.navigateToTab(fallbackTab);
    }
  }

  /**
   * Determine which tab to show by default
   */
  private determineDefaultTab(availability: TabAvailability): TabType {
    // Priority: all > series > movies
    if (availability.all) return 'all';
    if (availability.series) return 'series';
    if (availability.movies) return 'movies';
    
    // Nothing unlocked - show movies (will display locked message)
    return 'all';
  }

  /**
   * Check if a tab can be viewed
   */
  private canViewTab(tab: TabType, availability: TabAvailability): boolean {
    return availability[tab];
  }

  /**
   * Navigate to a specific tab
   */
  private async navigateToTab(tab: TabType) {
    this.currentTab.set(tab);
    
    // Update filmKind for data display
    if (tab === 'movies') {
      this.filmKind.set('movie');
    } else if (tab === 'series') {
      this.filmKind.set('series');
    } else {
      // 'all' tab - use movie as default for display purposes
      this.filmKind.set('movie');
    }
    
    // Update URL
    await this.router.navigate(['/summary'], {
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Update current tab based on URL
   */
  private updateTabFromUrl() {
    const url = this.router.url.toLowerCase();
    
    let tab: TabType = 'movies';
    
    if (url.includes('tab=all')) {
      tab = 'all';
    } else if (url.includes('tab=series') || url.includes('tab=shows')) {
      tab = 'series';
    } else if (url.includes('tab=movies')) {
      tab = 'movies';
    }
    
    this.currentTab.set(tab);
    
    // Update filmKind
    if (tab === 'movies') {
      this.filmKind.set('movie');
    } else if (tab === 'series') {
      this.filmKind.set('series');
    }
    
    console.log(`[Summary] Tab changed to: ${tab}`);
  }

  /**
   * User clicks on a tab
   */
  async onTabClick(tab: TabType) {
    const availability = this.tabAvailability();
    
    // Check if tab is available
    if (!this.canViewTab(tab, availability)) {
      console.log(`[Summary] Tab '${tab}' is locked`);
      return;
    }
    
    // Navigate to tab
    await this.navigateToTab(tab);
    
    // Reset all view indices when switching tabs
    this.resetAllIndices();
  }

  /**
   * Reset all card indices to 0
   */
  private resetAllIndices() {
    this.favIndex.set(0);
    this.countIndex.set(0);
    this.genreBarIndex.set(0);
    this.ratedBarIndex.set(0);
    this.ratedPieIndex.set(0);
    this.genrePieIndex.set(0);
  }

  // ---------- Helpers ----------
  round(n: number): number { 
    return Math.round(n); 
  }

  private parseRuntimeToMinutes(input: unknown): number {
    if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, input);

    const s = String(input ?? '').trim();
    if (!s || /^(n\/a|na|unknown)$/i.test(s)) return 0;

    const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) return Math.max(0, parseInt(range[2], 10) || 0);

    const hours = s.match(/(\d+)\s*h(?:ours?)?/i);
    const mins  = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);

    if (hours || mins) {
      const h = hours ? parseInt(hours[1], 10) : 0;
      const m = mins  ? parseInt(mins[1], 10)  : 0;
      return Math.max(0, h * 60 + m);
    }

    const firstNum = s.match(/\d+/)?.[0];

    return Math.max(0, firstNum ? parseInt(firstNum, 10) : 0);
  }

  private movieRuntimeMinutes(m: Partial<RatingModel>): number {
    const runtime = (m.criteria as MovieCriteria | undefined)?.runtime;
    if (typeof runtime === 'number' && Number.isFinite(runtime)) return Math.max(0, runtime);

    return this.parseRuntimeToMinutes(runtime as unknown);
  }

  private seriesEpisodes(s: Partial<RatingModel>): number {
    const c = s.criteria as SeriesCriteria | undefined;
    const n = c?.episodes ?? 0;

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private genresOf(m: Partial<RatingModel>): string[] {
    const g = (m as any)?.genres ?? [];

    if (Array.isArray(g)) return g.map(x => String(x).trim()).filter(Boolean);

    if (typeof g === 'string') return g.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);

    return [];
  }

  private canonicalRated(m: Partial<RatingModel>): string[] {
    const r = String((m as any)?.rated ?? '').trim();
    if (!r) return [];
    
    return r.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);
  }


  /// ---------------------------------------- Cells ----------------------------------------  \\\
  /// ---------- Cell 1: Favorites ---------- \\\
  private bestOverall = computed<FavoriteEntry | null>(() => {
    const items = this.usersRatedList();
    if (!items.length) return null;

    const best = [...items].sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))[0] as any;
    
    const tab = this.currentTab();
    let label = 'Overall Favorite';
    if (tab === 'movies') label = 'Overall Favorite';
    else if (tab === 'series') label = 'Top Rated Show';
    else label = 'Overall Favorite';

    return {
      label,
      movieTitle: best.title ?? 'Unknown',
      rated: best?.rated ?? undefined,
      poster: best?.poster_url ?? undefined,
      rating: best?.rating ?? undefined,
      runtimeMin: this.movieRuntimeMinutes(best),
      episodes: this.seriesEpisodes(best) || undefined,
    };
  });

  private favoritesByGenreCombined = computed<FavoriteEntry[]>(() => {
    const items = this.usersRatedList();
    const byGenreTop = new Map<string, any>();

    for (const m of items) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        const cur = byGenreTop.get(g);
        if (!cur || ((m as any).rating ?? 0) > ((cur as any).rating ?? 0)) byGenreTop.set(g, m);
      }
    }

    const key = (m: RatingModel) => `${m.title ?? ''}::${m.poster_url ?? ''}`;
    const groups = new Map<string, { movie: any; genres: string[] }>();

    for (const [g, m] of byGenreTop.entries()) {
      const k = key(m);
      if (!groups.has(k)) groups.set(k, { movie: m, genres: [] });
      groups.get(k)!.genres.push(g);
    }

    const entries: FavoriteEntry[] = [];

    for (const { movie, genres } of groups.values()) {
      entries.push({
        label: `Favorite ${genres.sort((a, b) => a.localeCompare(b)).join('/')}`,
        movieTitle: movie.title ?? 'Unknown',
        rated: movie?.rated ?? undefined,
        poster: movie?.poster_url ?? undefined,
        rating: movie?.rating ?? undefined,
        runtimeMin: this.movieRuntimeMinutes(movie),
        episodes: this.seriesEpisodes(movie) || undefined,
      });
    }

    entries.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.label.localeCompare(b.label));

    return entries;
  });

  readonly favoritesSequence = computed<FavoriteEntry[]>(() => {
    const seq: FavoriteEntry[] = [];

    const overall = this.bestOverall();
    if (overall) seq.push(overall);

    seq.push(...this.favoritesByGenreCombined());

    return seq;
  });

  favTitle(): string {
    const seq = this.favoritesSequence();
    if (!seq.length) return 'Favorites';

    const idx = this.favIndex();

    return seq[idx]?.label || 'Favorites';
  }

  nextFav() { 
    const last = this.favoritesSequence().length - 1; 
    this.favIndex.update(i => Math.min(last, i + 1)); 
  }
  prevFav() { 
    this.favIndex.update(i => Math.max(0, i - 1)); 
  }

  /// ---------- Cell 2: Totals ---------- \\\
  readonly totalItems = computed(() => this.usersRatedList().length);

  /** Movies: sum minutes. Series: sum episodes. */
  readonly totalProgressUnit = computed(() => {
    if (this.filmKind() === 'movie') {
      return this.usersRatedList().reduce((acc, m) => acc + this.movieRuntimeMinutes(m as any), 0);
    }

    return this.usersRatedList().reduce((acc, s) => acc + this.seriesEpisodes(s as any), 0);
  });

  // ✅ NEW: For "All" tab - calculate both movies minutes and series episodes
  readonly totalMovieMinutes = computed(() => {
    return this.allRatedMovies().reduce((acc, m) => acc + this.movieRuntimeMinutes(m), 0);
  });

  readonly totalSeriesEpisodes = computed(() => {
    return this.allRatedSeries().reduce((acc, s) => acc + this.seriesEpisodes(s), 0);
  });

  // Movies: Longest / Shortest (ignore 0-minute runtimes)
  readonly longestMovieTitle = computed(() => {
    if (this.filmKind() !== 'movie') return '';

    const items = (this.usersRatedList() as RatingModel[]).filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.movieRuntimeMinutes(b) - this.movieRuntimeMinutes(a))[0];

    return best?.title ?? '';
  });
  readonly longestMovieMinutes = computed(() => {
    if (this.filmKind() !== 'movie') return 0;

    const nums = (this.usersRatedList() as RatingModel[]).map(m => this.movieRuntimeMinutes(m)).filter(n => n > 0);

    return nums.length ? Math.max(...nums) : 0;
  });

  readonly shortestMovieTitle = computed(() => {
    if (this.filmKind() !== 'movie') return '';

    const items = (this.usersRatedList() as RatingModel[]).filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.movieRuntimeMinutes(a) - this.movieRuntimeMinutes(b))[0];

    return best?.title ?? '';
  });
  readonly shortestMovieMinutes = computed(() => {
    if (this.filmKind() !== 'movie') return 0;

    const nums = (this.usersRatedList() as RatingModel[]).map(m => this.movieRuntimeMinutes(m)).filter(n => n > 0);

    return nums.length ? Math.min(...nums) : 0;
  });

  // Series: Most / Fewest episodes
  readonly mostEpisodesTitle = computed(() => {
    if (this.filmKind() !== 'series') return '';

    const items = this.usersRatedList() as RatingModel[];
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.seriesEpisodes(b) - this.seriesEpisodes(a))[0];

    return best?.title ?? '';
  });
  readonly mostEpisodesCount = computed(() => {
    if (this.filmKind() !== 'series') return 0;

    const nums = (this.usersRatedList() as RatingModel[]).map(s => this.seriesEpisodes(s));

    return nums.length ? Math.max(...nums) : 0;
  });

  readonly fewestEpisodesTitle = computed(() => {
    if (this.filmKind() !== 'series') return '';

    const items = (this.usersRatedList() as RatingModel[]).filter(s => this.seriesEpisodes(s) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.seriesEpisodes(a) - this.seriesEpisodes(b))[0];

    return best?.title ?? '';
  });
  readonly fewestEpisodesCount = computed(() => {
    if (this.filmKind() !== 'series') return 0;

    const nums = (this.usersRatedList() as RatingModel[]).map(s => this.seriesEpisodes(s)).filter(n => n > 0);

    return nums.length ? Math.min(...nums) : 0;
  });

  // Creative: counts you've explored
  readonly genresExplored = computed(() => {
    const set = new Set<string>();

    this.usersRatedList().forEach(m => this.genresOf(m).forEach(g => set.add(g)));

    return set.size;
  });
  readonly ratingsExplored = computed(() => {
    const set = new Set<string>();

    this.usersRatedList().forEach(m => this.canonicalRated(m).forEach(r => set.add(r)));

    return set.size;
  });

  // ✅ NEW: Computeds for "All" tab that work across both movies and series
  readonly longestMovieForAll = computed(() => {
    const movies = this.allRatedMovies().filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!movies.length) return { title: '', minutes: 0 };
    
    const best = [...movies].sort((a, b) => this.movieRuntimeMinutes(b) - this.movieRuntimeMinutes(a))[0];
    return { title: best?.title ?? '', minutes: this.movieRuntimeMinutes(best) };
  });

  readonly shortestMovieForAll = computed(() => {
    const movies = this.allRatedMovies().filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!movies.length) return { title: '', minutes: 0 };
    
    const best = [...movies].sort((a, b) => this.movieRuntimeMinutes(a) - this.movieRuntimeMinutes(b))[0];
    return { title: best?.title ?? '', minutes: this.movieRuntimeMinutes(best) };
  });

  readonly mostEpisodesForAll = computed(() => {
    const series = this.allRatedSeries().filter(s => this.seriesEpisodes(s) > 0);
    if (!series.length) return { title: '', episodes: 0 };
    
    const best = [...series].sort((a, b) => this.seriesEpisodes(b) - this.seriesEpisodes(a))[0];
    return { title: best?.title ?? '', episodes: this.seriesEpisodes(best) };
  });

  readonly fewestEpisodesForAll = computed(() => {
    const series = this.allRatedSeries().filter(s => this.seriesEpisodes(s) > 0);
    if (!series.length) return { title: '', episodes: 0 };
    
    const best = [...series].sort((a, b) => this.seriesEpisodes(a) - this.seriesEpisodes(b))[0];
    return { title: best?.title ?? '', episodes: this.seriesEpisodes(best) };
  });

  private plural(n: number, one: string, many: string) { 
    return `${n} ${n === 1 ? one : many}`; 
  }

  formatDuration(totalMin: number) {
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;
    const parts: string[] = [];

    if (d) parts.push(this.plural(d, 'Day', 'Days'));
    if (h) parts.push(this.plural(h, 'Hour', 'Hours'));
    if (m) parts.push(this.plural(m, 'Minute', 'Minutes'));

    if (!parts.length) return '0 Minutes';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;

    return `${parts[0]}, ${parts[1]} and ${parts[2]}`;
  }

  totalsTitle(): string {
    const tab = this.currentTab();
    
    if (tab === 'all') {
      return this.countIndex() === 0 ? 'Total Films Watched' : 'Combined Watch Time';
    }
    
    if (this.filmKind() === 'movie') {
      return this.countIndex() === 0 ? 'Total Movies Watched' : 'Total Time Watched';
    }

    return this.countIndex() === 0 ? 'Total Series Watched' : 'Total Episodes Watched';
  }

  nextCount() { 
    this.countIndex.update(i => Math.min(1, i + 1)); 
  }
  prevCount() { 
    this.countIndex.update(i => Math.max(0, i - 1)); 
  }

  // ---------- Aggregation ----------
  private sumBy<T>(arr: T[], f: (x: T) => number) { 
    return arr.reduce((acc, x) => acc + (f(x) || 0), 0); 
  }
  private sortDesc(data: ChartDatum[]): ChartDatum[] { 
    return [...data].sort((a, b) => b.value - a.value); 
  }

  // ---------- Buckets built from current items ----------
  private genreBuckets = computed(() => {
    const buckets = new Map<string, (RatingModel)[]>();

    for (const m of this.usersRatedList()) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        if (!buckets.has(g)) buckets.set(g, []);
        buckets.get(g)!.push(m);
      }
    }

    return buckets;
  });

  private ratedBuckets = computed(() => {
    const buckets = new Map<string, (RatingModel)[]>();

    for (const m of this.usersRatedList()) {
      const rs = this.canonicalRated(m);
      const keyList = rs.length ? rs : ['N/A'];
      for (const r of keyList) {
        if (!buckets.has(r)) buckets.set(r, []);
        buckets.get(r)!.push(m);
      }
    }

    return buckets;
  });

  /// ---------- Cell 3: Genre bars ---------- \\\
  readonly genreAvgRating = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [g, list] of this.genreBuckets().entries()) {
      const avg = list.length ? this.sumBy(list, x => (x as any).rating ?? 0) / list.length : 0;
      out.push({ label: g, value: avg });
    }

    return this.sortDesc(out);
  });
  readonly genreCount = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [g, list] of this.genreBuckets().entries()) out.push({ label: g, value: list.length });

    return this.sortDesc(out);
  });
  readonly genreProgress = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [g, list] of this.genreBuckets().entries()) {
      if (this.filmKind() === 'movie') {
        const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m as any));
        out.push({ label: g, value: minutes / 60 });
      } else {
        const episodes = this.sumBy(list, s => this.seriesEpisodes(s as any));
        out.push({ label: g, value: episodes });
      }
    }

    return this.sortDesc(out);
  });

  genreBarTitle(): string {
    switch (this.genreBarIndex()) {
      case 0: return 'Average Rating per Genre';
      case 1: return 'Number Watched per Genre';
      default: return this.filmKind() === 'movie' ? 'Hours Watched per Genre' : 'Episodes Watched per Genre';
    }
  }

  nextGenreBar() { 
    this.genreBarIndex.update(i => Math.min(2, i + 1)); 
  }
  prevGenreBar() { 
    this.genreBarIndex.update(i => Math.max(0, i - 1)); 
  }

  /// ---------- Cell 4: Rated bars ---------- \\\
  readonly ratedAvgRating = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [r, list] of this.ratedBuckets().entries()) {
      const avg = list.length ? this.sumBy(list, x => (x as any).rating ?? 0) / list.length : 0;
      out.push({ label: r, value: avg });
    }

    return this.sortDesc(out);
  });
  readonly ratedCount = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [r, list] of this.ratedBuckets().entries()) out.push({ label: r, value: list.length });
    
    return this.sortDesc(out);
  });
  readonly ratedProgress = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [r, list] of this.ratedBuckets().entries()) {
      if (this.filmKind() === 'movie') {
        const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m as any));
        out.push({ label: r, value: minutes / 60 });
      } else {
        const episodes = this.sumBy(list, s => this.seriesEpisodes(s as any));
        out.push({ label: r, value: episodes });
      }
    }

    return this.sortDesc(out);
  });

  ratedBarTitle(): string {
    switch (this.ratedBarIndex()) {
      case 0: return 'Average Rating per Film Rating';
      case 1: return 'Number Watched per Film Rating';
      default: return this.filmKind() === 'movie' ? 'Hours Watched per Film Rating' : 'Episodes Watched per Film Rating';
    }
  }

  nextRatedBar() { 
    this.ratedBarIndex.update(i => Math.min(2, i + 1)); 
  }
  prevRatedBar() { 
    this.ratedBarIndex.update(i => Math.max(0, i - 1)); 
  }

  /// ---------- Cell 5: Rated pies ---------- \\\
  readonly ratedCountShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [r, list] of this.ratedBuckets().entries()) out.push({ label: r, value: list.length });
    
    return out;
  });
  readonly ratedProgressShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [r, list] of this.ratedBuckets().entries()) {
      if (this.filmKind() === 'movie') {
        const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m as any));
        out.push({ label: r, value: minutes });
      } else {
        const episodes = this.sumBy(list, s => this.seriesEpisodes(s as any));
        out.push({ label: r, value: episodes });
      }
    }
    
    return out;
  });

  ratedPieTitle(): string { 
    return this.ratedPieIndex() === 0 ? (this.filmKind() === 'movie' ? 'Film Ratings Distribution per Movie' : 'Film Ratings Distribution per Show') : (this.filmKind() === 'movie' ? 'Film Ratings Distribution per Hour' : 'Film Ratings Distribution per Episode'); 
  }

  nextRatedPie() { 
    this.ratedPieIndex.update(i => Math.min(1, i + 1)); 
  }
  prevRatedPie() { 
    this.ratedPieIndex.update(i => Math.max(0, i - 1)); 
  }

  ratedPieCenterTop(): string {
    if (this.ratedPieIndex() === 0) return String(this.ratedCountShare().reduce((a, b) => a + b.value, 0));

    const total = this.ratedProgressShare().reduce((a, b) => a + b.value, 0);

    return this.filmKind() === 'movie' ? String(Math.round(total / 60)) : String(total);
  }
  ratedPieCenterBottom(): string { 
    return this.ratedPieIndex() === 0 ? 'Total' : (this.filmKind() === 'movie' ? 'Hours' : 'Episodes'); 
  }

  /// ---------- Cell 6: Genre pies ---------- \\\
  readonly genreCountShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [g, list] of this.genreBuckets().entries()) out.push({ label: g, value: list.length });
    
    return out;
  });
  readonly genreProgressShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];

    for (const [g, list] of this.genreBuckets().entries()) {
      if (this.filmKind() === 'movie') {
        const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m as any));
        out.push({ label: g, value: minutes });
      } else {
        const episodes = this.sumBy(list, s => this.seriesEpisodes(s as any));
        out.push({ label: g, value: episodes });
      }
    }

    return out;
  });

  genrePieTitle(): string { 
    return this.genrePieIndex() === 0 ? (this.filmKind() === 'movie' ? 'Genre Distribution per Movie' : 'Genre Distribution per Show') : (this.filmKind() === 'movie' ? 'Genre Distribution per Hour' : 'Genre Distribution per Episode'); 
  }

  nextGenrePie() { 
    this.genrePieIndex.update(i => Math.min(1, i + 1)); 
  }
  prevGenrePie() { 
    this.genrePieIndex.update(i => Math.max(0, i - 1)); 
  }

  genrePieCenterTop(): string {
    if (this.genrePieIndex() === 0) return String(this.genreCountShare().reduce((a, b) => a + b.value, 0));

    const total = this.genreProgressShare().reduce((a, b) => a + b.value, 0);

    return this.filmKind() === 'movie' ? String(Math.round(total / 60)) : String(total);
  }
  genrePieCenterBottom(): string { 
    return this.genrePieIndex() === 0 ? 'Total' : (this.filmKind() === 'movie' ? 'Hours' : 'Episodes'); 
  }


  /// ---------------------------------------- Responsive Sidebar ----------------------------------------  \\\
  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }
  
  /// ---------------------------------------- Helpers ----------------------------------------  \\\
  isActive(prefix: string): boolean { 
    return (this.router.url || '').toLowerCase().startsWith(prefix); 
  }

  posterOrFallback(url?: string): string {
    return (!url || /^(n\/?a|na|null|undefined|unknown)$/i.test(url.trim())) ? this.fallbackPoster : url;
  }
  onPosterError(evt: Event) {
    const img = evt.target as HTMLImageElement | null;
    if (!img) return;

    try {
      const current = new URL(img.src, window.location.href).pathname;
      if (current.endsWith('/assets/images/no-poster.png')) return;
    } catch {}

    img.src = this.fallbackPoster;
  }

  maxValue(data: ChartDatum[]): number { 
    return data.reduce((acc, d) => Math.max(acc, d.value), 0) || 1; 
  }

  barPct(value: number, max: number): string { 
    const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100)); return pct.toFixed(2) + '%'; 
  }

  pieGradient(data: ChartDatum[]): string {
    const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
    let acc = 0; const parts: string[] = [];

    data.forEach((d, i) => {
      const start = (acc / total) * 360;
      const end = ((acc + d.value) / total) * 360;
      const color = this.segmentColor(i);

      parts.push(`${color} ${start}deg ${end}deg`);
      acc += d.value;
    });

    return `conic-gradient(${parts.join(',')})`;
  }

  segmentColor(i: number): string { 
    return `hsl(${(i * 47) % 360} 70% 50%)`; 
  }
}