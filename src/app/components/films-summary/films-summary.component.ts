import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

import { RoutingService } from '../../services/routing.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { AccountInformationModel } from '../../models/database-models/account-information-model';
import { RatedMovieModel } from '../../models/database-models/rated-movie-model';
import { RatedSeriesModel } from '../../models/database-models/rated-series-model';
import { SidebarService } from '../../services/sidebar.service';

type FilmKind = 'movie' | 'series';
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
  runtimeMin: number 
};

@Component({
  selector: 'app-films-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './films-summary.component.html',
  styleUrls: ['./films-summary.component.css'],
})


export class FilmsSummaryComponent implements OnInit {
  readonly routingService = inject(RoutingService);
  readonly localStorageService = inject(LocalStorageService);
  private router = inject(Router);
  readonly sidebarService = inject(SidebarService);

  readonly sidebarActive = signal(true);
  readonly filmKind = signal<FilmKind>('movie');

  readonly favIndex      = signal(0);
  readonly countIndex    = signal(0);
  readonly genreBarIndex = signal(0);
  readonly ratedBarIndex = signal(0);
  readonly ratedPieIndex = signal(0);
  readonly genrePieIndex = signal(0);

  readonly fallbackPoster = 'assets/images/no-poster.png';

  public currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user');

  ngOnInit() {
    this.addRandomStartPointForRows();

    const setKindFromUrl = () => {
      const url = (this.router.url || '').toLowerCase();
      this.filmKind.set(/\b(shows)\b/.test(url) ? 'series' : 'movie');
    };

    setKindFromUrl();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(setKindFromUrl);
  }

