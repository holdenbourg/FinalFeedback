import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, signal, computed, HostListener, ElementRef, ViewChild, NgZone, AfterViewInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { LocalStorageService } from "../../services/local-storage.service";
import { RoutingService } from "../../services/routing.service";
import { RatedFilmComponent } from "../templates/rated-film/rated-film.component";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { FilmCacheService } from "../../services/film-cache.service";
import { SidebarService } from "../../services/sidebar.service";
import { UsersService } from "../../services/users.service";
import { MovieCriteria, RatingModel, SeriesCriteria } from "../../models/database-models/rating.model";
import { RatingsService } from "../../services/ratings.service";
import { UserModel } from "../../models/database-models/user.model";

type SortKey = 'rating' | 'runtime' | 'dateRated' | 'title';

type FilmKind = 'movie' | 'series';
type RatedItem = RatingModel;

type FilmUIState = {
  movie: { activePostId?: string; scrollTop?: number };
  series: { activePostId?: string; scrollTop?: number };
};

@Component({
  selector: 'app-films-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RatedFilmComponent],
  templateUrl: './films-library.component.html',
  styleUrls: ['./films-library.component.css'],
})


export class FilmsLibraryComponent implements OnInit, AfterViewInit {
  private elementRef = inject(ElementRef)
  readonly ngZone = inject(NgZone);
  readonly routingService = inject(RoutingService);
  public readonly localStorageService = inject(LocalStorageService);
  readonly filmCache = inject(FilmCacheService);
  private router = inject(Router);
  readonly sidebarService = inject(SidebarService);
  readonly usersService = inject(UsersService);
  readonly ratingsService = inject(RatingsService);

  private readonly SLOW_SCROLL_MS = 500;
  private readonly UI_STATE_KEY = 'films-ui-state';
  @ViewChild('scrollBox', { static: false }) scrollBoxRef?: ElementRef<HTMLElement>;

  public currentUser = signal<UserModel | null>(null);

  readonly searchInput = signal('');

  readonly filmKind = signal<FilmKind>('movie');

  activeFilm: RatedItem | null = null;

  ///  Filtering State  \\\
  readonly filtersOpen = signal(false);
  readonly genresOpen = signal(false);
  readonly ratedOpen  = signal(false);
  readonly sortKey = signal<SortKey>('dateRated');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly selectedGenre = signal<string>('All');
  readonly selectedGenres = signal<Set<string>>(new Set());
  readonly selectedRated = signal<string>('All');
  readonly selectedRateds = signal<Set<string>>(new Set());

  ///  Delete Confirmation State  \\\
  readonly confirmOpen = signal(false);
  readonly confirmTarget = signal<RatedItem | null>(null);


  genresLabel = computed(() => {
    const sel = this.selectedGenres();
    if (sel.size === 0) return 'All';
    if (sel.size <= 2)  return Array.from(sel).join(', ');
    return `${sel.size} selected`;
  });
  ratedLabel = computed(() => {
    const sel = this.selectedRateds();
    if (sel.size === 0) return 'All';
    if (sel.size <= 2)  return Array.from(sel).join(', ');
    return `${sel.size} selected`;
  });

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';

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

  public usersRatedList = computed<RatingModel[]>(() =>
    this.filmKind() === 'series' ? this.usersRatedSeries() : this.usersRatedMovies()
  );


  ngOnInit(): void {
    this.usersService.getCurrentUserProfile()
      .then(async (u) => {
        this.currentUser.set(u);
        this.addRandomStartPointForRows();

        if (u) {
          const [movies, series] = await Promise.all([
            this.ratingsService.getUserMovies(u.id),
            this.ratingsService.getUserSeries(u.id),
          ]);

          this.allRatedMovies.set(movies);
          this.allRatedSeries.set(series);
        } else {
          this.allRatedMovies.set([]);
          this.allRatedSeries.set([]);
        }
      })
      .catch(err => {
        console.error('Failed to load current user', err);
        this.currentUser.set(null);
        this.allRatedMovies.set([]);
        this.allRatedSeries.set([]);
        this.addRandomStartPointForRows();
      });

    const setKindFromUrl = () => {
      const url = (this.router.url || '').toLowerCase();
      this.filmKind.set(/\b(shows)\b/.test(url) ? 'series' : 'movie');

      this.restoreActiveAndScroll();

      ///  clear filters when switching kind  \\\
      this.selectedGenres.set(new Set());
      this.selectedRateds.set(new Set());
      this.searchInput.set('');
    };

    setKindFromUrl();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(setKindFromUrl);

    ///  Clear any in-progress edit  \\\
    this.localStorageService.clearInformation('current-edit-movie');
    this.localStorageService.cleanTemporaryLocalStorages();

    console.log(this.filteredRatedFilms());
  }

