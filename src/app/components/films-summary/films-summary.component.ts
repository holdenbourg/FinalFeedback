import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

import { RoutingService } from '../../services/routing.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { AccountInformationModel } from '../../models/database-models/account-information-model';
import { RatedMovieModel } from '../../models/database-models/rated-movie-model';
import { RatedSeriesModel } from '../../models/database-models/rated-series-model';

type FilmKind = 'movie' | 'series';
type ChartDatum = { label: string; value: number };
type FavoriteEntry = { label: string; movieTitle: string; rated?: string; poster?: string; rating?: number; runtimeMin: number };

@Component({
  selector: 'app-films-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './films-summary.component.html',
  styleUrls: ['./films-summary.component.css'],
})
export class FilmsSummaryComponent implements OnInit {
  // Services
  readonly routingService = inject(RoutingService);
  readonly localStorageService = inject(LocalStorageService);
  private router = inject(Router);
  Math = Math;

  // UI state
  readonly sidebarActive = signal(true);
  readonly filmKind = signal<FilmKind>('movie');

  // Carousels (one index per cell)
  readonly favIndex       = signal(0); // Cell 1 views
  readonly countIndex     = signal(0); // Cell 2 views
  readonly genreBarIndex  = signal(0); // Cell 3 views: avg rating / count / hours
  readonly ratedBarIndex  = signal(0); // Cell 4 views: avg rating / count / hours
  readonly ratedPieIndex  = signal(0); // Cell 5 views: count share / time share
  readonly genrePieIndex  = signal(0); // Cell 6 views: count share / time share

  // Current user & data
  public currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user');

  // ---------- Lifecycle ----------
  ngOnInit() {
    const setKindFromUrl = () => {
      const url = (this.router.url || '').toLowerCase();
      this.filmKind.set(/\b(shows)\b/.test(url) ? 'series' : 'movie');
    };

    setKindFromUrl();
    this.applySidebarByWidth(window.innerWidth);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(setKindFromUrl);
  }

  // ---------- Sidebar responsive ----------
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
  navDelay(i: number): number {
    const active = this.filmKind() === 'series' ? 3 : 2;
    return 1 + Math.abs(i - active);
  }

  // ---------- Helpers & parsing ----------
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

