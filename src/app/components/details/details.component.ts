import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { emptyMovieDetailsPageModel, MovieDetailsPageModel } from '../../models/api-models/movie-details-page.model';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css']
})

export class DetailsComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);

  // State
  loading = true;
  error: string | null = null;
  movieDetails: MovieDetailsPageModel | null = null;

  readonly fallbackPoster = 'assets/images/no-poster.png';

  // ✅ Streaming service logo and URL maps
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

  // ✅ Processed streaming services with logos and URLs
  streamingServices: { name: string; logo: string; url: string | null }[] = [];

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      const type = params.get('type'); // 'movie' | 'tv' | 'person'
      const id = params.get('id'); // TMDb ID (as string)

      if (!id) {
        this.error = 'No ID provided';
        this.loading = false;
        return;
      }

      const tmdbId = parseInt(id, 10);

      if (type === 'movie') {
        await this.loadMovie(tmdbId);
        
      } else if (type === 'tv') {
        // TODO: await this.loadTvShow(tmdbId);
      } else if (type === 'person') {
        // TODO: await this.loadPerson(tmdbId);
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

  // ✅ Process streaming services with deduplication and logo mapping
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


  // ============================================
  // Helper Methods for Details Component
  // ============================================

  // TMDb Image Base URL
  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  // ✅ Get high-quality poster (w500 or original)
  get posterSrc(): string {
    if (!this.movieDetails?.poster_path) {
      return 'assets/images/no-poster.png';
    }
    // Use w500 for good balance of quality and load time
    // Can also use 'w780' or 'original' for even higher quality
    return `${this.tmdbImgBase}/w500${this.movieDetails.poster_path}`;
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
    if (!this.movieDetails?.genres?.length) return 'N/A';
    return this.movieDetails.genres.map(g => g.name).join(', ');
  }

  // ✅ Get director name (from OMDb)
  get directorName(): string {
    return this.movieDetails?.director || 'N/A';
  }

  // ✅ Get writer names (from OMDb)
  get writerNames(): string {
    return this.movieDetails?.writer || 'N/A';
  }

  // ✅ Get IMDb rating
  get imdbRating(): string {
    const rating: any = this.movieDetails?.ratings?.[0];

    return rating?.Value ?? rating?.value ?? 'N/A';
  }

  // ✅ Get Rotten Tomatoes rating
  get rottenTomatoesRating(): string {
    const rating: any = this.movieDetails?.ratings?.[1];

    return rating?.Value ?? rating?.value ?? 'N/A';
  }

  // ✅ Get Metacritic rating
  get metacriticRating(): string {
    const rating: any = this.movieDetails?.ratings?.[2];

    return rating?.Value ?? rating?.value ?? 'N/A';
  }

  // ✅ Get streaming providers (already processed)
  get streamingProviders() {
    return this.streamingServices;
  }

  // ✅ Get trailer URL
  get trailerUrl(): string | null {
    return this.movieDetails?.trailer || null;
  }
  // ✅ Open trailer in new tab
  goToTrailer() {
    if (this.trailerUrl) {
      window.open(this.trailerUrl, '_blank');
    }
  }

  get homePageUrl(): string | null {
    return this.movieDetails?.homepage || null;
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
    const releaseDate = this.movieDetails?.release_date;
    if (!releaseDate) return false;
    return new Date(releaseDate) <= new Date();
  }

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
    const id = this.movieDetails?.imdb_id?.trim();

    return id ? `https://www.imdb.com/title/${id}/` : null;
  }
  get rottenTomatoesUrl(): string | null {
    const t = this.movieDetails?.title?.trim();
    if (!t) return null;

    const segment = (this.movieDetails?.media_type === 'movie') ? 'm' : 'tv';
    const slug = this.slugForRottenTomatoes(t);

    return `https://www.rottentomatoes.com/${segment}/${slug}`;
  }
  get metacriticUrl(): string | null {
    const t = this.movieDetails?.title?.trim();
    if (!t) return null;

    const segment = (this.movieDetails?.media_type === 'movie') ? 'movie' : 'tv';
    const slug = this.slugForMetacritic(t);

    return `https://www.metacritic.com/${segment}/${slug}/`;
  }
  get TmdbUrl(): string | null {
    const t = this.movieDetails?.title?.trim();
    if (!t) return null;

    return `https://www.themoviedb.org/${this.movieDetails?.media_type}/${this.movieDetails?.id}-${t}`;
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

  // ✅ TrackBy function for streaming providers
  trackByProviderName(index: number, provider: any): string {
    return provider.name || index;
  }

  // ✅ Handle logo error for streaming providers
  onLogoError(provider: any) {
    console.warn(`[Details] Failed to load logo for ${provider.name}`);
    // Could set a fallback logo here if needed
  }
}