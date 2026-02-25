import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { emptyMovieDetailsPageModel, MovieDetailsPageModel } from '../../models/api-models/movie-details-page.model';
import { lastValueFrom } from 'rxjs';
import { CrewFilmComponent } from '../templates/crew-film/crew-film.component';
import { CastFilmComponent } from '../templates/cast-film/cast-film.component';
import { TvSeriesDetailsPageModel } from '../../models/api-models/tv-series-details-page.model';
import { RatingsService } from '../../services/ratings.service';
import { UserModel } from '../../models/database-models/user.model';
import { UsersService } from '../../services/users.service';
import { RoutingService } from '../../services/routing.service';
import { FilmCacheService } from '../../services/film-cache.service';

@Component({
    selector: 'app-details',
    imports: [CommonModule, CastFilmComponent, CrewFilmComponent],
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.css']
})

export class DetailsComponent implements OnInit {
  private apiService = inject(ApiService);
  private ratingsService = inject(RatingsService);
  private usersService = inject(UsersService);
  private routingService = inject(RoutingService);
  private activatedRoute = inject(ActivatedRoute);
  private filmCacheService = inject(FilmCacheService)

  public currentUser = signal<UserModel | null>(null);

  public type: string | null = null;
  // State
  loading = true;
  error: string | null = null;
  movieDetails: MovieDetailsPageModel | null = null;

  // Person details state
  personDetails: any | null = null;
  personCredits: any | null = null;
  activePersonTab: 'cast' | 'crew' = 'cast';

  // TV series details state
  tvSeriesDetails: TvSeriesDetailsPageModel | null = null;
  tvSeasonsMap: Map<number, any> = new Map(); // Map<season_number, TvSeasonDetailsResponseModel>

  hasAlreadyRated = signal<boolean>(false);
  isCheckingRating = signal<boolean>(true);

  readonly fallbackPoster = 'assets/images/no-poster.png';

