import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchedFilmModel } from '../../../models/api-models/omdb-models/searched-film-model';

@Component({
  selector: 'app-searched-film',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './searched-film.component.html',
  styleUrls: ['./searched-film.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SearchedFilmComponent {
  @Input({ required: true }) filmDetails!: SearchedFilmModel;

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.png';

  get posterSrc(): string {
    const poster = this.filmDetails?.Poster;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }

  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  ///  Fix ongoing series dates (2005- → 2005-Present)  \\\
  get displayYear(): string {
    const raw = String(this.filmDetails?.Year ?? '').trim();
    if (!raw) return '';

    const norm = raw.replace(/–/g, '-').trim();

    const isSeries = (this.filmDetails?.Type || '').toLowerCase() === 'series';
    const endsWithOpenRange = /-\s*$/.test(norm); // "2005-" (with optional trailing spaces)

    if (isSeries && endsWithOpenRange) {
      return norm.replace(/-\s*$/, '-Present');
    }
    return norm;
  }

  ///  Fix the film type (movie → Movie)  \\\
  get displayType(): string {
    const t = (this.filmDetails?.Type || '').trim();
    
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }
}