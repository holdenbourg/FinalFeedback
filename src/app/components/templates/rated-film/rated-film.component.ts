import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RatingModel } from '../../../models/database-models/rating-model';


@Component({
  selector: 'app-rated-film',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rated-film.component.html',
  styleUrl: './rated-film.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class RatedFilmComponent {
  @Input() ratedFilm!: RatingModel;
  @Input() active = false;

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';


  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.ratedFilm?.poster_url;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  ///  Get film year (supports 'YYYY', 'YYYY-MM-DD', or 'DD Mon YYYY')  \\\
  getYear(dateStr?: string): string {
    if (!dateStr) return '';

    ///  Try ISO first  \\\
    const isoMatch = /^(\d{4})/.exec(dateStr);
    if (isoMatch) return isoMatch[1];

    ///  Try 'DD Mon YYYY'  \\\
    const parts = dateStr.split(' ');
    const maybeYear = parts[parts.length - 1];
    if (/^\d{4}$/.test(maybeYear)) return maybeYear;

    ///  Fallback to Date  \\\
    const d = new Date(dateStr);
    
    return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear());
  }
}
