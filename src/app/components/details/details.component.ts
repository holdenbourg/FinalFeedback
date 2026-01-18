import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { MovieDetailsResponseModel } from '../../models/api-models/tmdb-models/movie-details-response.model';
import { MovieDetailsPageModel } from '../../models/api-models/movie-details-page.model';
import { PersonDetailsPageModel } from '../../models/api-models/person-details-page.model';
import { TvDetailsPageModel } from '../../models/api-models/tv-details-page.model';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css'] // you can reuse your old css file
})

export class DetailsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  mediaType: 'movie' | 'tv' | 'person' | null = null;

  movieDetails: MovieDetailsPageModel | null = null;
  tvDetails: TvDetailsPageModel | null = null;
  personDetails: PersonDetailsPageModel | null = null;

  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  type = signal<'movie' | 'tv' | 'person' | null>(null);
  id = signal<number | null>(null);

  readonly fallbackPoster = 'assets/images/no-poster.png';

  posterSrc = computed(() => {
    const m = this.movieDetails();
    if (!m?.poster_path) return this.fallbackPoster;
    return `https://image.tmdb.org/t/p/w500${m.poster_path}`;
  });

  genreText = computed(() => {
    const m = this.movieDetails();
    const names = (m?.genres ?? []).map(g => g.name).filter(Boolean);
    return names.length ? names.join(' • ') : 'N/A';
  });

  runtimeText = computed(() => {
    const m = this.movieDetails();
    const mins = m?.runtime ?? 0;
    if (!mins) return 'N/A';
    const h = Math.floor(mins / 60);
    const r = mins % 60;
    return h ? `${h}h ${r}m` : `${r}m`;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const type = pm.get('type') as any;
      const id = Number(pm.get('id'));

      this.type.set(type);
      this.id.set(Number.isFinite(id) ? id : null);

      this.movieDetails.set(null);
      this.error.set(null);

      if (type === 'movie' && Number.isFinite(id)) {
        this.loadMovie(id);
      } else {
        this.loading.set(false);
        this.error.set('Unsupported detail type or invalid id.');
      }
    });
  }

  private loadMovie(id: number) {
    this.loading.set(true);

    this.api.getMovieDetailsTmdb(id).subscribe({
      next: (details) => {
        this.movieDetails.set(details);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load movie details.');
        this.loading.set(false);
      }
    });
  }

  setFallback(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src = this.fallbackPoster;
  }
}