import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { CombinedFilmApiResponseModel } from '../../models/api-models/combined-film-api-response';
import { ApiService } from '../../services/api-service';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing-service';

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

  public imdbId = '';
  public loading = true;
  public error: string | null = null;

  /** name/logo/url for streaming providers we already support */
  public streamingServices: { name: string; logo: string; url: string | null }[] = [];

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

  /** hard-coded deep links for provider home pages (optional; keep null to make them non-clickable) */
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

  /** movie vs series */
  get isSeries(): boolean {
    return (this.combinedApiResult.type || '').toLowerCase() === 'series';
  }

  /** derived counts for series */
  get totalSeasons(): number {
    const list = this.combinedApiResult.seasons ?? [];
    const fromList = list.filter(s => (s?.episode_count ?? 0) > 0).length;
    return fromList;
  }
  get totalEpisodes(): number {
    const list = this.combinedApiResult.seasons ?? [];
    return list.reduce((acc, s: any) => acc + (s?.episode_count ?? 0), 0);
  }
  get seasonsLabel(): string | null {
    if (!this.isSeries) return null;
    const n = this.totalSeasons;
    if (!n) return null;
    return n === 1 ? '1 Season' : `${n} Seasons`;
  }
  get episodesLabel(): string | null {
    if (!this.isSeries) return null;
    const n = this.totalEpisodes;
    if (!n) return null;
    return n === 1 ? '1 Episode' : `${n} Episodes`;
  }

  /** main loader, branches on OMDb type for MDB call */
  private async loadTitle(id: string) {
    this.loading = true;
    this.error = null;
    this.streamingServices = [];

    try {
      // 1) OMDb first so we know type (movie/series)
      const omdbMovie = await this.apiService.getFilmOmdb(id);

      // 2) MDB: pick the right call for the type
      let mdb: any = null;
      const omdbType = (omdbMovie?.Type ?? '').toLowerCase();

      if (omdbType === 'series') {
        // Replace with your real series call if you have one:
        // e.g. mdb = await this.apiService.getSeriesByImdb(id);
        // Using "any" to avoid TS errors if this method doesn't exist in typings.
        mdb = await (this.apiService as any).search1SeriesMdbStraight?.(id)
           ?? await this.apiService.getMovieByImdb(id); // fallback if your series method isn't available
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

      // 3) streaming services: use only known logos; attach optional homepage URL
      const seen = new Set<string>();
      this.streamingServices = (this.combinedApiResult.watch_providers ?? [])
        .map((p: any) => p?.name?.trim())
        .filter((name): name is string => !!name && !seen.has(name))
        .map(name => {
          seen.add(name);
          const logo = this.streamingServiceLogos.get(name);
          if (!logo) return null; // skip unknown
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

  goToTrailer(trailerUrl: string) {
    if (!trailerUrl) return;
    window.open(trailerUrl, '_blank');
  }

  onRateThisFilm() {
    // route based on type
    if (this.isSeries) {
      this.localStorageService.setInformation('currentRateSeries', this.combinedApiResult);
      this.routingService.navigateToRateSeries(this.combinedApiResult.imdbId);
    } else {
      this.localStorageService.setInformation('currentRateMovie', this.combinedApiResult);
      this.routingService.navigateToRateMovie(this.combinedApiResult.imdbId);
    }
  }

  getRatingValue(index: number): string {
    const r: any = this.combinedApiResult.ratings?.[index];
    return r?.Value ?? r?.value ?? 'N/A';
  }

  // ----------------------------- Formatting helpers (kept from your movie version) -----------------------------
  get posterSrc(): string {
    const p = this.combinedApiResult?.poster;
    const hasPoster = !!p && p !== 'N/A';
    return hasPoster ? (p as string) : this.fallbackPoster;
  }

  fixFilmType(filmType: string) {
    if (!filmType) return '';
    return filmType.charAt(0).toUpperCase() + filmType.slice(1).toLowerCase();
  }

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

  private splitNames(raw?: string): string[] {
    if (!raw) return [];
    return raw
      .replace(/\s*&\s*/g, ',')
      .replace(/\s+and\s+/gi, ',')
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

  get showDirWriterCombined(): boolean {
    const d = this.directorName;
    const w = this.writerNames;
    if (!d) return false;
    if (w.length === 0) return true; // writer N/A
    if (w.length === 1 && w[0].toLowerCase() === d.toLowerCase()) return true;
    return false;
  }

  formatWritersText(names: string[]): string {
    if (names.length <= 1) return names[0] ?? 'N/A';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  isPresent(v?: string): boolean {
    const s = (v ?? '').trim();
    return !!s && s.toUpperCase() !== 'N/A';
  }

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

  private formatList(list: string[]): string {
    if (list.length <= 1) return list[0] ?? '';
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  get formattedGenres(): { label: 'Genre' | 'Genres'; text: string } | null {
    const list = this.normalizeList(this.combinedApiResult.genre);
    if (list.length === 0) return null;
    return { label: list.length === 1 ? 'Genre' : 'Genres', text: this.formatList(list) };
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

  // External rating URLs
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

  private get isTvLike(): boolean {
    const t = (this.combinedApiResult.type || '').toLowerCase();
    return t === 'series' || t === 'episode';
  }

  onLogoError(p: { name: string }) {
    this.streamingServices = this.streamingServices.filter(s => s.name !== p.name);
  }

  trackByProviderName = (_: number, p: { name: string }) => p.name;
}