  ngAfterViewInit() {
    const element = this.scrollBoxRef?.nativeElement;
    if (!element) return;

    element.addEventListener('scroll', () => this.saveScrollTop(), { passive: true });

    this.afterRender(() => this.scrollActiveIntoViewIfNeeded(true));
  }


  /// ---------------------------------------- Delete Functionality ----------------------------------------  \\\
  async onDelete(item: { postId?: string; id: string; media_type: 'movie'|'series' }) {
    try {
      // Uses the database RPC (delete_rating_cascade) via RatingsService.deleteRating().
      await this.ratingsService.deleteRating(item.id);

      // Remove from local state so the UI updates immediately.
      if (item.media_type === 'movie') {
        this.allRatedMovies.update(list => list.filter(r => r.id !== item.id));
      } else {
        this.allRatedSeries.update(list => list.filter(r => r.id !== item.id));
      }

      // If the deleted film was active, pick a new active film (or null).
      if (this.activeFilm?.id === item.id) {
        const next = this.filteredRatedFilms()[0] ?? null;
        this.activeFilm = next;
        this.saveActive(next?.id);
        this.afterRender(() => this.scrollActiveIntoViewIfNeeded(true));
      }
    } catch (err) {
      console.error('Failed to delete rating', err);
      alert('Could not delete this rating. Please try again.');
    }
  }

  openConfirm(item: RatedItem) {
    this.confirmTarget.set(item);
    this.confirmOpen.set(true);
  }
  closeConfirm() {
    this.confirmOpen.set(false);
    this.confirmTarget.set(null);
  }

  async confirmDelete() {
    const item = this.confirmTarget();
    if (!item) return;

    this.closeConfirm();
    await this.onDelete(item);
  }


