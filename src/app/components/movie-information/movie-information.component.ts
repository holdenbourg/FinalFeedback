import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { CombinedFilmApiResponseModel } from '../../models/api-models/combined-film-api-response';
import { ApiService } from '../../services/api-service';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing-service';


@Component({
  selector: 'app-movie-information',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movie-information.component.html',
  styleUrls: ['./movie-information.component.css']
})
export class MovieInformationComponent implements OnInit {
  private apiService = inject(ApiService);
  private routingService = inject(RoutingService);
  private route = inject(ActivatedRoute);
  public localStorageService = inject(LocalStorageService);

  public imdbId = '';
  public loading = true;
  public error: string | null = null;

  public streamingServices: { name: string, logo: string }[] = [];

  readonly fallbackPoster = 'assets/images/no-poster.jpg';

  combinedApiResult: CombinedFilmApiResponseModel = {
    title: '',
    year: 0 as any,
    rated: '',
    released: '',
    runTime: 0,
    genre: '',
    director: '',
    writer: '',
    actors: '',
    plot: '',
    language: '',
    country: '',
    awards: '',
    poster: '',
    ratings: [],
    metascore: 0 as any,
    imdbRating: 0 as any,
    imdbVotes: 0 as any,
    imdbId: '',
    type: '',
    dvd: '',
    boxOffice: '',
    production: '',
    website: '',
    response: '',
    watch_providers: [],
    trailer: '',
    seasons: []
  };

