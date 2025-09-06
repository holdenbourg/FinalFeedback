import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, signal, computed, HostListener } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AccountInformationModel } from "../../models/database-models/account-information-model";
import { CommentModel } from "../../models/database-models/comment-model";
import { RatedMovieModel } from "../../models/database-models/rated-movie-model";
import { RawAccountInformationModel } from "../../models/database-models/raw-account-information-model";
import { ReplyModel } from "../../models/database-models/reply-model";
import { LocalStorageService } from "../../services/local-storage.service";
import { RoutingService } from "../../services/routing.service";
import { RawPostModel } from "../../models/database-models/raw-post-model";
import { RatedFilmComponent } from "../templates/rated-film/rated-film.component";

type SortKey = 'rating' | 'runtime' | 'dateRated' | 'title';

@Component({
  selector: 'app-movies',
  standalone: true,
  imports: [CommonModule, FormsModule, RatedFilmComponent],
  templateUrl: './movies.component.html',
  styleUrls: ['./movies.component.css'],
})

export class MoviesComponent implements OnInit {
  readonly routingService = inject(RoutingService);
  public readonly localStorageService = inject(LocalStorageService);

  public currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user');

  readonly sidebarActive = signal(true);
  readonly searchInput = signal('');
  activeMovie: RatedMovieModel | null = null;

  readonly filtersOpen = signal(false);
  readonly genresOpen = signal(false);
  readonly ratedOpen  = signal(false);
  readonly sortKey = signal<SortKey>('dateRated');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly selectedGenre = signal<string>('All');
  readonly selectedGenres = signal<Set<string>>(new Set());
  readonly selectedRated = signal<string>('All');
  readonly selectedRateds = signal<Set<string>>(new Set());

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
  readonly fallbackPoster = 'assets/images/no-poster.jpg';

  private allRatedMovies = signal<RatedMovieModel[]>([]);

  public usersRatedMovies = computed(() =>
    this.allRatedMovies()
      .filter(movie => movie.username === this.currentUser.username)
      .sort((a, b) => b.rating - a.rating)
  );


  ngOnInit(): void {
    this.allRatedMovies.set(this.localStorageService.getInformation('rated-movies') ?? []);
    if (this.usersRatedMovies().length) {
      this.activeMovie = this.usersRatedMovies()[0];
    }

    ///  Clear any in-progress edit  \\\
    this.localStorageService.clearInformation('current-edit-movie');

    this.localStorageService.cleanTemporaryLocalStorages();
  }


  onDelete(movie: RatedMovieModel) {
    ///  1) Load databases  \\\
    const rawPosts: RawPostModel[] = this.localStorageService.getInformation('raw-posts') ?? [];
    const rawUsers: RawAccountInformationModel[] = this.localStorageService.getInformation('raw-users') ?? [];
    const comments: CommentModel[] = this.localStorageService.getInformation('comments') ?? [];
    const replies: ReplyModel[] = this.localStorageService.getInformation('replies') ?? [];
    const ratedMovies: RatedMovieModel[] = this.localStorageService.getInformation('rated-movies') ?? [];

    ///  2) Determine affected users from the post  \\\
    const currentPost = rawPosts.find(p => p.postId === movie.postId);
    const taggedUsernames = currentPost ? currentPost.taggedUsers.map(t => t.split('::::')[1]!).filter(Boolean) : [];
    const affectedUsernames = Array.from(new Set([...taggedUsernames, this.currentUser.username]));

    ///  3) Update rawUsers: remove postId from currentUser.postIds  \\\
    const updatedRawUsers: RawAccountInformationModel[] = rawUsers.map(u => {
      if (u.username === this.currentUser.username) {
        return {
          ...u,
          postIds: u.postIds.filter(id => id !== movie.postId),
        };
      }
      if (affectedUsernames.includes(u.username) && u.username !== this.currentUser.username) {
        return {
          ...u,
          taggedPostIds: u.taggedPostIds.filter(id => id !== movie.postId),
        };
      }
      return u;
    });

    ///  4) Update currentUser mirror  \\\
    const newCurrentUser: AccountInformationModel = {
      ...this.currentUser,
      postIds: this.currentUser.postIds.filter(id => id !== movie.postId),
    };

    ///  5) Remove movie + post + its comments + replies  \\\
    const newRatedMovies = ratedMovies.filter(m => m.postId !== movie.postId);
    const newRawPosts = rawPosts.filter(p => p.postId !== movie.postId);
    const newComments = comments.filter(c => c.postId !== movie.postId);
    const newReplies = replies.filter(r => r.postId !== movie.postId);

    ///  6) Persist all changes atomically-ish  \\\
    this.localStorageService.setInformation('current-user', newCurrentUser);
    this.localStorageService.setInformation('raw-users', updatedRawUsers);
    this.localStorageService.setInformation('rated-movies', newRatedMovies);
    this.localStorageService.setInformation('raw-posts', newRawPosts);
    this.localStorageService.setInformation('comments', newComments);
    this.localStorageService.setInformation('replies', newReplies);

    ///  7) Update local state without reloading the page  \\\
    this.currentUser = newCurrentUser;
    this.allRatedMovies.set(newRatedMovies);

    ///  Reset active selection if needed  \\\
    if (this.activeMovie?.postId === movie.postId) {
      this.activeMovie = this.usersRatedMovies()[0] ?? null;
    }
  }


