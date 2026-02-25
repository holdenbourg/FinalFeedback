import { Component, Input } from '@angular/core';
import { MultiSearchMediaResultModel } from '../../../models/api-models/tmdb-models/multi-search-media-result.model';
import { MultiSearchPersonResultModel } from '../../../models/api-models/tmdb-models/multi-search-person-result.model';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-searched-person',
    imports: [RouterLink],
    templateUrl: './searched-person.component.html',
    styleUrl: './searched-person.component.css'
})
export class SearchedPersonComponent {
  @Input({ required: true }) item!: MultiSearchPersonResultModel;
  @Input() imageSize: 'w185' | 'w342' | 'w500' | 'original' = 'w342';

  private readonly tmdbImgBase = 'https://image.tmdb.org/t/p';

  get displayName(): string {
    return this.item.name ?? '';
  }

  // e.g. Acting -> Actor, Directing -> Director
  get displayDepartment(): string {
    const dept = (this.item.known_for_department || '').trim().toLowerCase();

    const map: Record<string, string> = {
      acting: 'Actor',
      directing: 'Director',
      production: 'Producer', // TMDB often uses "Production"
      producing: 'Producer',
      writing: 'Writer',
      camera: 'Cinematographer',
      editing: 'Editor',
      sound: 'Sound',
      art: 'Art',
      costume: 'Costume',
      crew: 'Crew'
    };

    // fallback: Title Case original value
    return map[dept] ?? (this.item.known_for_department || '');
  }

  get profileSrc(): string {
    const path = this.item.profile_path;
    if (!path) return 'assets/images/no-poster.png';
    return `${this.tmdbImgBase}/${this.imageSize}${path}`;
  }

  // "Thor, Thor: Ragnarok, The Dark World"
  get knownForText(): string {
    const titles = (this.item.known_for ?? [])
      .map((k: MultiSearchMediaResultModel) =>
        k.media_type === 'movie' ? k.title : k.name
      )
      .filter(Boolean);

    // remove duplicates while preserving order
    const unique = Array.from(new Set(titles));

    // you can change 3 -> 4 if you want more
    return unique.slice(0, 3).join(', ');
  }

  setFallback(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src = 'assets/images/no-poster.png';
  }
}
