import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CombinedFilmApiResponseModel } from '../../models/api-models/combined-film-api-response';
import { AccountInformationModel } from '../../models/database-models/account-information-model';
import { RatedSeriesModel } from '../../models/database-models/rated-series-model';
import { RatedMovieModel } from '../../models/database-models/rated-movie-model'; // <-- make sure this path matches your project
import { ApiService } from '../../services/api.service';
import { FilmCacheService } from '../../services/film-cache.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing.service';
import { RateItemComponent, RatingCriterion, RateResult } from '../templates/rate-item/rate-item.component';

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
  private localStorageService = inject(LocalStorageService);
  private routingService = inject(RoutingService);
  private filmCache = inject(FilmCacheService);
  private router = inject(Router);

  currentUser: AccountInformationModel = this.localStorageService.getInformation('currentUser');
  imdbId = '';
  film: CombinedFilmApiResponseModel | null = null;

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
    { key: 'climax',  label: 'Climax',  explanation: 'How well did the climax aid the story?' }, // <-- movie-only
    { key: 'ending',  label: 'Ending',  explanation: 'How impactful was the ending to this story?' },
  ];

  async ngOnInit(): Promise<void> {
    this.imdbId = this.activatedRoute.snapshot.params['imdbId'];

    ///  1) Try navigation state (no storage hop)  \\\
    const fromState = (this.router.getCurrentNavigation()?.extras?.state as any)?.film ?? (history.state?.film ?? null);
    if (fromState) {
      this.film = fromState;
      if (this.film) this.filmCache.set(this.imdbId, this.film);
      return;
    }

    ///  2) Try cache (refresh-safe)  \\\
    const cached = this.filmCache.get(this.imdbId);
    if (cached) {
      this.film = cached;
      return;
    }

    ///  3) Fallback to API  \\\
    this.film = await this.filmCache.getOrFetch(this.imdbId, () => this.apiService.getFilmOmdb(this.imdbId));
  }


  //!  CHANGE TO USE CACHE TO PASS THE RATING MOVIE/SERIES (LIKE YOU PASS IT TO THIS COMPONENT)  !\\
  onRated(result: RateResult) {
    if (!this.film) return;

    const f = this.film;
    const title    = f.title || '';
    const poster   = f.poster || '';
    const rated    = f.rated  || '';
    const released = f.released || '';
    const genres   = (f.genre || '').split(', ').filter(Boolean);

    if (this.isMovie) {
      const ratedMovie: RatedMovieModel = {
        postId: this.generateUniqueMoviePostId(),
        poster,
        title,
        releaseDate: this.alterReleaseForDatabase(released),
        rated,
        runTime: this.runtimeMinutes, // total minutes
        genres,

        acting:  result.criteria['acting'],
        visuals: result.criteria['visuals'],
        story:   result.criteria['story'],
        pacing:  result.criteria['pacing'],
        climax:  result.criteria['climax'],
        ending:  result.criteria['ending'],

        rating: result.average,
        username: this.currentUser.username,
        dateRated: new Date().toISOString(),
      };

      this.localStorageService.setInformation('currentPostMovie', ratedMovie);
      this.routingService.navigateToPostMovie(ratedMovie.postId);
      return;
    }

    // Series
    const ratedSeries: RatedSeriesModel = {
      postId: this.generateUniqueSeriesPostId(),
      poster,
      title,
      releaseDate: this.alterReleaseForDatabase(released),
      rated,
      seasons: this.totalSeasons,
      episodes: this.totalEpisodes,
      genres,

      acting:  result.criteria['acting'],
      visuals: result.criteria['visuals'],
      story:   result.criteria['story'],
      pacing:  result.criteria['pacing'],
      length:  result.criteria['length'],
      ending:  result.criteria['ending'],

      rating: result.average,
      username: this.currentUser.username,
      dateRated: new Date().toISOString(),
    };

    this.localStorageService.setInformation('currentPostSeries', ratedSeries);
    this.routingService.navigateToPostSeries(ratedSeries.postId);
  }


  /// ---------------------------------------- Helpers ----------------------------------------  \\\
  ///  Returns true if film is specified type, false if not \\\
  get isMovie(): boolean { 
    return (this.film?.type ?? '').toLowerCase() === 'movie'; 
  }
  get isSeries(): boolean { 
    return (this.film?.type ?? '').toLowerCase() === 'series'; 
  }

  ///  Dynamic title for rating criteris  \\\
  get titleText(): string {
    return this.isMovie ? 'Rate the movie on the following aspects' : 'Rate the series on the following aspects';
  }

  ///  Dynamic criteria for rating (movie vs series)  \\\
  get criteria(): RatingCriterion[] {
    return this.isMovie ? this.movieCriteria : this.seriesCriteria;
  }

  ///  Dynmaic counts for Movie/Series (Count 1: Hours/Seasons - Count 2: Minutes/Episodes)  \\\
  get count1Num(): number {
    return this.isMovie ? this.runtimeHours : this.totalSeasons;
  }
  get count1Label(): string {
    return this.isMovie ? 'Hours' : 'Seasons';
  }
  get count2Num(): number {
    return this.isMovie ? this.runtimeMinutesRemainder : this.totalEpisodes;
  }
  get count2Label(): string {
    return this.isMovie ? 'Minutes' : 'Episodes';
  }

  get totalSeasons(): number {
    const list = this.film?.seasons ?? [];
    return list.filter(season => (season?.episode_count ?? 0) > 0).length;
  }
  get totalEpisodes(): number {
    const list = this.film?.seasons ?? [];
    return list.reduce((acc, season: any) => acc + (season?.episode_count ?? 0), 0);
  }

  // ---------- Movie runtime helpers ----------
  private parseRuntimeToMinutes(input: unknown): number {
    if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, input);
    const s = String(input ?? '').trim();
    if (!s || /^(n\/a|na|unknown)$/i.test(s)) return 0;

    // Range like "45–60 min" or "45-60m" -> use the upper bound
    const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) return Math.max(0, parseInt(range[2], 10) || 0);

    // "1 h 52 min", "1h52m", "2h", "130m"
    const hours = s.match(/(\d+)\s*h(?:ours?)?/i);
    const mins  = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
    if (hours || mins) {
      const h = hours ? parseInt(hours[1], 10) : 0;
      const m = mins  ? parseInt(mins[1], 10)  : 0;
      return Math.max(0, h * 60 + m);
    }

    // Plain "112" or "112 min"
    const firstNum = s.match(/\d+/)?.[0];
    return Math.max(0, firstNum ? parseInt(firstNum, 10) : 0);
  }

  get runtimeMinutes(): number {
    // Prefer a numeric property if your model provides one
    const nLike =
      (this.film as any)?.runTime ??            // your field
      (this.film as any)?.runtimeMinutes ??     // alt naming
      (this.film as any)?.runtime_min ??        // another common variant
      null;

    if (Number.isFinite(nLike)) return Math.max(0, Number(nLike));

    // Fallback to strings like "112 min", "1 h 52 min", etc.
    const rt = (this.film as any)?.runtime ?? (this.film as any)?.Runtime ?? '';
    return this.parseRuntimeToMinutes(rt);
  }

  get runtimeHours(): number {
    return Math.floor(this.runtimeMinutes / 60);
  }

  get runtimeMinutesRemainder(): number {
    return this.runtimeMinutes % 60;
  }

  // ---------- IDs ----------
  generateUniqueSeriesPostId() {
    const allRated: RatedSeriesModel[] = this.localStorageService.getInformation('ratedSeries') ?? [];
    let id = 's' + Math.random().toString(16).slice(2);
    while (allRated.some(s => s.postId === id)) id = 's' + Math.random().toString(16).slice(2);
    return id;
  }
  generateUniqueMoviePostId() {
    const allRated: RatedMovieModel[] = this.localStorageService.getInformation('ratedMovies') ?? [];
    let id = 'm' + Math.random().toString(16).slice(2);
    while (allRated?.some?.(m => m.postId === id)) id = 'm' + Math.random().toString(16).slice(2);
    return id;
  }

  // ---------- Dates & display ----------
  alterReleaseForDatabase(releaseDate: string) {
    if (!releaseDate || releaseDate.length < 4) return releaseDate || '';
    // Handles "18 Dec 2009" or "2009" gracefully
    if (releaseDate.length >= 11) {
      const day = releaseDate.substring(0,2);
      let month = releaseDate.substring(3,6);
      const year = releaseDate.substring(7);
      const map: Record<string,string> = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
      month = map[month] ?? '01';
      return `${year}-${month}-${day}`;
    }
    return releaseDate; // keep as-is if it's only a year
  }

  fixRelease(releaseDate: string) {
    if (!releaseDate || releaseDate.length < 11) return releaseDate || '';
    const day = releaseDate.substring(0,2);
    let month = releaseDate.substring(3,6);
    const year = releaseDate.substring(7);
    const map: Record<string,string> = { Jan:'January', Feb:'February', Mar:'March', Apr:'April', May:'May', Jun:'June', Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December' };
    month = map[month] ?? month;
    return `${month} ${day}, ${year}`;
  }
}