  // ✅ Streaming service logo and URL maps
  public streamingServiceLogos: Map<string, string> = new Map<string, string>([
    ['Netflix', 'https://cdn.worldvectorlogo.com/logos/netflix-logo-icon.svg'],
    ['Disney Plus', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/800px-Disney%2B_logo.svg.png?20221217204017'],
    ['Max', 'https://play-lh.googleusercontent.com/1iyX7VdQ7MlM7iotI9XDtTwgiVmqFGzqwz10L67XVoyiTmJVoHX87QtqvcXgUnb0AC8'],
    ['Amazon Prime Video', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Amazon_Prime_Video_blue_logo_1.svg/640px-Amazon_Prime_Video_blue_logo_1.svg.png'],
    ['Paramount Plus Essential', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/640px-Paramount_Plus.svg.png'],
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
    ['Paramount Plus Essential', 'https://www.paramountplus.com/'],
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

  // ✅ Processed streaming services with logos and URLs
  streamingServices: { name: string; logo: string; url: string | null }[] = [];

  async ngOnInit() {
    // Set type immediately from snapshot so correct shimmer shows during loading
    this.type = this.activatedRoute.snapshot.paramMap.get('type');

    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);

    this.activatedRoute.paramMap.subscribe(async (params) => {
      this.type = params.get('type'); // 'movie' | 'tv' | 'person'
      const id = params.get('id'); // TMDb ID (as string)

      if (!id) {
        this.error = 'No ID provided';
        this.loading = false;
        return;
      }

      const tmdbId = parseInt(id, 10);

      if (this.type === 'movie') {
        await this.loadMovie(tmdbId);
        await this.checkIfAlreadyRated();

      } else if (this.type === 'tv') {
        await this.loadTvSeries(tmdbId);
        await this.checkIfAlreadyRated();

      } else if (this.type === 'person') {
        await this.loadPerson(tmdbId);
      }
    });
  }


  async loadMovie(tmdbId: number): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      console.log(`[Details] Loading movie with TMDb ID: ${tmdbId}`);

      // Step 1: Get TMDb movie details (includes imdb_id)
      const tmdbDetails = await lastValueFrom(
        this.apiService.getMovieDetailsTmdb(tmdbId)
      );

      console.log('[Details] TMDb details:', tmdbDetails);

      if (!tmdbDetails || !tmdbDetails.imdb_id) {
        throw new Error('Could not retrieve IMDb ID from TMDb');
      }

      const imdbId = tmdbDetails.imdb_id;
      console.log(`[Details] Found IMDb ID: ${imdbId}`);

      // Step 2: Parallel fetch OMDb + MDB data using the imdb_id
      const [omdbData, mdbData] = await Promise.all([
        this.apiService.getFilmOmdb(imdbId),
        this.apiService.getMovieByImdb(imdbId)
      ]);

      console.log('[Details] OMDb data:', omdbData);
      console.log('[Details] MDB data:', mdbData);

      // Step 3: Combine all data into MovieDetailsPageModel
      const combined: MovieDetailsPageModel = {
        // TMDb data
        backdrop_path: tmdbDetails.backdrop_path || '',
        id: tmdbDetails.id,
        media_type: 'movie',
        overview: tmdbDetails.overview || '',
        poster_path: tmdbDetails.poster_path || '',
        belongs_to_collection: tmdbDetails.belongs_to_collection,
        genres: tmdbDetails.genres || [],
        budget: tmdbDetails.budget || 0,
        homepage: tmdbDetails.homepage || '',
        imdb_id: tmdbDetails.imdb_id || '',
        production_companies: tmdbDetails.production_companies || [],
        production_countries: tmdbDetails.production_countries || [],
        release_date: tmdbDetails.release_date,
        revenue: tmdbDetails.revenue || 0,
        runtime: tmdbDetails.runtime || 0,
        spoken_languages: tmdbDetails.spoken_languages || [],
        tagline: tmdbDetails.tagline || '',
        title: tmdbDetails.title || '',
        vote_average: tmdbDetails.vote_average || 0,

        // OMDb data
        rated: omdbData?.Rated || 'N/A',
        director: omdbData?.Director || 'N/A',
        writer: omdbData?.Writer || 'N/A',
        awards: omdbData?.Awards || 'N/A',
        ratings: omdbData?.Ratings || [],

        // MDB data
        watch_providers: mdbData?.watch_providers || [],
        trailer: mdbData?.trailer || ''
      };

      this.movieDetails = combined;
      console.log('[Details] Combined movie details:', this.movieDetails);

      // ✅ Process streaming services: use only known logos; attach optional homepage URL
      this.processStreamingServices(combined.watch_providers);

    } catch (err: any) {
      console.error('[Details] Error loading movie:', err);
      this.error = err?.message || 'Failed to load movie details';
      this.movieDetails = emptyMovieDetailsPageModel(tmdbId);
    } finally {
      this.loading = false;
    }
  }

  // Process streaming services with deduplication and logo mapping
  private processStreamingServices(providers: any[]) {
    const seen = new Set<string>();
    const uniqueServices: { name: string; logo: string; url: string | null }[] = [];

    for (const p of providers) {
      // Extract and normalize name
      const name = p?.name?.trim();
      if (!name) continue;
      
      const normalizedName = name.toLowerCase();
      
      if (seen.has(normalizedName)) {
        console.log(`[Streaming] Skipping duplicate: "${name}"`);
        continue;
      }
      
      seen.add(normalizedName);
      
      // Only include if we have a logo
      const logo = this.streamingServiceLogos.get(name);
      if (!logo) {
        console.log(`[Streaming] No logo for: "${name}"`);
        continue;
      }
      
      const url = this.streamingServiceUrls.get(name) ?? null;
      uniqueServices.push({ name, logo, url });
    }

    this.streamingServices = uniqueServices;
    console.log(`[Streaming] Processed ${uniqueServices.length} services:`, uniqueServices);
  }

  get runtimeMinutesRemainder(): number {
    return this.movieDetails!.runtime % 60;
  }
  get minutesLabel(): string {
    const n = this.runtimeMinutesRemainder;
    if (!n) return 'N/A';

    return n === 1 ? 'Minute' : 'Minutes';
  }

  get runtimeHours(): number {
    return Math.floor(this.movieDetails!.runtime / 60);
  }
  get hoursLabel(): string {
    const n = this.runtimeHours;
    if (!n) return 'N/A';

    return n === 1 ? 'Hour' : 'Hours';
  }


  // ============================================
  // ✅ Load TV Series Details + All Seasons + OMDb + MDB
  // ============================================
  async loadTvSeries(tmdbId: number): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      console.log(`[Details] Loading TV series with TMDb ID: ${tmdbId}`);

      // Step 1: Get TV series details + external IDs (for imdb_id) in parallel
      const [tmdbSeriesDetails, externalIds] = await Promise.all([
        lastValueFrom(this.apiService.getTvSeriesDetailsTmdb(tmdbId)),
        lastValueFrom(this.apiService.getTvExternalIdsTmdb(tmdbId))
      ]);

      console.log('[Details] TMDb series details:', tmdbSeriesDetails);
      console.log('[Details] External IDs:', externalIds);

      if (!tmdbSeriesDetails) {
        throw new Error('Could not retrieve TV series details');
      }

      const imdbId = externalIds.imdb_id;
      if (!imdbId) {
        console.warn('[Details] No IMDb ID found for this series');
      }

      // Extract season numbers for parallel fetching
      const seasonNumbers = (tmdbSeriesDetails.seasons || [])
        .map(s => s.season_number)
        .filter(num => num >= 0); // Keep season 0 (specials) and all positive numbers

      console.log(`[Details] Found ${seasonNumbers.length} seasons:`, seasonNumbers);

      // Step 2: Fetch seasons + OMDb + MDB data in parallel
      const [seasonDetailsArray, omdbData, mdbData] = await Promise.all([
        // Fetch all seasons in parallel
        Promise.all(
          seasonNumbers.map(seasonNum =>
            lastValueFrom(
              this.apiService.getTvSeriesSeasonDetailsTmdb(tmdbId, seasonNum)
            )
          )
        ),
        // Fetch OMDb data (only if we have imdb_id)
        imdbId ? this.apiService.getFilmOmdb(imdbId) : Promise.resolve({} as any),
        // Fetch MDB data (only if we have imdb_id)
        imdbId ? this.apiService.getSeriesByImdb(imdbId) : Promise.resolve({} as any)
      ]);

      console.log('[Details] OMDb data:', omdbData);
      console.log('[Details] MDB data:', mdbData);

      // Step 3: Store seasons in Map for easy access
      this.tvSeasonsMap.clear();
      seasonDetailsArray.forEach(seasonDetails => {
        this.tvSeasonsMap.set(seasonDetails.season_number, seasonDetails);
        console.log(`[Details] Loaded season ${seasonDetails.season_number} with ${seasonDetails.episodes?.length || 0} episodes`);
      });

      // Step 4: Combine all data into TvSeriesDetailsPageModel
      const combined: TvSeriesDetailsPageModel = {
        // ✅ TMDb data
        imdb_id: externalIds.imdb_id || '',
        backdrop_path: tmdbSeriesDetails.backdrop_path || '',
        created_by: tmdbSeriesDetails.created_by || [],
        episode_run_time: tmdbSeriesDetails.episode_run_time,
        first_air_date: tmdbSeriesDetails.first_air_date,
        genres: tmdbSeriesDetails.genres || [],
        homepage: tmdbSeriesDetails.homepage || '',
        id: tmdbSeriesDetails.id,
        in_production: tmdbSeriesDetails.in_production,
        languages: tmdbSeriesDetails.languages || [],
        last_air_date: tmdbSeriesDetails.last_air_date,
        last_episode_to_air: tmdbSeriesDetails.last_episode_to_air,
        name: tmdbSeriesDetails.name || '',
        next_episode_to_air: tmdbSeriesDetails.next_episode_to_air,
        number_of_episodes: tmdbSeriesDetails.number_of_episodes || 0,
        number_of_seasons: tmdbSeriesDetails.number_of_seasons || 0,
        origin_country: tmdbSeriesDetails.origin_country || [],
        original_language: tmdbSeriesDetails.original_language || '',
        original_name: tmdbSeriesDetails.original_name || '',
        overview: tmdbSeriesDetails.overview || '',
        popularity: tmdbSeriesDetails.popularity || 0,
        poster_path: tmdbSeriesDetails.poster_path || '',
        production_companies: tmdbSeriesDetails.production_companies || [],
        production_countries: tmdbSeriesDetails.production_countries || [],
        seasons: tmdbSeriesDetails.seasons || [],
        spoken_languages: tmdbSeriesDetails.spoken_languages || [],
        status: tmdbSeriesDetails.status || '',
        tagline: tmdbSeriesDetails.tagline || '',
        type: tmdbSeriesDetails.type || '',
        vote_average: tmdbSeriesDetails.vote_average || 0,
        vote_count: tmdbSeriesDetails.vote_count || 0,

        // ✅ OMDb data
        boxOffice: +omdbData?.BoxOffice || 0,
        rated: omdbData?.Rated || 'N/A',
        director: omdbData?.Director || 'N/A',
        writer: omdbData?.Writer || 'N/A',
        awards: omdbData?.Awards || 'N/A',
        ratings: omdbData?.Ratings || [],

        // ✅ MDB data
        watch_providers: mdbData?.watch_providers || [],
        trailer: mdbData?.trailer || ''
      };

      this.tvSeriesDetails = combined;
      console.log('[Details] Combined TV series details:', this.tvSeriesDetails);
      console.log('[Details] Total seasons loaded:', this.tvSeasonsMap.size);

      // ✅ Process streaming services for display
      this.processStreamingServices(combined.watch_providers);

    } catch (err: any) {
      console.error('[Details] Error loading TV series:', err);
      this.error = err?.message || 'Failed to load TV series details';
      this.tvSeriesDetails = null;
      this.tvSeasonsMap.clear();
    } finally {
      this.loading = false;
    }
  }

