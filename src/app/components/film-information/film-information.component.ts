import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { CombinedFilmApiResponseModel } from '../../models/api-models/combined-film-api-response';
import { ApiService } from '../../services/api.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing.service';
import { FilmCacheService } from '../../services/film-cache.service';

@Component({
  selector: 'app-film-information',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './film-information.component.html',
  styleUrls: ['./film-information.component.css']
})

export class FilmInformationComponent implements OnInit {
  private apiService = inject(ApiService);
  private routingService = inject(RoutingService);
  private route = inject(ActivatedRoute);
  public localStorageService = inject(LocalStorageService);
  private filmCache = inject(FilmCacheService);

  public imdbId = '';
  public loading = true;
  public error: string | null = null;

  public streamingServices: { name: string; logo: string; url: string | null }[] = [];

  private useFallback = false;
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
    ['DIRECTV', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/2011_Directv_logo.svg/1280px-2011_Directv_logo.svg.png'],
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

  private streamingServiceUrls: Map<string, string | null> = new Map<string, string | null>([
    ['Netflix', 'https://www.netflix.com/'],
    ['Disney Plus', 'https://www.disneyplus.com/'],
    ['Max', 'https://www.max.com/'],
    ['Amazon Prime Video', 'https://www.primevideo.com/'],
    ['Paramount Plus', 'https://www.paramountplus.com/'],
    ['DIRECTV', 'https://www.directv.com/'],
    ['Hulu', 'https://www.hulu.com/'],
    ['Crunchyroll', 'https://www.crunchyroll.com/'],
    ['Adult Swim', 'https://www.adultswim.com/'],
    ['Spectrum On Demand', 'https://ondemand.spectrum.net/'],
    ['Funimation Now', 'https://www.funimation.com/'],
    ['Cinemax Amazon Channel', 'https://www.cinemax.com/'],
    ['Boomerang', 'https://www.boomerang.com/'],
    ['Hoopla', 'https://www.hoopladigital.com/'],
    ['Comedy Central', 'https://www.cc.com/'],
    ['fuboTV', 'https://www.fubo.tv/'],
    ['Peacock Premium', 'https://www.peacocktv.com/'],
    ['Apple TV Plus', 'https://tv.apple.com/'],
    ['Discovery', 'https://www.discovery.com/'],
    ['The Roku Channel', 'https://therokuchannel.roku.com/']
  ]);


  ngOnInit() {
    this.route.paramMap.subscribe(async pm => {
      this.imdbId = pm.get('imdbId') ?? '';
      if (!this.imdbId) return;
      await this.loadTitle(this.imdbId);
    });
  }


  ///  Loads the film information  \\\
  private async loadTitle(id: string) {
    this.loading = true;
    this.error = null;
    this.streamingServices = [];

    try {
      ///  1) OMDb call first so we know type (movie/series)  \\\
      const omdbMovie = await this.apiService.getFilmOmdb(id);

      ///  2) MDB: pick the right call for the type  \\\
      let mdb: any = null;

      const omdbType = (omdbMovie?.Type ?? '').toLowerCase();

      if (omdbType === 'series') {
        mdb = await this.apiService.getSeriesByImdb(id);
      } else {
        mdb = await this.apiService.getMovieByImdb(id);
      }

      const combined: CombinedFilmApiResponseModel = {
        title: omdbMovie?.Title ?? '',
        year: omdbMovie?.Year ?? '',
        rated: omdbMovie?.Rated ?? '',
        released: omdbMovie?.Released ?? '',
        runTime: mdb?.runtime ?? 0,
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
        watch_providers: mdb?.watch_providers ?? [],
        trailer: mdb?.trailer ?? '',
        seasons: mdb?.seasons ?? []
      };

      this.combinedApiResult = combined;

      ///  3) streaming services: use only known logos; attach optional homepage URL  \\\
      const seen = new Set<string>();
      this.streamingServices = (this.combinedApiResult.watch_providers ?? [])
        .map((p: any) => p?.name?.trim())
        .filter((name): name is string => !!name && !seen.has(name))
        .map(name => {
          seen.add(name);
          const logo = this.streamingServiceLogos.get(name);
          if (!logo) return null;
          const url = this.streamingServiceUrls.get(name) ?? null;
          return { name, logo, url };
        })
        .filter((x): x is { name: string; logo: string; url: string | null } => !!x);
        
    console.log(this.combinedApiResult);


    } catch (e: any) {
      console.error(e);
      this.error = 'Failed to load title details.';

    } finally {
      this.loading = false;
    }
  }


  /// ---------------------------------------- Helpers ----------------------------------------  \\\
  ///  Opens trailer in a new tab (if available)  \\\
  goToTrailer(trailerUrl: string) {
    if (!trailerUrl) return;
    window.open(trailerUrl, '_blank');
  }

  ///  Get the indiviudal rating from ratings list  \\\
  getRatingValue(index: number): string {
    const rating: any = this.combinedApiResult.ratings?.[index];

    return rating?.Value ?? rating?.value ?? 'N/A';
  }

  ///  Returns true if film is specified type, false if not \\\
  get isMovie(): boolean { 
    return (this.combinedApiResult?.type ?? '').toLowerCase() === 'movie'; 
  }
  get isSeries(): boolean { 
    return (this.combinedApiResult?.type ?? '').toLowerCase() === 'series'; 
  }

  ///  Parse the API date (e.g., "19 Dec 2025"), true if date is today or after today (only show button if movie is released)  \\\
  showButton(apiDateString: string): boolean {
    const apiDate = new Date(apiDateString);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return apiDate <= today;
  }

  ///  Store the current film-information in the cache then route to rate-film  \\\
  onRateThisFilm() {
    const film = this.combinedApiResult as CombinedFilmApiResponseModel | null;
    if (!film) return;

    const imdbId =
      (film as any).imdbId ??
      (film as any).imdbID ??
      (film as any).id ??
      '';
    if (!imdbId) {
      console.warn('onRateThisFilm(): missing imdbId');
      return;
    }

    const rawType = String((film as any).type ?? (film as any).Type ?? '').toLowerCase();
    const type: 'movie' | 'series' = rawType === 'movie' ? 'movie' : 'series';

    this.filmCache.set(imdbId, film);

    if (type === 'movie') this.routingService.navigateToRateMovie(imdbId, film);
    else this.routingService.navigateToRateSeries(imdbId, film);
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.combinedApiResult?.poster;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  ///  Derived counts for Series  \\\
  get totalSeasons(): number {
    const list = this.combinedApiResult?.seasons ?? [];
    const fromList = list.filter(s => (s?.episode_count ?? 0) > 0).length;

    return fromList;
  }
  get seasonsLabel(): string {
    if (!this.isSeries) return 'N/A';

    const n = this.totalSeasons;

    if (!n) return 'N/A';

    return n === 1 ? 'Season' : 'Seasons';
  }

  get totalEpisodes(): number {
    const list = this.combinedApiResult?.seasons ?? [];

    return list.reduce((acc, s: any) => acc + (s?.episode_count ?? 0), 0);
  }
  get episodesLabel(): string {
    if (!this.isSeries) return 'N/A';

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
      (this.combinedApiResult as any)?.runTime ??
      (this.combinedApiResult as any)?.runtimeMinutes ??
      (this.combinedApiResult as any)?.runtime_min ??
      null;

    if (Number.isFinite(nLike)) return Math.max(0, Number(nLike));

    const rt = (this.combinedApiResult as any)?.runtime ?? (this.combinedApiResult as any)?.Runtime ?? '';

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

  ///  Dynmaic counts for Movie/Series (Count 1: Hours/Seasons - Count 2: Minutes/Episodes)  \\\
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
    return this.isMovie ? 'Minutes' : this.episodesLabel;
  }


  /// ---------------------------------------- Formatting ----------------------------------------  \\\
  ///  Change film type (movie → Movie)  \\\
  fixFilmType(filmType: string) {
    if (!filmType) return '';

    return filmType.charAt(0).toUpperCase() + filmType.slice(1).toLowerCase();
  }

  ///  Change release date from "DD MM YYYY" → "Month DD, YYYY"  \\\
  fixRelease(releaseDate?: string) {
    if (!releaseDate || releaseDate === 'N/A') return 'N/A';

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

  ///  Get director's name  \\\
  get directorName(): string {
    return (this.combinedApiResult.director || '').trim();
  }

  ///  Get writer(s) name(s)  \\\
  get writerNames(): string[] {
    return this.splitNames(this.combinedApiResult.writer);
  }

  ///  split the name for later formatting  \\\
  private splitNames(raw?: string): string[] {
    if (!raw) return [];

    return raw
      .replace(/\s*&\s*/g, ',')
      .replace(/\s+and\s+/gi, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  ///  If directror and writer(s) are the same change to Director/Writer  \\\
  get showDirWriterCombined(): boolean {
    const d = this.directorName;
    const w = this.writerNames;

    if (!d) return false;

    if (w.length === 0) return true;

    if (w.length === 1 && w[0].toLowerCase() === d.toLowerCase()) return true;

    return false;
  }

  ///  Format the writer(s) properly (writer or writer and writer or writer, writer, and writer)  \\\
  formatWritersText(names: string[]): string {
    if (names.length <= 1) return names[0] ?? 'N/A';

    if (names.length === 2) return `${names[0]} and ${names[1]}`;

    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  ///  Return formatted genre(s) (genre or genre and genre or genre, genre, and genre)  \\\
  get formattedGenres(): { label: 'Genre' | 'Genres'; text: string } | null {
    const list = this.normalizeList(this.combinedApiResult.genre);

    if (list.length === 0) return null;

    return { label: list.length === 1 ? 'Genre' : 'Genres', text: this.formatList(list) };
  }

  ///  Return list of genres (if present)  \\\
  private normalizeList(raw?: string): string[] {
    if (!this.isPresent(raw)) return [];
    return (raw as string)
      .replace(/[\/|]/g, ',')
      .replace(/\s*&\s*/g, ',')
      .replace(/\s+and\s+/gi, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  ///  True if value is present, false if not or "N/A"  \\\
  isPresent(v?: string): boolean {
    const s = (v ?? '').trim();

    return !!s && s.toUpperCase() !== 'N/A';
  }

  ///  Format the genre(s) properly (genre or genre and genre or genre, genre, and genre)  \\\
  private formatList(list: string[]): string {
    if (list.length <= 1) return list[0] ?? '';

    if (list.length === 2) return `${list[0]} and ${list[1]}`;

    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  ///  Return box office (if present and a movie), return nothing if not or is a series  \\\
  fixBoxOffice(filmType?: string, boxOffice?: string) {
    if ((filmType ?? '').toLowerCase() === 'movie' && boxOffice) {
      return `Box Office: ${boxOffice}`;
    }
    return '';
  }

  ///  Format runtime (123 minutes → 2 HR 3 MIN)   \\\
  fixRuntime(runtime?: number) {
    const r = runtime ?? 0;
    const hours = Math.floor(r / 60);
    const minutes = r - hours * 60;
    if (!hours && !minutes) return 'N/A';
    return `${hours} HR ${minutes} MIN`;
  }

  ///  Rating sites URLs  \\\
  get imdbUrl(): string | null {
    const id = this.combinedApiResult?.imdbId?.trim();

    return id ? `https://www.imdb.com/title/${id}/` : null;
  }
  get rottenTomatoesUrl(): string | null {
    const t = this.combinedApiResult?.title?.trim();
    if (!t) return null;

    const segment = this.isTvLike ? 'tv' : 'm';
    const slug = this.slugForRottenTomatoes(t);

    return `https://www.rottentomatoes.com/${segment}/${slug}`;
  }
  get metacriticUrl(): string | null {
    const t = this.combinedApiResult?.title?.trim();
    if (!t) return null;

    const segment = this.isTvLike ? 'tv' : 'movie';
    const slug = this.slugForMetacritic(t);

    return `https://www.metacritic.com/${segment}/${slug}/`;
  }

  ///  Format title for use in URLs  \\\
  private slugForRottenTomatoes(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’'":!?.,()]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }
  private slugForMetacritic(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’'":!?.,()]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  ///  True if film is series, false if movie
  private get isTvLike(): boolean {
    const t = (this.combinedApiResult.type || '').toLowerCase();
    return t === 'series' || t === 'episode';
  }

  ///  If streaming service logo fails to load remove it from the list  \\\
  onLogoError(p: { name: string }) {
    this.streamingServices = this.streamingServices.filter(s => s.name !== p.name);
  }

  trackByProviderName = (_: number, p: { name: string }) => p.name;
}