  public streamingServiceLogos: Map<string, string> = new Map<string, string>([
    ['Netflix', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Netflix_2015_N_logo.svg/330px-Netflix_2015_N_logo.svg.png?20221130064001'],
    ['Disney Plus', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/800px-Disney%2B_logo.svg.png?20221217204017'],
    ['Max', 'https://play-lh.googleusercontent.com/1iyX7VdQ7MlM7iotI9XDtTwgiVmqFGzqwz10L67XVoyiTmJVoHX87QtqvcXgUnb0AC8'],
    ['Amazon Prime Video', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Amazon_Prime_Video_blue_logo_1.svg/640px-Amazon_Prime_Video_blue_logo_1.svg.png'],
    ['Paramount Plus', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/640px-Paramount_Plus.svg.png'],
    ['DIRECTV', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/2011_Directv_logo.svg/1280px-Directv_logo.svg.png'],
    ['Hulu', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Hulu_Japan_logo.svg/640px-Hulu_Japan_logo.svg.png'],
    ['Crunchyroll', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Crunchyroll_Logo.svg/640px-Crunchyroll_Logo.svg.png'],
    ['Adult Swim', 'https://variety.com/wp-content/uploads/2014/02/adult-swim1.jpg?crop=178px%2C100px%2C666px%2C371px&resize=1000%2C563'],
    ['Spectrum On Demand', 'https://ondemand.spectrum.net/images/spectrum-seo.png'],
    ['Funimation Now', 'https://www.pennlive.com/resizer/N1SXHzwQv-JKgqRv0t9zUKxSvLU=/1280x0/smart/cloudfront-us-east-1.images.arcpublishing.com/advancelocal/BKI5IVWMTJF3RFKUSHQ75STYZI.jpeg'],
    ['Cinemax Amazon Channel', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Cinemax_%28Yellow%29.svg/640px-Cinemax_%28Yellow%29.svg.png'],
    ['Boomerang', 'https://theme.zdassets.com/theme_assets/1479875/05def54c3c42b02ca64136ec40d361c1c0823a08.svg'],
    ['Hoopla', 'https://www.johnjermain.org/wp-content/uploads/2018/10/hoopla-logo-blue-black_for_blog.png'],
    ['Comedy Central', 'https://paramountshop.com/cdn/shop/files/CC-Mobile-min.png?v=1673463272'],
    ['fuboTV', 'https://images.axios.com/bx06TsOh1eCxRZvYQjakuph5hUo=/0x233:1280x953/1920x1080/2020/10/01/1601561561305.png'],
    ['Peacock Premium', 'https://photos5.appleinsider.com/gallery/55450-112618-headepeacock-xl.jpg'],
    ['Apple TV Plus', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/AppleTVLogo.svg/2048px-AppleTVLogo.svg.png'],
    ['Discovery', 'https://seeklogo.com/images/D/discovery-logo-853C219A76-seeklogo.com.png'],
    ['The Roku Channel', 'https://www.tvweek.com/wp-content/uploads/2015/09/roku.png']
  ]);

  ngOnInit() {
    // react if navigating within the component to a different imdbId
    this.route.paramMap.subscribe(async pm => {
      this.imdbId = pm.get('imdbId') ?? '';
      if (!this.imdbId) return;
      await this.loadMovie(this.imdbId);

      console.log(this.combinedApiResult);
      
    });
  }

  async loadMovie(id: string) {
    this.loading = true;
    this.error = null;
    this.streamingServices = [];

    try {
      const [omdbMovie, mdbMovie] = await Promise.all([
        this.apiService.getFilmOmdb(id),
        this.apiService.getMovieByImdb(id),
      ]);

      const combined: CombinedFilmApiResponseModel = {
        title: omdbMovie?.Title ?? '',
        year: omdbMovie?.Year ?? '',
        rated: omdbMovie?.Rated ?? '',
        released: omdbMovie?.Released ?? '',
        runTime: mdbMovie?.runtime ?? 0,
        genre: omdbMovie?.Genre ?? '',
        director: omdbMovie?.Director ?? '',
        writer: omdbMovie?.Writer ?? '',
        actors: omdbMovie?.Actors ?? '',
        plot: omdbMovie?.Plot ?? '',
        language: omdbMovie?.Language ?? '',
        country: omdbMovie?.Country ?? '',
        awards: omdbMovie?.Awards ?? '',
        poster: omdbMovie?.Poster ?? '',
        ratings: omdbMovie?.Ratings ?? [],
        metascore: omdbMovie?.Metascore ?? 'N/A',
        imdbRating: omdbMovie?.imdbRating ?? 'N/A',
        imdbVotes: omdbMovie?.imdbVotes ?? 'N/A',
        imdbId: omdbMovie?.imdbID ?? id,
        type: omdbMovie?.Type ?? 'movie',
        dvd: omdbMovie?.DVD ?? '',
        boxOffice: omdbMovie?.BoxOffice ?? '',
        production: omdbMovie?.Production ?? '',
        website: omdbMovie?.Website ?? '',
        response: omdbMovie?.Response ?? '',
        watch_providers: mdbMovie?.watch_providers ?? [],
        trailer: mdbMovie?.trailer ?? '',
        seasons: []
      };

      this.combinedApiResult = combined;

      // Map provider names to known logos (deduplicate)
      const seen = new Set<string>();
      
      this.streamingServices = (this.combinedApiResult.watch_providers ?? [])
        .map(p => p?.name?.trim())
        .filter((name): name is string => !!name && !seen.has(name))
        .map(name => {
          seen.add(name);
          const logo = this.streamingServiceLogos.get(name);
          return logo ? { name, logo } : null;   // skip unknown
        })
        .filter((x): x is { name: string; logo: string } => !!x);

    } catch (e: any) {
      console.error(e);
      this.error = 'Failed to load movie details.';

    } finally {
      this.loading = false;
    }
  }

  goToTrailer(trailerUrl: string) {
    if (!trailerUrl) return;
    window.open(trailerUrl, '_blank');
  }

  onRateThisFilm() {
    this.localStorageService.setInformation('currentRateMovie', this.combinedApiResult);
    this.routingService.navigateToRateMovie(this.combinedApiResult.imdbId);
  }

  getRatingValue(index: number): string {
    const r: any = this.combinedApiResult.ratings?.[index];
    return r?.Value ?? r?.value ?? 'N/A';
  }


  /// ---------------------------------------- Formatting ---------------------------------------- \\\
  get posterSrc(): string {
    const p = this.combinedApiResult?.poster;
    const hasPoster = !!p && p !== 'N/A';
    return hasPoster ? p as string : this.fallbackPoster;
  }

  fixFilmType(filmType: string) {
    if (!filmType) return '';
    return filmType.charAt(0).toUpperCase() + filmType.slice(1).toLowerCase();
  }

  fixRelease(releaseDate?: string) {
    if (!releaseDate || releaseDate === 'N/A') return 'N/A';
    // expects "18 Dec 2009"
    const day = releaseDate.substring(0, 2);
    let month = releaseDate.substring(3, 6);
    const year = releaseDate.substring(7);

    const map: Record<string, string> = {
      Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
      May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
      Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December'
    };
    month = map[month] ?? month;
    return `${month} ${day}, ${year}`;
  }

  /** Normalize a list of names like "A & B, C and D" → ["A","B","C","D"] */
  private splitNames(raw?: string): string[] {
    if (!raw) return [];
    return raw
      .replace(/\s*&\s*/g, ',')        // "&" → ","
      .replace(/\s+and\s+/gi, ',')     // " and " → ","
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  get directorName(): string {
    return (this.combinedApiResult.director || '').trim();
  }
  get writerNames(): string[] {
    return this.splitNames(this.combinedApiResult.writer);
  }

  /** If writer is N/A OR the single writer equals the director → show "Director/Writer" single row */
  get showDirWriterCombined(): boolean {
    const d = this.directorName;
    const w = this.writerNames;
    if (!d) return false;                         // no director -> can't combine
    if (w.length === 0) return true;              // writer N/A -> combine
    if (w.length === 1 && w[0].toLowerCase() === d.toLowerCase()) return true;
    return false;
  }

  /** Writers line text with proper punctuation: A, B, and C / A and B / A */
  formatWritersText(names: string[]): string {
    if (names.length <= 1) return names[0] ?? 'N/A';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

    /** Treat blanks and "N/A" as missing */
  isPresent(v?: string): boolean {
    const s = (v ?? '').trim();
    return !!s && s.toUpperCase() !== 'N/A';
  }

  /** Normalize a delimited list like "Drama, Comedy & Action / Adventure" → ["Drama","Comedy","Action","Adventure"] */
  private normalizeList(raw?: string): string[] {
    if (!this.isPresent(raw)) return [];
    return (raw as string)
      .replace(/[\/|]/g, ',')       // slashes & pipes -> commas
      .replace(/\s*&\s*/g, ',')     // ampersands -> commas
      .replace(/\s+and\s+/gi, ',')  // " and " -> comma
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  /** A, B, and C  /  A and B  /  A */
  private formatList(list: string[]): string {
    if (list.length <= 1) return list[0] ?? '';
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  /** Genres: returns null if nothing valid, else {label, text} with pluralization */
  get formattedGenres(): { label: 'Genre' | 'Genres'; text: string } | null {
    const list = this.normalizeList(this.combinedApiResult.genre);
    if (list.length === 0) return null;
    return {
      label: (list.length === 1) ? 'Genre' : 'Genres',
      text: this.formatList(list)
    };
  }

  fixBoxOffice(filmType?: string, boxOffice?: string) {
    if ((filmType ?? '').toLowerCase() === 'movie' && boxOffice) {
      return `Box Office: ${boxOffice}`;
    }
    return '';
  }

  fixRuntime(runtime?: number) {
    const r = runtime ?? 0;
    const hours = Math.floor(r / 60);
    const minutes = r - hours * 60;
    if (!hours && !minutes) return 'N/A';
    return `${hours} HR ${minutes} MIN`;
  }

  /** Build external rating URLs */
  get imdbUrl(): string | null {
    const id = this.combinedApiResult?.imdbId?.trim();
    return id ? `https://www.imdb.com/title/${id}/` : null;
  }

  get rottenTomatoesUrl(): string | null {
    const t = this.combinedApiResult?.title?.trim();
    if (!t) return null;
    return `https://www.rottentomatoes.com/m/${this.slugForRottenTomatoes(t)}`;
  }

  get metacriticUrl(): string | null {
    const t = this.combinedApiResult?.title?.trim();
    if (!t) return null;
    return `https://www.metacritic.com/movie/${this.slugForMetacritic(t)}/`;
  }

  /** RottenTomatoes uses underscores, lowercase, “&” → “and”, strip punctuation */
  private slugForRottenTomatoes(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’'":!?.,()]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  /** Metacritic uses hyphens, lowercase, “&” → “and”, strip punctuation */
  private slugForMetacritic(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’'":!?.,()]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  onLogoError(p: { name: string }) {
    this.streamingServices = this.streamingServices.filter(s => s.name !== p.name);
  }

  trackByProviderName = (_: number, p: { name: string }) => p.name;
}
