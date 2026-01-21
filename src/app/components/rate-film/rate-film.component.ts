import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { FilmCacheService } from '../../services/film-cache.service';
import { RoutingService } from '../../services/routing.service';
import { RateItemComponent, RatingCriterion } from '../templates/rate-item/rate-item.component';
import { UsersService } from '../../services/users.service';
import { CombinedFilmApiResponseModel } from '../../models/api-models/combined-film-api-response.model';
import { FilmData } from '../../models/helper-models/film-data.model';
import { MovieCriteria, SeriesCriteria } from '../../services/ratings.service';
import { MovieDetailsPageModel } from '../../models/api-models/movie-details-page.model';
import { TvSeriesDetailsPageModel } from '../../models/api-models/tv-series-details-page.model';

@Component({
  selector: 'app-rate-film',
  standalone: true,
  imports: [CommonModule, RateItemComponent],
  templateUrl: './rate-film.component.html',
  styleUrl: './rate-film.component.css'
})

export class RateFilmComponent implements OnInit {
  private apiService = inject(ApiService);
  private activatedRoute = inject(ActivatedRoute);
  private routingService = inject(RoutingService);
  private filmCache = inject(FilmCacheService);
  private usersService = inject(UsersService);
  private router = inject(Router);

  imdbId = '';
  type = '';
  film: MovieDetailsPageModel| TvSeriesDetailsPageModel | null = null;
  activeMovie: MovieDetailsPageModel | null = null;
  activeSeries: TvSeriesDetailsPageModel | null = null;

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';

  ///  Rating Criteria  \\\
  private seriesCriteria: RatingCriterion[] = [
    { key: 'acting',  label: 'Acting',  explanation: 'How would you rate the level of acting throughout this series?' },
    { key: 'visuals', label: 'Visuals', explanation: 'How captivating were the visuals this series offered?' },
    { key: 'story',   label: 'Story',   explanation: 'How well written was the story this series told?' },
    { key: 'pacing',  label: 'Pacing',  explanation: 'How did the pacing feel throughout this series?' },
    { key: 'length',  label: 'Length',  explanation: 'How would you rate this series length? Did it feel too long?' },
    { key: 'ending',  label: 'Ending',  explanation: 'How impactful was the ending to this story? Were you satisfied?' },
  ];
  private movieCriteria: RatingCriterion[] = [
    { key: 'acting',  label: 'Acting',  explanation: 'How would you rate the level of acting in this movie?' },
    { key: 'visuals', label: 'Visuals', explanation: 'How captivating were the visuals this movie offered?' },
    { key: 'story',   label: 'Story',   explanation: 'How well written was the story this movie told?' },
    { key: 'pacing',  label: 'Pacing',  explanation: 'How did the pacing feel throughout this movie?' },
    { key: 'climax',  label: 'Climax',  explanation: 'How well did the climax aid the story?' },
    { key: 'ending',  label: 'Ending',  explanation: 'How impactful was the ending to this story?' },
  ];

  async ngOnInit(): Promise<void> {
    this.imdbId = this.activatedRoute.snapshot.params['imdbId'];
    this.type = this.activatedRoute.snapshot.params['type'];

    if (this.type === 'movie') {
      const cached = this.filmCache.getApiCache<MovieDetailsPageModel>(this.imdbId);
      if (cached) {
        this.film = cached;
        this.activeMovie = cached;

        console.log(cached);
        

        return;
      }
    } else {
      const cached = this.filmCache.getApiCache<TvSeriesDetailsPageModel>(this.imdbId);
      if (cached) {
        this.film = cached;
        this.activeSeries = cached;

        return;
      }
    }

  }


  /// -======================================-  Rate Functionality  -======================================- \\\
  async onRated(result: { average: number; criteria: Record<string, number> }) {
    if (!this.film) return;

    const userId = await this.usersService.getCurrentUserId();
    if (!userId) {
      console.error('No user logged in');
      this.routingService.navigateToHome();
      return;
    }

    const todayISO = new Date().toISOString();

    // Build complete criteria using existing RatingModel types
    let completeCriteria: MovieCriteria | SeriesCriteria;

    if (this.isMovie) {
      // MovieCriteria: acting, visuals, story, pacing, ending, climax, runtime
      completeCriteria = {
        acting: result.criteria['acting'],
        visuals: result.criteria['visuals'],
        story: result.criteria['story'],
        pacing: result.criteria['pacing'],
        ending: result.criteria['ending'],
        climax: result.criteria['climax'],
        runtime: this.runtimeMinutes  // Add runtime for database
      } as MovieCriteria;
    } else {
      // SeriesCriteria: acting, visuals, story, pacing, ending, length, seasons, episodes
      completeCriteria = {
        acting: result.criteria['acting'],
        visuals: result.criteria['visuals'],
        story: result.criteria['story'],
        pacing: result.criteria['pacing'],
        ending: result.criteria['ending'],
        length: result.criteria['length'],
        seasons: this.totalSeasons,   // Add seasons for database
        episodes: this.totalEpisodes  // Add episodes for database
      } as SeriesCriteria;
    }

    // Extract genres from API data
    const genresArray = this.extractGenres();
    const title = this.isMovie ? this.activeMovie!.title : this.activeSeries!.name;
    const releaseDate = this.isMovie ? this.activeMovie!.release_date : this.activeSeries!.first_air_date;

    // Prepare complete film data for post-film component
    const filmData: FilmData = {
      imdbId: this.imdbId,
      title: title,
      poster: this.film.poster_path,
      type: this.isMovie ? 'movie' : 'series',
      criteria: completeCriteria,
      rating: result.average,
      dateRated: todayISO,
      releaseDate: releaseDate,
      rated: this.film.rated || null,
      genres: genresArray
    };

    // Save to sessionStorage (survives refresh)
    sessionStorage.setItem('currentFilmRating', JSON.stringify(filmData));

    // Navigate to unified post-film route
    const filmType = this.isMovie ? 'movie' : 'series';
    this.router.navigate(['/post', filmType]);
  }