  private genresOf(m: Partial<RatedMovieModel | RatedSeriesModel>): string[] {
    const g = (m as any)?.genres ?? [];
    if (Array.isArray(g)) return g.map(x => String(x).trim()).filter(Boolean);
    if (typeof g === 'string') return g.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);
    return [];
  }

  private canonicalRated(m: Partial<RatedMovieModel>): string[] {
    const r = String((m as any)?.rated ?? '').trim();
    if (!r) return [];
    // Some titles may have multi-valued ratings (rare). Support splitting on slashes/pipes/commas if present.
    return r.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean);
  }

  round(n: number): number {
    return Math.round(n);
  }

  // ---------- Data sources ----------
  private allRatedMovies = computed<RatedMovieModel[]>(() => {
    const list = this.localStorageService.getInformation('rated-movies') ?? [];
    return list as RatedMovieModel[];
  });

  private usersRatedMovies = computed<RatedMovieModel[]>(() => {
    const u = this.currentUser?.username;
    return (this.allRatedMovies() ?? []).filter(m => m.username === u);
  });

  // ---------- Cell 1: Favorites ----------
  private bestOverall = computed<FavoriteEntry | null>(() => {
    const items = this.usersRatedMovies();
    if (!items.length) return null;
    const best = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    return {
      label: 'Overall Favorite',
      movieTitle: best.title ?? 'Unknown',
      rated: (best as any)?.rated,
      poster: (best as any)?.poster,
      rating: best.rating ?? undefined,
      runtimeMin: this.movieRuntimeMinutes(best),
    };
  });

  private favoritesByGenreCombined = computed<FavoriteEntry[]>(() => {
    const items = this.usersRatedMovies();
    const byGenreTop = new Map<string, RatedMovieModel>();

    // Find top per single genre
    for (const m of items) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        const cur = byGenreTop.get(g);
        if (!cur || (m.rating ?? 0) > (cur.rating ?? 0)) {
          byGenreTop.set(g, m);
        }
      }
    }

    // Group genres that share the same top movie (combine labels)
    const movieKey = (m: RatedMovieModel) => `${m.title ?? ''}::${(m as any)?.poster ?? ''}`;
    const groups = new Map<string, { movie: RatedMovieModel; genres: string[] }>();

    for (const [g, m] of byGenreTop.entries()) {
      const key = movieKey(m);
      if (!groups.has(key)) groups.set(key, { movie: m, genres: [] });
      groups.get(key)!.genres.push(g);
    }

    // Build entries (skip the "overall" label here)
    const entries: FavoriteEntry[] = [];
    for (const { movie, genres } of groups.values()) {
      entries.push({
        label: genres.sort((a, b) => a.localeCompare(b)).join(' / '),
        movieTitle: movie.title ?? 'Unknown',
        rated: (movie as any)?.rated,
        poster: (movie as any)?.poster,
        rating: movie.rating ?? undefined,
        runtimeMin: this.movieRuntimeMinutes(movie),
      });
    }

    // Sort by the top movie's rating desc, then label asc for stability
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

  nextFav() {
    if (!this.favoritesSequence().length) return;
    this.favIndex.update(i => (i + 1) % this.favoritesSequence().length);
  }

  // ---------- Cell 2: Counts + Time ----------
  readonly totalMovies = computed(() => this.usersRatedMovies().length);

  readonly totalMinutes = computed(() =>
    this.usersRatedMovies().reduce((acc, m) => acc + this.movieRuntimeMinutes(m), 0)
  );

  formatDuration(totalMin: number) {
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;

    if (d > 0) {
      return `${d} ${d === 1 ? 'Day' : 'Days'}, ${h} ${h === 1 ? 'Hour' : 'Hours'}, ${m} ${m === 1 ? 'Minute' : 'Minutes'}`;
    } else if (h > 0) {
      return `${h} ${h === 1 ? 'Hour' : 'Hours'}, ${m} ${m === 1 ? 'Minute' : 'Minutes'}`;
    } else {
      return `${m} ${m === 1 ? 'Minute' : 'Minutes'}`;
    }
  }

  nextCount() {
    // 0 = total count; 1 = total time
    this.countIndex.update(i => (i + 1) % 2);
  }

  // ---------- Aggregation helpers ----------
  private sumBy<T>(arr: T[], f: (x: T) => number) {
    return arr.reduce((acc, x) => acc + (f(x) || 0), 0);
  }

  private topN(data: ChartDatum[], n = 10): ChartDatum[] {
    if (data.length <= n) return data;
    // drop the smallest to keep the list concise
    return [...data].sort((a, b) => b.value - a.value).slice(0, n);
  }

  // ---------- Cell 3: Genre bar charts ----------
  private genreBuckets = computed(() => {
    const buckets = new Map<string, RatedMovieModel[]>();
    for (const m of this.usersRatedMovies()) {
      const genres = this.genresOf(m);
      for (const g of genres) {
        if (!buckets.has(g)) buckets.set(g, []);
        buckets.get(g)!.push(m);
      }
    }
    return buckets;
  });

  readonly genreAvgRating = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [g, list] of this.genreBuckets().entries()) {
      const avg = list.length ? this.sumBy(list, x => x.rating ?? 0) / list.length : 0;
      out.push({ label: g, value: avg });
    }
    return this.topN(out);
  });

  readonly genreCount = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [g, list] of this.genreBuckets().entries()) {
      out.push({ label: g, value: list.length });
    }
    return this.topN(out);
  });

  readonly genreHours = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [g, list] of this.genreBuckets().entries()) {
      const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m));
      out.push({ label: g, value: minutes / 60 });
    }
    return this.topN(out);
  });

  nextGenreBar() {
    // 0 = avg rating, 1 = count, 2 = hours
    this.genreBarIndex.update(i => (i + 1) % 3);
  }

  // ---------- Cell 4: Rated (MPAA/TV) bar charts ----------
  private ratedBuckets = computed(() => {
    const buckets = new Map<string, RatedMovieModel[]>();
    for (const m of this.usersRatedMovies()) {
      const rs = this.canonicalRated(m);
      const keyList = rs.length ? rs : ['N/A'];
      for (const r of keyList) {
        if (!buckets.has(r)) buckets.set(r, []);
        buckets.get(r)!.push(m);
      }
    }
    return buckets;
  });

  readonly ratedAvgRating = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [r, list] of this.ratedBuckets().entries()) {
      const avg = list.length ? this.sumBy(list, x => x.rating ?? 0) / list.length : 0;
      out.push({ label: r, value: avg });
    }
    return this.topN(out);
  });

  readonly ratedCount = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [r, list] of this.ratedBuckets().entries()) {
      out.push({ label: r, value: list.length });
    }
    return this.topN(out);
  });

  readonly ratedHours = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [r, list] of this.ratedBuckets().entries()) {
      const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m));
      out.push({ label: r, value: minutes / 60 });
    }
    return this.topN(out);
  });

  nextRatedBar() {
    // 0 = avg rating, 1 = count, 2 = hours
    this.ratedBarIndex.update(i => (i + 1) % 3);
  }

  // ---------- Cell 5: Rated (MPAA/TV) pie charts ----------
  readonly ratedCountShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    const total = this.totalMovies();
    if (total <= 0) return out;

    // If movie has multiple ratings, it counts toward each
    for (const [r, list] of this.ratedBuckets().entries()) {
      out.push({ label: r, value: list.length });
    }
    return out;
  });

  readonly ratedTimeShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [r, list] of this.ratedBuckets().entries()) {
      const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m));
      out.push({ label: r, value: minutes }); // keep minutes for share calc
    }
    return out;
  });

  nextRatedPie() {
    // 0 = count share, 1 = time share
    this.ratedPieIndex.update(i => (i + 1) % 2);
  }

  // ---------- Cell 6: Genre pie charts ----------
  readonly genreCountShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [g, list] of this.genreBuckets().entries()) {
      out.push({ label: g, value: list.length });
    }
    return out;
  });

  readonly genreTimeShare = computed<ChartDatum[]>(() => {
    const out: ChartDatum[] = [];
    for (const [g, list] of this.genreBuckets().entries()) {
      const minutes = this.sumBy(list, m => this.movieRuntimeMinutes(m));
      out.push({ label: g, value: minutes });
    }
    return out;
  });

  nextGenrePie() {
    // 0 = count share, 1 = time share
    this.genrePieIndex.update(i => (i + 1) % 2);
  }

  // ---------- Rendering helpers ----------
  isActive(prefix: string): boolean {
    return (this.router.url || '').toLowerCase().startsWith(prefix);
  }

  posterOrFallback(url?: string): string {
    if (!url || url === 'N/A') return 'assets/images/no-poster.png';
    return url;
  }

  // Bars
  maxValue(data: ChartDatum[]): number {
    return data.reduce((acc, d) => Math.max(acc, d.value), 0) || 1;
  }
  barPct(value: number, max: number): string {
    const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
    return pct.toFixed(2) + '%';
  }

  // Pies
  pieGradient(data: ChartDatum[]): string {
    const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
    let acc = 0;
    const parts: string[] = [];
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
    // Soft, evenly spaced hues
    return `hsl(${(i * 47) % 360} 70% 50%)`;
  }

  // Labels
  formatHours(h: number): string {
    const n = Math.round(h);
    return `${n} ${n === 1 ? 'Hour' : 'Hours'}`;
  }
}