  /// ---------------------------------------- Helpers ----------------------------------------  \\\
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }

  get isMovieCountOverTen(): boolean {
    return this.filteredRatedFilms.length >= 10;
  }

  ///  Returns true if film is specified type, false if not \\\
  get isMovie(): boolean { 
    return (this.activeFilm?.media_type ?? '').toLowerCase() === 'movie'; 
  }
  get isSeries(): boolean { 
    return (this.activeFilm?.media_type ?? '').toLowerCase() === 'series'; 
  }

  ///  Derived counts for Movie  \\\
  private parseRuntimeToMinutes(input: unknown): number {
    if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, input);

    const s = String(input ?? '').trim();

    if (!s || /^(n\/a|na|unknown)$/i.test(s)) return 0;

    ///  Range like "45–60 min" or "45-60m" -> use the upper bound  \\\
    const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);

    if (range) return Math.max(0, parseInt(range[2], 10) || 0);

    ///  "1 h 52 min", "1h52m", "2h", "130m"  \\\
    const hours = s.match(/(\d+)\s*h(?:ours?)?/i);
    const mins  = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);

    if (hours || mins) {
      const h = hours ? parseInt(hours[1], 10) : 0;
      const m = mins  ? parseInt(mins[1], 10)  : 0;
      return Math.max(0, h * 60 + m);
    }

    ///  Plain "112" or "112 min"  \\\
    const firstNum = s.match(/\d+/)?.[0];

    return Math.max(0, firstNum ? parseInt(firstNum, 10) : 0);
  }

  get runtimeMinutesRemainder(): number {
    return (this.activeFilm?.criteria as MovieCriteria).runtime % 60;
  }
  get minutesLabel(): string {
    const n = this.runtimeMinutesRemainder;

    if (!n) return 'N/A';

    return n === 1 ? 'Minute' : 'Minutes';
  }

  get runtimeHours(): number {
    return Math.floor((this.activeFilm?.criteria as MovieCriteria).runtime / 60);
  }
  get hoursLabel(): string {
    const n = this.runtimeHours;

    if (!n) return 'N/A';

    return n === 1 ? 'Hour' : 'Hours';
  }

  get seasonsLabel(): string {
    const n = (this.activeFilm?.criteria as SeriesCriteria).seasons;

    if (!n) return 'N/A';

    return n === 1 ? 'Season' : 'Seasons';
  }

  get episodesLabel(): string {
    const n = (this.activeFilm?.criteria as SeriesCriteria).episodes;

    if (!n) return 'N/A';

    return n === 1 ? 'Episode' : 'Episodes';
  }

  ///  Dynmaic counts for Movie/Series (Count 1: Hours/Seasons - Count 2: Minutes/Episodes)  \\\
  get count1Num(): number {
    return this.isMovie ? this.runtimeHours : (this.activeFilm?.criteria as SeriesCriteria).seasons;
  }
  get count1Label(): string {
    return this.isMovie ? this.hoursLabel : this.seasonsLabel;
  }
  get count2Num(): number {
    return this.isMovie ? this.runtimeMinutesRemainder : (this.activeFilm?.criteria as SeriesCriteria).episodes;
  }
  get count2Label(): string {
    return this.isMovie ?  this.minutesLabel : this.episodesLabel;
  }

  onRatedFilmClicked(film: RatedItem) {
    this.activeFilm = film;
    this.useFallback = false;

    this.saveActive(film.id);
    this.saveScrollTop();
  }

  onEdit(film: RatedItem) {
    this.saveActive(film.id);
    this.saveScrollTop();

    this.filmCache.setOriginal(film.id, film); // baseline snapshot
    this.filmCache.setDraft(film.id, film);
    this.routingService.navigateToEditFilm(film.media_type, film.id);
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.activeFilm?.poster_url;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }


  /// ---------------------------------------- Scroll to Active Film Functionality ----------------------------------------  \\\
  private scrollActiveIntoViewIfNeeded(center = false) {
    const id = this.activeFilm?.id;
    if (!id) return;

    const container = this.scrollBoxRef?.nativeElement;
    if (!container) return;

    const row = container.querySelector<HTMLElement>(`.rated-film[data-postid="${id}"]`);
    if (!row) return;

    const er = row.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const fullyVisible = er.top >= cr.top && er.bottom <= cr.bottom;

    if (fullyVisible) return;

    // Compute the desired scrollTop (center or nearest) using rects,
    // so it works regardless of offsetParent quirks.
    const currentTop = container.scrollTop;
    const deltaFromTop = er.top - cr.top; // distance of row from container's visible top
    let targetTop: number;

    if (center) {
      const centerOffset = (container.clientHeight - row.clientHeight) / 2;
      targetTop = currentTop + deltaFromTop - centerOffset;
    } else {
      const rowAbove = er.top < cr.top;
      const margin = 8;
      targetTop = rowAbove
        ? currentTop + deltaFromTop - margin // bring to top-ish
        : currentTop + (er.bottom - cr.bottom) + margin; // bring to bottom-ish
    }

    // Clamp target to bounds
    targetTop = Math.max(0, Math.min(targetTop, container.scrollHeight - container.clientHeight));

    this.smoothScrollTo(container, targetTop, this.SLOW_SCROLL_MS);
  }

  private readUIState(): FilmUIState {
    return (
      this.localStorageService.getInformation(this.UI_STATE_KEY) ?? {
        movie: {},
        series: {},
      }
    );
  }
  private writeUIState(next: FilmUIState) {
    this.localStorageService.setInformation(this.UI_STATE_KEY, next);
  }

  private saveActive(postId: string | undefined) {
    const kind = this.filmKind();
    const state = this.readUIState();
    state[kind].activePostId = postId;
    this.writeUIState(state);
  }

  private saveScrollTop() {
    const container = this.scrollBoxRef?.nativeElement;
    if (!container) return;

    const kind = this.filmKind();
    const state = this.readUIState();

    state[kind].scrollTop = container.scrollTop;
    this.writeUIState(state);
  }

  private restoreActiveAndScroll() {
    const kind = this.filmKind();
    const state = this.readUIState();
    const wantedId = state[kind].activePostId;
    const list = this.usersRatedList();

    // restore active item (fallback to first)
    const found = wantedId ? list.find(x => x.id === wantedId) : list[0];
    this.activeFilm = found ?? null;

    // restore scrollTop *after* DOM paints
    this.afterRender(() => {
      const container = this.scrollBoxRef?.nativeElement;
      if (!container) return;

      const st = state[kind].scrollTop;
      if (typeof st === 'number') {
        container.scrollTop = st;
        // also ensure the active row is visible (list may have re-sorted)
        this.afterRender(() => this.scrollActiveIntoViewIfNeeded());
      } else {
        this.scrollActiveIntoViewIfNeeded(true);
      }
    });
  }

  /** Call this whenever filters/sort/search change and the list is rederived */
  private ensureActiveStillValid() {
    const cur = this.activeFilm?.id;
    if (!cur) return;

    const exists = this.filteredRatedFilms().some(x => x.id === cur);
    if (!exists) {
      // If filtered out or deleted → pick first visible
      const first = this.filteredRatedFilms()[0] ?? null;
      this.activeFilm = first;
      this.saveActive(first?.id);
    }
  }

  private afterRender(fn: () => void) {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => setTimeout(fn, 0));
    });
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private easeInOutQuad(t: number) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private smoothScrollTo(container: HTMLElement, targetTop: number, duration = this.SLOW_SCROLL_MS) {
    if (this.prefersReducedMotion() || duration <= 0) {
      container.scrollTop = targetTop;
      return;
    }

    const startTop = container.scrollTop;
    const change = targetTop - startTop;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = this.easeInOutQuad(t);
      container.scrollTop = startTop + change * eased;
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }


  /// ---------------------------------------- Filtering Functionality ----------------------------------------  \\\
  private runtimeMinutesOf(movie: RatedItem): number {
    const direct = (movie.criteria as MovieCriteria).runtime
    if (Number.isFinite(direct)) return Math.max(0, Number(direct));

    const rt = (movie.criteria as MovieCriteria).runtime
    return this.parseRuntimeToMinutes(rt);
  }

  private dateValue(dateLike?: string): number {
    if (!dateLike) return 0;

    const ymd = dateLike.includes('T') ? dateLike.slice(0, 10) : dateLike;

    ///  YYYY-MM-DD -> y,m,d  \\\
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return 0;

    const [, y, mm, dd] = m;

    return Date.UTC(+y, +mm - 1, +dd);
  }

  public userGenres = computed(() => {
    const set = new Set<string>();

    for (const m of this.usersRatedList()) {
      const g = (m.genres ?? []) as any;

      if (Array.isArray(g)) {
        for (const x of g) if (x && typeof x === 'string') set.add(x.trim());

      } else if (typeof g === 'string' && g.trim()) {
        g.split(/[|,/•]+/).map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
      }
    }

    return ['All', ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  });

  toggleGenre(g: string) {
    const set = new Set(this.selectedGenres());
    set.has(g) ? set.delete(g) : set.add(g);
    this.selectedGenres.set(set);
  }

  public userRatedValues = computed(() => {
    const set = new Set<string>();

    for (const m of this.usersRatedList()) {
      const r = (m.rated ?? '').toString().trim();
      if (r) set.add(r);
    }

    const canonical = ['G','PG','PG-13','R','NC-17','TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA','Not Rated','Unrated'];
    const existing = Array.from(set);
    const ordered = canonical.filter(x => set.has(x)).concat(existing.filter(x => !canonical.includes(x)));

    return ['All', ...ordered];
  });

  public filteredRatedFilms = computed(() => {
    const query     = this.searchInput().trim().toLowerCase();
    const genres    = this.selectedGenres();
    const rateds    = this.selectedRateds();
    const key       = this.sortKey();
    const direction = this.sortDirection();
    const sign      = direction === 'asc' ? 1 : -1;

    let list = this.usersRatedList();

    if (query) list = list.filter(m => m.title?.toLowerCase().includes(query));

    ///  Genre multi-filter (empty set = All)  \\\
    if (genres.size) {
      list = list.filter(m => {
        const g = (m.genres ?? []) as any;
        const movieGenres = Array.isArray(g) ? g.map((x:any)=>String(x).trim().toLowerCase())
          : typeof g === 'string' ? g.split(/[|,/•]+/).map((s:string)=>s.trim().toLowerCase())
          : [];

        for (const sel of genres) if (movieGenres.includes(sel.toLowerCase())) return true;

        return false;
      });
    }

    ///  Rated multi-filter (empty set = All)  \\\
    if (rateds.size) {
      list = list.filter(m => rateds.has(String(m.rated ?? '').trim()));
    }

    const sorted = [...list].sort((a, b) => {
      let av = 0, bv = 0;

      switch (key) {
        case 'rating':    av = a.rating ?? 0;                 bv = b.rating ?? 0;                 break;
        case 'runtime':   av = this.runtimeMinutesOf(a);      bv = this.runtimeMinutesOf(b);      break;
        case 'dateRated': av = this.dateValue(a.date_rated);  bv = this.dateValue(b.date_rated);   break;
        case 'title':     return sign * a.title.localeCompare(b.title);
      }

      return sign * (av - bv);
    });

    queueMicrotask(() => {
      this.ensureActiveStillValid();
      this.afterRender(() => this.scrollActiveIntoViewIfNeeded());
    });

    return sorted;
  });

  toggleRated(r: string) {
    const set = new Set(this.selectedRateds());
    set.has(r) ? set.delete(r) : set.add(r);
    this.selectedRateds.set(set);
  }
  
  toggleFilters() { 
    this.filtersOpen.update(v => !v); 
  }

  setSort(key: SortKey) { 
    this.sortKey.set(key); 
  }

  setDirection(d: 'asc'|'desc') { 
    this.sortDirection.set(d); 
  }

  toggleGenresOpen() {
    this.filtersOpen.set(true);
    this.genresOpen.set(!this.genresOpen());
    if (this.genresOpen()) this.ratedOpen.set(false);
  }
  setGenre(g: string) { 
    this.selectedGenre.set(g); 
  }
  clearGenres() { 
    this.selectedGenres.set(new Set()); 
  }

  toggleRatedOpen() {
    this.filtersOpen.set(true);
    this.ratedOpen.set(!this.ratedOpen());
    if (this.ratedOpen()) this.genresOpen.set(false);
  }
  setRated(v: string) { 
    this.selectedRated.set(v); 
  }
  clearRateds() { 
    this.selectedRateds.set(new Set()); 
  }


  /// ---------- Clsoe filter lists if click outside or Esc ---------- \\\
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const host = this.elementRef.nativeElement as HTMLElement;

    // Only keep the panel open if the click is inside the search "input-box"
    const inputBox = host.querySelector('.input-box');
    const target = event.target as Node;

    if (!inputBox || !inputBox.contains(target)) {
      this.filtersOpen.set(false);
      this.genresOpen.set(false);
      this.ratedOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirmOpen()) {
      this.closeConfirm();
      return;
    }

    this.filtersOpen.set(false);
    this.genresOpen.set(false);
    this.ratedOpen.set(false);
  }


  /// ---------------------------------------- Responsive Sidebar ----------------------------------------  \\\
  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.sidebarService.applySidebarByWidth(width);
  }


  /// ---------------------------------------- Formatting ----------------------------------------  \\\
  ///  input: '2009-12-18' -> 'December 18, 2009'  \\\
  formatLongDate(dateLike?: string): string {
    if (!dateLike) return '';

    // If it's a full ISO string, keep only the date part
    const ymd = dateLike.includes('T') ? dateLike.slice(0, 10) : dateLike;

    // Strictly parse YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return ymd; // fallback (don’t crash)

    const [, year, month, day] = match;

    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];

    const monthName = months[parseInt(month, 10) - 1];
    const dayNum = parseInt(day, 10);

    return `${monthName} ${dayNum}, ${year}`;
  }

  ///  Format runtime (123 minutes → 2 HR 3 MIN)   \\\
  fixRuntime(runtime?: number) {
    const r = runtime ?? 0;
    const hours = Math.floor(r / 60);
    const minutes = r - hours * 60;

    if (!hours && !minutes) return 'N/A';

    return `${hours} HR ${minutes} MIN`;
  }

  trackByPostId(index: number, item: { id: string }) { return item.id; }
}