  /// -======================================-  Helper Methods  -======================================- \\\

  private extractGenres(): string[] {
    const genres = this.film?.genres;

    if (!genres) {
      return [];
    }

    return genres.map((genre) => genre.name);
  }
  
  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  // ✅ Get high-quality poster (w500 or original)
  get posterSrc(): string {
    if (this.type === 'movie') {
      if (!this.activeMovie?.poster_path) {
        return 'assets/images/no-poster.png';
      }

      return `${this.tmdbImgBase}/original${this.activeMovie.poster_path}`;
    } else {
      if (!this.activeSeries?.poster_path) {
        return 'assets/images/no-poster.png';
      }

      return `${this.tmdbImgBase}/original${this.activeSeries.poster_path}`;
    }
    
    // Use w500 for good balance of quality and load time
    // Can also use 'w780' or 'original' for even higher quality
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  ///  Returns true if film is specified type, false if not \\\
  get isMovie(): boolean { 
    return (this.type ?? '').toLowerCase() === 'movie'; 
  }

  ///  Dynamic title for rating criteria  \\\
  get titleText(): string {
    return this.isMovie ? 'Rate the movie on the following aspects' : 'Rate the series on the following aspects';
  }

  ///  Dynamic criteria for rating (movie vs series)  \\\
  get criteria(): RatingCriterion[] {
    return this.isMovie ? this.movieCriteria : this.seriesCriteria;
  }

  ///  Derived counts for Series  \\\
  get totalSeasons(): number {
    const list = this.activeSeries?.seasons ?? [];
    const fromList = list.filter(s => (s?.episode_count ?? 0) > 0).length;

    return fromList;
  }
  get seasonsLabel(): string {
    if (this.isMovie) return 'N/A';

    const n = this.totalSeasons;

    if (!n) return 'N/A';

    return n === 1 ? 'Season' : 'Seasons';
  }

  get totalEpisodes(): number {
    const list = this.activeSeries?.seasons ?? [];

    return list.reduce((acc, s: any) => acc + (s?.episode_count ?? 0), 0);
  }
  get episodesLabel(): string {
    if (this.isMovie) return 'N/A';

    const n = this.totalEpisodes;

    if (!n) return 'N/A';

    return n === 1 ? 'Episode' : 'Episodes';
  }

  ///  Derived counts for Movie  \\\
  get runtimeHours(): number {
    return Math.floor(this.runtimeMinutes / 60);
  }
  get hoursLabel(): string {
    if (!this.isMovie) return 'N/A';

    const n = this.runtimeHours;

    if (!n) return 'N/A';

    return n === 1 ? 'Hour' : 'Hours';
  }

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
      (this.film as any)?.runTime ??
      (this.film as any)?.runtimeMinutes ??
      (this.film as any)?.runtime_min ??
      null;

    if (Number.isFinite(nLike)) return Math.max(0, Number(nLike));

    const rt = (this.film as any)?.runtime ?? (this.film as any)?.Runtime ?? '';

    return this.parseRuntimeToMinutes(rt);
  }
  get runtimeMinutesRemainder(): number {
    return this.runtimeMinutes % 60;
  }
  get minutesLabel(): string {
    if (!this.isMovie) return 'N/A';

    const n = this.runtimeMinutesRemainder;

    if (!n) return 'N/A';

    return n === 1 ? 'Minute' : 'Minutes';
  }

  ///  Dynamic counts for Movie/Series (Count 1: Hours/Seasons - Count 2: Minutes/Episodes)  \\\
  get count1Num(): number {
    return this.isMovie ? this.runtimeHours : this.totalSeasons;
  }
  get count1Label(): string {
    return this.isMovie ? this.hoursLabel : this.seasonsLabel;
  }
  get count2Num(): number {
    return this.isMovie ? this.runtimeMinutesRemainder : this.totalEpisodes;
  }
  get count2Label(): string {
    return this.isMovie ? this.minutesLabel : this.episodesLabel;
  }


  /// -======================================-  Formatting  -======================================- \\\
  formatReleaseDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';

    const parsed = typeof date === 'string' ? new Date(date) : date;

    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(parsed);
  }

  // ✅ Get genres as comma-separated string
  get genresText(): string {
    if (this.type === 'movie') {
      if (!this.activeMovie?.genres?.length) return 'N/A';
      return this.activeMovie.genres.map(g => g.name).join(', ');
    } else {
      if (!this.activeSeries?.genres?.length) return 'N/A';
      return this.activeSeries.genres.map(g => g.name).join(', ');
    }
  }
}