  // ✅ Get all seasons as array (for iteration in template)
  get tvSeasonsArray(): any[] {
    return Array.from(this.tvSeasonsMap.values()).sort((a, b) => 
      a.season_number - b.season_number
    );
  }

  // ✅ Get specific season by number
  getTvSeason(seasonNumber: number): any | null {
    return this.tvSeasonsMap.get(seasonNumber) || null;
  }

  // ✅ Check if tabs should be shown
  get showPersonTabs(): boolean {
    const hasCast = this.personCredits?.cast && this.personCredits.cast.length > 0;
    const hasCrew = this.personCredits?.crew && this.personCredits.crew.length > 0;
    return hasCast || hasCrew;
  }

  // ✅ Get cast credits (sorted newest first, no-date items at bottom)
  get castCredits(): any[] {
    const credits = this.personCredits?.cast || [];
    return this.sortCreditsByDate(credits);
  }

  // ✅ Get crew credits (sorted newest first, no-date items at bottom)
  get crewCredits(): any[] {
    const credits = this.personCredits?.crew || [];
    return this.sortCreditsByDate(credits);
  }

  private sortCreditsByDate(credits: any[]): any[] {
    return [...credits].sort((a, b) => {
      const dateA = this.getCreditDate(a);
      const dateB = this.getCreditDate(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    });
  }

  private getCreditDate(credit: any): Date | null {
    const raw = credit.release_date || credit.first_air_date;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  get seasonsLabel(): string {
    const n = this.tvSeriesDetails?.number_of_seasons;
    if (!n) return 'N/A';

    return n === 1 ? 'Season' : 'Seasons';
  }

  get episodesLabel(): string {
    const n = this.tvSeriesDetails?.number_of_episodes;
    if (!n) return 'N/A';

    return n === 1 ? 'Episode' : 'Episodes';
  }


  // ============================================
  // ✅ Load Person Details
  // ============================================
  async loadPerson(tmdbId: number): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      console.log(`[Details] Loading person with TMDb ID: ${tmdbId}`);

      // Parallel fetch person details + combined credits
      const [details, credits] = await Promise.all([
        lastValueFrom(this.apiService.getPersonDetailsTmdb(tmdbId)),
        lastValueFrom(this.apiService.getPersonCombinedCreditsTmdb(tmdbId))
      ]);

      console.log('[Details] Person details:', details);
      console.log('[Details] Person credits:', credits);

      this.personDetails = details;
      this.personCredits = credits;

      // Set initial tab based on what's available
      if (credits.cast && credits.cast.length > 0) {
        this.activePersonTab = 'cast';
      } else if (credits.crew && credits.crew.length > 0) {
        this.activePersonTab = 'crew';
      } else {
        this.activePersonTab = 'cast';
      }

    } catch (err: any) {
      console.error('[Details] Error loading person:', err);
      this.error = err?.message || 'Failed to load person details';
      this.personDetails = null;
      this.personCredits = null;
    } finally {
      this.loading = false;
    }
  }