  /// ---------------------------------------- Helpers ----------------------------------------  \\\
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
  get runtimeMinutes(): number {
    const nLike =
      (this.activeMovie as any)?.runTime ??
      (this.activeMovie as any)?.runtimeMinutes ??
      (this.activeMovie as any)?.runtime_min ??
      null;

    if (Number.isFinite(nLike)) return Math.max(0, Number(nLike));

    const rt = (this.activeMovie as any)?.runtime ?? (this.activeMovie as any)?.Runtime ?? '';

    return this.parseRuntimeToMinutes(rt);
  }
  get runtimeMinutesRemainder(): number {
    return this.runtimeMinutes % 60;
  }
  get minutesLabel(): string {
    const n = this.runtimeMinutesRemainder;

    if (!n) return 'N/A';

    return n === 1 ? 'Minute' : 'Minutes';
  }

  get runtimeHours(): number {
    return Math.floor(this.runtimeMinutes / 60);
  }
  get hoursLabel(): string {
    const n = this.runtimeHours;

    if (!n) return 'N/A';

    return n === 1 ? 'Hour' : 'Hours';
  }

  onRatedFilmClicked(movie: RatedMovieModel) {
    this.activeMovie = movie;

    this.useFallback = false;
  }

  //!  CHANGE TO USE CACHE TO PASS THE RATING MOVIE/SERIES (LIKE YOU PASS IT TO THIS COMPONENT)  !\\
  onEdit(movie: RatedMovieModel) {
    this.localStorageService.clearInformation('current-edit-movie');
    this.localStorageService.setInformation('current-edit-movie', movie);
    this.routingService.navigateToEditMovie();
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.activeMovie?.poster;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }


  /// ---------------------------------------- Filtering Functionality ----------------------------------------  \\\
  private runtimeMinutesOf(movie: RatedMovieModel): number {
    const direct =
      (movie as any)?.runTime ??
      (movie as any)?.runtimeMinutes ??
      (movie as any)?.runtime_min ??
      null;

    if (Number.isFinite(direct)) return Math.max(0, Number(direct));

    const rt = (movie as any)?.runtime ?? (movie as any)?.Runtime ?? '';
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

    for (const m of this.usersRatedMovies()) {
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

    for (const m of this.usersRatedMovies()) {
      const r = (m.rated ?? '').toString().trim();
      if (r) set.add(r);
    }

    const canonical = ['G','PG','PG-13','R','NC-17','TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA','Not Rated','Unrated'];
    const existing = Array.from(set);
    const ordered = canonical.filter(x => set.has(x)).concat(existing.filter(x => !canonical.includes(x)));

    return ['All', ...ordered];
  });

  public filteredRatedMovies = computed(() => {
    const query     = this.searchInput().trim().toLowerCase();
    const genres    = this.selectedGenres();   // Set<string>
    const rateds    = this.selectedRateds();   // Set<string>
    const key       = this.sortKey();
    const direction = this.sortDirection();
    const sign      = direction === 'asc' ? 1 : -1;

    let list = this.usersRatedMovies();

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

    return [...list].sort((a, b) => {
      let av = 0, bv = 0;
      switch (key) {
        case 'rating':    av = a.rating ?? 0;                 bv = b.rating ?? 0;                 break;
        case 'runtime':   av = this.runtimeMinutesOf(a);      bv = this.runtimeMinutesOf(b);      break;
        case 'dateRated': av = this.dateValue(a.dateRated);   bv = this.dateValue(b.dateRated);   break;
        case 'title':     return sign * a.title.localeCompare(b.title);
      }
      return sign * (av - bv);
    });
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
    this.genresOpen.update(v => !v); 
  }
  setGenre(g: string) { 
    this.selectedGenre.set(g); 
  }
  clearGenres() { 
    this.selectedGenres.set(new Set()); 
  }

  toggleRatedOpen()  { 
    this.ratedOpen.update(v => !v); 
  }
  setRated(v: string) { 
    this.selectedRated.set(v); 
  }
  clearRateds() { 
    this.selectedRateds.set(new Set()); 
  }


  /// ---------------------------------------- Responsive Sidebar ----------------------------------------  \\\
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

  trackByPostId(index: number, item: { postId: string }) { return item.postId; }
}
