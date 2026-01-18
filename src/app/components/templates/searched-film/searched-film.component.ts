import { Component, Input } from '@angular/core';
import { MultiSearchMediaResultModel } from '../../../models/api-models/tmdb-models/multi-search-media-result.model';

@Component({
  selector: 'app-searched-film',
  standalone: true,
  imports: [],
  templateUrl: './searched-film.component.html',
  styleUrls: ['./searched-film.component.css']
})

export class SearchedFilmComponent {
  @Input({ required: true }) item!: MultiSearchMediaResultModel;
  @Input() imageSize: 'w342' | 'w500' | 'w780' | 'original' = 'w342';

  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  get displayTitle(): string {
    return this.item.media_type === 'movie' ? this.item.title : this.item.name;
  }

  get displayDate(): string {
    const date =
      this.item.media_type === 'movie'
        ? this.item.release_date
        : this.item.first_air_date;

    if (!date) return '';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  get displayYear(): string {
    const d = this.item.media_type === 'movie' ? this.item.release_date : this.item.first_air_date;

    return d ? String(d.getFullYear()) : '';
  }

  get displayType(): string {
    return this.item.media_type === 'movie' ? 'Movie' : 'Series';
  }

  get posterSrc(): string {
    const path = this.item.poster_path;
    if (!path) return 'assets/images/no-poster.png';
    return `${this.tmdbImgBase}/${this.imageSize}${path}`;
  }

  setFallback(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src = 'assets/images/no-poster.png';
  }
}