  // ✅ Switch person tab
  switchPersonTab(tab: 'cast' | 'crew') {
    this.activePersonTab = tab;
  }



  ///  Store the current film-information in the cache then route to rate-film  \\\
  onRateThisFilm() {
    let film: MovieDetailsPageModel | TvSeriesDetailsPageModel | null = null;
    let imdbId: string | null = null;

    if (this.type === 'movie') {
      film = this.movieDetails;
      imdbId = this.movieDetails!.imdb_id;
    } else {
      film = this.tvSeriesDetails;
      imdbId = this.tvSeriesDetails!.imdb_id;
    }

    if (!film) return;      
    if (!imdbId) {
      console.warn('onRateThisFilm(): missing imdbId');
      return;
    }

    this.filmCacheService.set(imdbId, film);

    if (this.type === 'movie') this.routingService.navigateToRateMovie(imdbId, film as MovieDetailsPageModel);
    else this.routingService.navigateToRateSeries(imdbId, film as TvSeriesDetailsPageModel);
  }

  // ============================================
  // Helper Methods for Details Component
  // ============================================

  // TMDb Image Base URL
  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  // ✅ Get high-quality poster (w500 or original)
  get posterSrc(): string {
    if (this.type === 'movie') {
      if (!this.movieDetails?.poster_path) {
        return 'assets/images/no-poster.png';
      }

      return `${this.tmdbImgBase}/w500${this.movieDetails.poster_path}`;
    } else {
      if (!this.tvSeriesDetails?.poster_path) {
        return 'assets/images/no-poster.png';
      }

      return `${this.tmdbImgBase}/w500${this.tvSeriesDetails.poster_path}`;
    }
    
    // Use w500 for good balance of quality and load time
    // Can also use 'w780' or 'original' for even higher quality
  }

