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
  searchInput = '';
  activeMovie: RatedMovieModel | null = null;

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.jpg';

  private allRatedMovies = signal<RatedMovieModel[]>([]);

  public usersRatedMovies = computed(() =>
    this.allRatedMovies()
      .filter(m => m.username === this.currentUser.username)
      .sort((a, b) => b.rating - a.rating)
  );

  public filteredRatedMovies = computed(() => {
    const q = this.searchInput.trim().toLowerCase();
    if (!q) return this.usersRatedMovies();
    return this.usersRatedMovies().filter(m => m.title.toLowerCase().includes(q));
  });


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
  onRatedFilmClicked(movie: RatedMovieModel) {
    this.activeMovie = movie;
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
  formatLongDate(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
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