  // ---------- Helpers ----------
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }

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

  private movieRuntimeMinutes(m: Partial<RatedMovieModel>): number {
    const direct = (m as any)?.runTime ?? (m as any)?.runtimeMinutes ?? (m as any)?.runtime_min ?? null;
    if (Number.isFinite(direct)) return Math.max(0, Number(direct));

    const rt = (m as any)?.runtime ?? (m as any)?.Runtime ?? '';

    return this.parseRuntimeToMinutes(rt);
  }

  private seriesEpisodes(s: Partial<RatedSeriesModel>): number {
    const raw =
      (s as any)?.episodes ??
      (s as any)?.episodeCount ??
      (s as any)?.totalEpisodes ??
      (s as any)?.episodes_watched ??
      0;

    const n = Number(raw);

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private genresOf(m: Partial<RatedMovieModel | RatedSeriesModel>): string[] {
    const g = (m as any)?.genres ?? [];

    if (Array.isArray(g)) return g.map(x => String(x).trim()).filter(Boolean);

    if (typeof g === 'string') return g.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);

    return [];
  }

  private canonicalRated(m: Partial<RatedMovieModel | RatedSeriesModel>): string[] {
    const r = String((m as any)?.rated ?? '').trim();
    if (!r) return [];
    
    return r.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);
  }

  // ---------- Data ----------
  private allRatedMovies = computed<RatedMovieModel[]>(() => {
    const list = this.localStorageService.getInformation('rated-movies') ?? [];
    return list as RatedMovieModel[];
  });

  private allRatedSeries = computed<RatedSeriesModel[]>(() => {
    const list = this.localStorageService.getInformation('rated-series') ?? [];
    return list as RatedSeriesModel[];
  });

  private usersRatedMovies = computed<RatedMovieModel[]>(() => {
    const u = this.currentUser?.username;
    return (this.allRatedMovies() ?? []).filter(m => m.username === u);
  });

  private usersRatedSeries = computed<RatedSeriesModel[]>(() => {
    const u = this.currentUser?.username;
    return (this.allRatedSeries() ?? []).filter(s => (s as any).username === u);
  });

  ///  Current list based on filmKind  \\\
  private items = computed<(RatedMovieModel | RatedSeriesModel)[]>(() =>
    this.filmKind() === 'movie' ? this.usersRatedMovies() : this.usersRatedSeries()
  );


  /// ---------------------------------------- Cells ----------------------------------------  \\\
  /// ---------- Cell 1: Favorites ---------- \\\
  private bestOverall = computed<FavoriteEntry | null>(() => {
    const items = this.items();
    if (!items.length) return null;

    const best = [...items].sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))[0] as any;
    const label = this.filmKind() === 'movie' ? 'Overall Favorite' : 'Top Rated Show';

    return {
      label,
      movieTitle: best.title ?? 'Unknown',
      rated: best?.rated,
      poster: best?.poster,
      rating: best?.rating ?? undefined,
      runtimeMin: this.filmKind() === 'movie' ? this.movieRuntimeMinutes(best) : 0,
    };
  });

  private favoritesByGenreCombined = computed<FavoriteEntry[]>(() => {
    const items = this.items();
    const byGenreTop = new Map<string, any>();

    for (const m of items) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        const cur = byGenreTop.get(g);
        if (!cur || ((m as any).rating ?? 0) > ((cur as any).rating ?? 0)) byGenreTop.set(g, m);
      }
    }

    const key = (m: any) => `${m.title ?? ''}::${m.poster ?? ''}`;
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
        rated: movie?.rated,
        poster: movie?.poster,
        rating: movie?.rating ?? undefined,
        runtimeMin: this.filmKind() === 'movie' ? this.movieRuntimeMinutes(movie) : 0,
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
  readonly totalItems = computed(() => this.items().length);

  /** Movies: sum minutes. Series: sum episodes. */
  readonly totalProgressUnit = computed(() => {
    if (this.filmKind() === 'movie') {
      return this.items().reduce((acc, m) => acc + this.movieRuntimeMinutes(m as any), 0);
    }

    return this.items().reduce((acc, s) => acc + this.seriesEpisodes(s as any), 0);
  });

  // Movies: Longest / Shortest (ignore 0-minute runtimes)
  readonly longestMovieTitle = computed(() => {
    if (this.filmKind() !== 'movie') return '';

    const items = (this.items() as RatedMovieModel[]).filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.movieRuntimeMinutes(b) - this.movieRuntimeMinutes(a))[0];

    return best?.title ?? '';
  });
  readonly longestMovieMinutes = computed(() => {
    if (this.filmKind() !== 'movie') return 0;

    const nums = (this.items() as RatedMovieModel[]).map(m => this.movieRuntimeMinutes(m)).filter(n => n > 0);

    return nums.length ? Math.max(...nums) : 0;
  });

  readonly shortestMovieTitle = computed(() => {
    if (this.filmKind() !== 'movie') return '';

    const items = (this.items() as RatedMovieModel[]).filter(m => this.movieRuntimeMinutes(m) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.movieRuntimeMinutes(a) - this.movieRuntimeMinutes(b))[0];

    return best?.title ?? '';
  });
  readonly shortestMovieMinutes = computed(() => {
    if (this.filmKind() !== 'movie') return 0;

    const nums = (this.items() as RatedMovieModel[]).map(m => this.movieRuntimeMinutes(m)).filter(n => n > 0);

    return nums.length ? Math.min(...nums) : 0;
  });

  // Series: Most / Fewest episodes
  readonly mostEpisodesTitle = computed(() => {
    if (this.filmKind() !== 'series') return '';

    const items = this.items() as RatedSeriesModel[];
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.seriesEpisodes(b) - this.seriesEpisodes(a))[0];

    return best?.title ?? '';
  });
  readonly mostEpisodesCount = computed(() => {
    if (this.filmKind() !== 'series') return 0;

    const nums = (this.items() as RatedSeriesModel[]).map(s => this.seriesEpisodes(s));

    return nums.length ? Math.max(...nums) : 0;
  });

  readonly fewestEpisodesTitle = computed(() => {
    if (this.filmKind() !== 'series') return '';

    const items = (this.items() as RatedSeriesModel[]).filter(s => this.seriesEpisodes(s) > 0);
    if (!items.length) return '';

    const best = [...items].sort((a, b) => this.seriesEpisodes(a) - this.seriesEpisodes(b))[0];

    return best?.title ?? '';
  });
  readonly fewestEpisodesCount = computed(() => {
    if (this.filmKind() !== 'series') return 0;

    const nums = (this.items() as RatedSeriesModel[]).map(s => this.seriesEpisodes(s)).filter(n => n > 0);

    return nums.length ? Math.min(...nums) : 0;
  });

  // Creative: counts you’ve explored
  readonly genresExplored = computed(() => {
    const set = new Set<string>();

    this.items().forEach(m => this.genresOf(m).forEach(g => set.add(g)));

    return set.size;
  });
  readonly ratingsExplored = computed(() => {
    const set = new Set<string>();

    this.items().forEach(m => this.canonicalRated(m).forEach(r => set.add(r)));

    return set.size;
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
    if (this.filmKind() === 'movie') return this.countIndex() === 0 ? 'Total Movies Watched' : 'Total Time Watched';

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
    const buckets = new Map<string, (RatedMovieModel | RatedSeriesModel)[]>();

    for (const m of this.items()) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        if (!buckets.has(g)) buckets.set(g, []);
        buckets.get(g)!.push(m);
      }
    }

    return buckets;
  });

  private ratedBuckets = computed(() => {
    const buckets = new Map<string, (RatedMovieModel | RatedSeriesModel)[]>();

    for (const m of this.items()) {
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