  // ✅ Get backdrop image
  get backdropSrc(): string {
    if (!this.movieDetails?.backdrop_path) {
      return '';
    }
    return `${this.tmdbImgBase}/w1280${this.movieDetails.backdrop_path}`;
  }

  // ✅ Format release date
  formatReleaseDate(date: Date | null): string {
    if (!date) return 'N/A';
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  // ✅ Format runtime (e.g., "2h 34m")
  formatRuntime(minutes: number): string {
    if (!minutes) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  // ✅ Format budget/revenue (e.g., "$123.4M")
  formatCurrency(amount: number): string {
    if (!amount) return 'N/A';
    
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    return `$${amount.toLocaleString()}`;
  }

  // ✅ Get genres as comma-separated string
  get genresText(): string {
    if (this.type === 'movie') {
      if (!this.movieDetails?.genres?.length) return 'N/A';
      return this.movieDetails.genres.map(g => g.name).join(', ');
    } else {
      if (!this.tvSeriesDetails?.genres?.length) return 'N/A';
      return this.tvSeriesDetails.genres.map(g => g.name).join(', ');
    }
  }

  // ✅ Get director name (from OMDb)
  get directorName(): string {
    if (this.type === 'movie') {
      return this.movieDetails?.director || 'N/A';
    } else {
      return this.tvSeriesDetails?.director || 'N/A';
    }
  }

  // ✅ Get writer names (from OMDb)
  get writerNames(): string {
    if (this.type === 'movie') {
      return this.movieDetails?.writer || 'N/A';
    } else {
      return this.tvSeriesDetails?.writer || 'N/A';
    }  
  }

  // ✅ Get IMDb rating
  get imdbRating(): string {
    if (this.type === 'movie') {
      const rating: any = this.movieDetails?.ratings?.[0];

      return rating?.Value ?? rating?.value ?? 'N/A';
    } else {
      const rating: any = this.tvSeriesDetails?.ratings?.[0];

      return rating?.Value ?? rating?.value ?? 'N/A';
    }
  }

  // ✅ Get Rotten Tomatoes rating
  get rottenTomatoesRating(): string {
    if (this.type === 'movie') {
      const rating: any = this.movieDetails?.ratings?.[1];

      return rating?.Value ?? rating?.value ?? 'N/A';
    } else {
      const rating: any = this.tvSeriesDetails?.ratings?.[1];

      return rating?.Value ?? rating?.value ?? 'N/A';
    }
  }

  // ✅ Get Metacritic rating
  get metacriticRating(): string {
    if (this.type === 'movie') {
      const rating: any = this.movieDetails?.ratings?.[2];

      return rating?.Value ?? rating?.value ?? 'N/A';
    } else {
      const rating: any = this.tvSeriesDetails?.ratings?.[2];

      return rating?.Value ?? rating?.value ?? 'N/A';
    }
  }

  // ✅ Get streaming providers (already processed)
  get streamingProviders() {
    return this.streamingServices;
  }

  // ✅ Get trailer URL
  get trailerUrl(): string | null {
    if (this.type === 'movie') {
      return this.movieDetails?.trailer || null;
    } else {
      return this.tvSeriesDetails?.trailer || null;
    }
  }
  // ✅ Open trailer in new tab
  goToTrailer() {
    if (this.trailerUrl) {
      window.open(this.trailerUrl, '_blank');
    }
  }

  get homePageUrl(): string | null {
    if (this.type === 'movie') {
      return this.movieDetails?.homepage || null;
    } else {
      return this.tvSeriesDetails?.homepage || null;
    }  
  }
  goToHomePage() {
    if (this.homePageUrl) {
      window.open(this.homePageUrl, '_blank');
    }
  }

  // ✅ Fallback for poster error
  setFallback(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/no-poster.png';
  }

  // ✅ Format production companies
  get productionCompaniesText(): string {
    if (!this.movieDetails?.production_companies?.length) return 'N/A';
    return this.movieDetails.production_companies
      .map(c => c.name)
      .slice(0, 3) // Show first 3
      .join(', ');
  }

  // ✅ Check if movie is released (for rate button)
  get isReleased(): boolean {
    if (this.type === 'movie') {
      const releaseDate = this.movieDetails?.release_date;
      if (!releaseDate) return false;
      return new Date(releaseDate) <= new Date();
    } else {
      const releaseDate = this.tvSeriesDetails?.first_air_date;
      if (!releaseDate) return false;
      return new Date(releaseDate) <= new Date();
    }  
  }

  // Check if user has already rated this film
  async checkIfAlreadyRated() {
    const user = this.currentUser();
    let imdbId: string | null = null;

    if (this.type === 'movie') {
      imdbId = this.movieDetails!.imdb_id;
    } else {
      imdbId = this.tvSeriesDetails!.imdb_id;
    }

    console.log('THE IMDB ID' + imdbId);
    

    if (!user || !imdbId) {
      this.hasAlreadyRated.set(false);
      this.isCheckingRating.set(false);
      return;
    }

    this.isCheckingRating.set(true);

    try {
      const ratings = await this.ratingsService.getUserRatings(user.id);
      
      const alreadyRated = ratings.some(
        rating => rating.media_id === imdbId
      );
      
      this.hasAlreadyRated.set(alreadyRated);
      console.log('[FilmInfo] Already rated:', alreadyRated);
    } catch (err) {
      console.error('Error checking if rated:', err);
      this.hasAlreadyRated.set(false);
    } finally {
      this.isCheckingRating.set(false);
    }
  }

  // Computed for button disabled state
  canRateFilm = computed(() => {
    return !this.hasAlreadyRated() && !this.isCheckingRating();
  });

  // Computed for button title
  runtimeRateButtonTitle = computed(() => {
    if (this.isCheckingRating()) {
      return 'Checking...';
    }
    if (this.hasAlreadyRated()) {
      if (this.type === 'movie') {
        return `You've already rated "${this.movieDetails?.title}"`;
      } else {
        return `You've already rated "${this.tvSeriesDetails?.name}"`;
      }
    }
    return '';  // No title if they can rate
  });

  // ✅ Check if director and writer are the same person
  get showDirWriterCombined(): boolean {
    const dir = this.directorName;
    const writer = this.writerNames;
    
    if (dir === 'N/A' || writer === 'N/A') return false;
    
    // Simple check if they're the same
    return dir === writer;
  }

  ///  Rating sites URLs  \\\
  get imdbUrl(): string | null {
    if (this.type === 'movie') {
      const id = this.movieDetails?.imdb_id?.trim();

      return id ? `https://www.imdb.com/title/${id}/` : null;
    } else {
      const id = this.tvSeriesDetails?.imdb_id?.trim();

      return id ? `https://www.imdb.com/title/${id}/` : null;
    }  
  }

  get rottenTomatoesUrl(): string | null {
    if (this.type === 'movie') {
      const t = this.movieDetails?.title?.trim();
      if (!t) return null;

      const slug = this.slugForRottenTomatoes(t);

      return `https://www.rottentomatoes.com/m/${slug}`;
    } else {
      const t = this.tvSeriesDetails?.name?.trim();
      if (!t) return null;

      const slug = this.slugForRottenTomatoes(t);

      return `https://www.rottentomatoes.com/tv/${slug}`;;
    } 
  }
  private slugForRottenTomatoes(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[''":!?.,()]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  get metacriticUrl(): string | null {
    if (this.type === 'movie') {
      const t = this.movieDetails?.title?.trim();
      if (!t) return null;

      const slug = this.slugForMetacritic(t);

      return `https://www.metacritic.com/movie/${slug}/`;
    } else {
      const t = this.tvSeriesDetails?.name?.trim();
      if (!t) return null;

      const slug = this.slugForMetacritic(t);

      return `https://www.metacritic.com/tv/${slug}/`;
    } 

  }
  private slugForMetacritic(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[''":!?.,()]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  get TmdbUrl(): string | null {
    if (this.type === 'movie') {
      const t = this.movieDetails?.title?.trim();
      if (!t) return null;

      return `https://www.themoviedb.org/${this.type}/${this.movieDetails?.id}-${t}`;
    } else {
      const t = this.tvSeriesDetails?.name?.trim();
      if (!t) return null;

      return `https://www.themoviedb.org/${this.type}/${this.tvSeriesDetails?.id}-${t}`;
    } 


  }

  // ✅ TrackBy function for streaming providers
  trackByProviderName(index: number, provider: any): string {
    return provider.name || index;
  }

  // ✅ Handle logo error for streaming providers
  onLogoError(provider: any) {
    console.warn(`[Details] Failed to load logo for ${provider.name}`);
    // Could set a fallback logo here if needed
  }

  // ============================================
  // ✅ Person Helper Methods
  // ============================================

  // Get person profile image
  get personProfileSrc(): string {
    if (!this.personDetails?.profile_path) {
      return 'assets/images/no-poster.png';
    }
    return `${this.tmdbImgBase}/w500${this.personDetails.profile_path}`;
  }

  // Format person birthday
  formatBirthday(date: Date | null): string {
    if (!date) return 'N/A';
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  // Calculate age or age at death
  get personAge(): string {
    if (!this.personDetails?.birthday) return 'N/A';
    
    const birthDate = new Date(this.personDetails.birthday);
    const endDate = this.personDetails.deathday 
      ? new Date(this.personDetails.deathday) 
      : new Date();
    
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return this.personDetails.deathday 
      ? `${age} (at death)` 
      : `${age} years old`;
  }

  // Get gender string
  get personGender(): string {
    const gender = this.personDetails?.gender;
    switch (gender) {
      case 1: return 'Female';
      case 2: return 'Male';
      case 3: return 'Non-binary';
      default: return 'Not specified';
    }
  }

  // Get person IMDb URL
  get personImdbUrl(): string | null {
    const imdbId = this.personDetails?.imdb_id;
    return imdbId ? `https://www.imdb.com/name/${imdbId}` : null;
  }

  // Get person TMDb URL
  get personTmdbUrl(): string | null {
    const id = this.personDetails?.id;
    return id ? `https://www.themoviedb.org/person/${id}` : null;
  }

  // Open person homepage
  goToPersonHomepage() {
    const homepage = this.personDetails?.homepage;
    if (homepage) {
      window.open(homepage, '_blank');
    }
  }
}