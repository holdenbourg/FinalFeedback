import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RatedMovieModel } from '../../models/database-models/rated-movie-model';
import { RatedSeriesModel } from '../../models/database-models/rated-series-model';
import { FilmCacheService } from '../../services/film-cache.service';
import { LocalStorageService } from '../../services/local-storage.service';

type FilmKind = 'movie' | 'series';
type RatedItem =
  | (RatedMovieModel & { kind: 'movie' })
  | (RatedSeriesModel & { kind: 'series' });

@Component({
  selector: 'app-edit-film-rating',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-film-rating.component.html',
  styleUrls: ['./edit-film-rating.component.css'],
})
export class EditFilmRatingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private filmCache = inject(FilmCacheService);
  private localStorageService = inject(LocalStorageService);

  readonly postId = signal<string>('');
  readonly type = signal<FilmKind>('movie');
  readonly draft = signal<RatedItem | null>(null);

  readonly isMovie = computed(() => this.draft()?.kind === 'movie');
  readonly isSeries = computed(() => this.draft()?.kind === 'series');

  ngOnInit(): void {
    const typeParam = (this.route.snapshot.paramMap.get('type') || 'movie') as FilmKind;
    const postIdParam = this.route.snapshot.paramMap.get('postId') || '';

    this.type.set(typeParam);
    this.postId.set(postIdParam);

    if (!postIdParam) { this.router.navigate(['/movies']); return; }

    ///  1) Try draft cache first (refresh-proof)  \\\
    let editDraft = this.filmCache.getDraft(postIdParam) as RatedItem | null;

    ///  2) Fallback: find in rated lists by postId, then seed the draft  \\\
    if (!editDraft) {
      if (typeParam === 'movie') {
        const ratedMovies: RatedMovieModel[] = (this.localStorageService.getInformation('rated-movies') ?? []) as any[];
        editDraft = ratedMovies.find(x => x.postId === postIdParam) as any;
        if (editDraft) editDraft.kind = 'movie';

      } else {
        const ratedSeries: RatedSeriesModel[] = (this.localStorageService.getInformation('rated-series') ?? []) as any[];
        editDraft = ratedSeries.find(x => x.postId === postIdParam) as any;
        if (editDraft) editDraft.kind = 'series';
      }

      if (editDraft) this.filmCache.setDraft(postIdParam, editDraft);
    }

    if (!editDraft) { this.router.navigate(['/movies']); return; }

    if (editDraft.kind !== typeParam) {
      this.router.navigate(['/edit', editDraft.kind, postIdParam]);
      return;
    }

    this.draft.set(editDraft);
  }

  // ---------- rating changes (autosave to draft) ----------
  private clamp(v: number) { return Math.max(1, Math.min(10, v)); }

  private setField<K extends keyof RatedItem>(key: K, val: any) {
    const editDraft = this.draft(); 
    if (!editDraft) return;

    const next = { ...editDraft, [key]: val } as RatedItem;
    (next as any).rating = this.computeAverage(next);

    this.draft.set(next);
    this.filmCache.setDraft(this.postId(), next);
  }

  onUp(field: 'acting'|'visuals'|'story'|'pacing'|'climax'|'length'|'ending') {
    const d = this.draft(); 
    if (!d) return;

    const cur = Number((d as any)[field] ?? 0);

    this.setField(field as any, this.clamp(cur + 1));
  }
  onDown(field: 'acting'|'visuals'|'story'|'pacing'|'climax'|'length'|'ending') {
    const d = this.draft(); 
    if (!d) return;

    const cur = Number((d as any)[field] ?? 0);

    this.setField(field as any, this.clamp(cur - 1));
  }

  computeAverage(item: RatedItem): number {
    const mid = item.kind === 'series' ? (item as any).length : (item as any).climax;
    const vals = [item.acting, item.visuals, item.story, item.pacing, mid, item.ending]
      .map(n => Number(n || 0));

    return Number((vals.reduce((a,b)=>a+b,0) / 6).toFixed(1));
  }

  // ---------- save ----------
  onSave() {
    const editDraft = this.draft(); 
    if (!editDraft) return;

    if (editDraft.kind === 'movie') {
      const ratedMovies: RatedMovieModel[] = this.localStorageService.getInformation('rated-movies') ?? [];
      const index = ratedMovies.findIndex(x => x.postId === editDraft.postId);

      if (index >= 0) ratedMovies[index] = editDraft; 
      else ratedMovies.unshift(editDraft);

      this.localStorageService.setInformation('rated-movies', ratedMovies);
    } else {
      const ratedSeries: RatedSeriesModel[] = this.localStorageService.getInformation('rated-series') ?? [];
      const index = ratedSeries.findIndex(x => x.postId === editDraft.postId);

      if (index >= 0) ratedSeries[index] = editDraft; 
      else ratedSeries.unshift(editDraft);

      this.localStorageService.setInformation('rated-series', ratedSeries);
    }
    
    this.filmCache.clearDraft(editDraft.postId);

    if (editDraft.kind === 'movie') {
      this.router.navigate(['/movies']);
    } else {
      this.router.navigate(['/shows']);
    }
  }

  movie(): (RatedMovieModel & { kind: 'movie' }) | null {
    const d = this.draft();
    return d?.kind === 'movie' ? (d as any) : null;
  }
  series(): (RatedSeriesModel & { kind: 'series' }) | null {
    const d = this.draft();
    return d?.kind === 'series' ? (d as any) : null;
  }

  fixRuntime(runtime?: number) {
    const r = Number(runtime ?? 0);
    const hours = Math.floor(r / 60);
    const minutes = r - hours * 60;

    return `${hours} HR ${minutes} MIN`;
  }
}