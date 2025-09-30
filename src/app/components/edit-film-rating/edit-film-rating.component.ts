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

type MidKey = 'climax' | 'length';
type Criteria = {
  acting: number;
  visuals: number;
  story: number;
  pacing: number;
  ending: number;
  mid: number;     ///  Climax (movie) or Length (series)  \\\
  midKey: MidKey;
};

type Delta = { label: string; from: number; to: number };


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

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.jpg';

  readonly initialCriteria = signal<Criteria | null>(null);

  readonly confirmOpen = signal(false);
  readonly initialRating = signal<number | null>(null);
  readonly oldRating = signal<number | null>(null);
  readonly newRating = signal<number | null>(null);

  readonly changeList = signal<Delta[]>([]);


  ngOnInit(): void {
    this.addRandomStartPointForRows();
    
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

    if (editDraft && this.initialCriteria() == null) {
      this.initialCriteria.set(this.getCriteria(editDraft));
    }
    if (editDraft && this.initialRating() == null) {
      this.initialRating.set(editDraft.rating ?? 0);
    }
  }


  /// ---------------------------------------- Save Functionality ----------------------------------------  \\\
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
    this.navigateBackByKind(editDraft.kind);
  }


  /// ---------------------------------------- Helpers ----------------------------------------  \\\
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
  
  private buildChangeList(oldC: Criteria, curC: Criteria): Delta[] {
    const pretty = (k: keyof Criteria): string => {
      if (k === 'mid') return curC.midKey === 'climax' ? 'Climax' : 'Length';
      return ({
        acting: 'Acting',
        visuals: 'Visuals',
        story: 'Story',
        pacing: 'Pacing',
        ending: 'Ending',
      } as Record<keyof Criteria, string>)[k];
    };

    const entries: Array<[keyof Criteria, number, number]> = [
      ['acting', oldC.acting, curC.acting],
      ['visuals', oldC.visuals, curC.visuals],
      ['story',   oldC.story,   curC.story],
      ['pacing',  oldC.pacing,  curC.pacing],
      ['ending',  oldC.ending,  curC.ending],
      ['mid',     oldC.mid,     curC.mid],
    ];

    return entries
      .filter(([, from, to]) => Number(from) !== Number(to))
      .map(([key, from, to]) => ({ label: pretty(key), from, to }));
}

  private getCriteria(item: RatedItem): Criteria {
    const midKey: MidKey = item.kind === 'movie' ? 'climax' : 'length';
    const mid = Number((item as any)[midKey] ?? 0);
    return {
      acting: Number(item.acting ?? 0),
      visuals: Number(item.visuals ?? 0),
      story: Number(item.story ?? 0),
      pacing: Number(item.pacing ?? 0),
      ending: Number(item.ending ?? 0),
      mid,
      midKey,
    };
  }

  private criteriaChanged(a: Criteria | null, b: Criteria | null): boolean {
    if (!a || !b) return true;
    return (
      a.midKey !== b.midKey ||
      a.acting !== b.acting ||
      a.visuals !== b.visuals ||
      a.story !== b.story ||
      a.pacing !== b.pacing ||
      a.ending !== b.ending ||
      a.mid !== b.mid
    );
  }

  private navigateBackByKind(kind: FilmKind) {
    if (kind === 'movie') this.router.navigate(['/movies']);
    else this.router.navigate(['/shows']);
  }

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

  openConfirmEdit() {
    const d = this.draft();
    if (!d) return;

    const currentCriteria = this.getCriteria(d);
    const init = this.initialCriteria();

    const changed = this.criteriaChanged(init, currentCriteria);
    if (!changed) {
      this.navigateBackByKind(d.kind);
      return;
    }

    this.oldRating.set(this.initialRating() ?? d.rating ?? 0);
    this.newRating.set(d.rating ?? this.computeAverage(d));

    if (init) {
      this.changeList.set(this.buildChangeList(init, currentCriteria));
    } else {
      this.changeList.set([]);
    }

    this.confirmOpen.set(true);
  }

  closeConfirmEdit() {
    this.confirmOpen.set(false);
  }

  confirmEdit() {
    this.confirmOpen.set(false);
    this.onSave();
  }

  ///  Derived counts for Movie  \\\
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
      (this.draft() as any)?.runTime ??
      (this.draft() as any)?.runtimeMinutes ??
      (this.draft() as any)?.runtime_min ??
      null;

    if (Number.isFinite(nLike)) return Math.max(0, Number(nLike));

    const rt = (this.draft() as any)?.runtime ?? (this.draft() as any)?.Runtime ?? '';

    return this.parseRuntimeToMinutes(rt);
  }
  get runtimeMinutesRemainder(): number {
    return this.runtimeMinutes % 60;
  }
  get minutesLabel(): string {
    const n = this.runtimeMinutesRemainder;

    if (!n) return 'N/A';

    return n === 1 ? 'Minute' : 'Minutes';
  }

  get runtimeHours(): number {
    return Math.floor(this.runtimeMinutes / 60);
  }
  get hoursLabel(): string {
    const n = this.runtimeHours;

    if (!n) return 'N/A';

    return n === 1 ? 'Hour' : 'Hours';
  }

  ///  Derived counts for Series  \\\
  private toInt(n: any): number {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
  }

  get totalSeasons(): number {
    const af: any = this.draft() || {};

    const asNumber = this.toInt(af.seasons);
    if (asNumber) return asNumber;

    if (Array.isArray(af.seasons)) {
      return af.seasons.filter((s: any) => this.toInt(s?.episode_count) > 0).length;
    }

    return (
      this.toInt(af.number_of_seasons) ||
      this.toInt(af.numberOfSeasons) ||
      this.toInt(af.totalSeasons) ||
      0
    );
  }
  get seasonsLabel(): string {
    const n = this.totalSeasons;

    if (!n) return 'N/A';

    return n === 1 ? 'Season' : 'Seasons';
  }

  get totalEpisodes(): number {
    const af: any = this.draft() || {};

    const direct = this.toInt(af.episodes);
    if (direct) return direct;

    if (Array.isArray(af.seasons)) {
      return af.seasons.reduce((acc: number, s: any) => acc + this.toInt(s?.episode_count), 0);
    }

    return (
      this.toInt(af.number_of_episodes) ||
      this.toInt(af.numberOfEpisodes) ||
      this.toInt(af.totalEpisodes) ||
      0
    );
  }
  get episodesLabel(): string {
    const n = this.totalEpisodes;

    if (!n) return 'N/A';

    return n === 1 ? 'Episode' : 'Episodes';
  }

  ///  Dynmaic counts for Movie/Series (Count 1: Hours/Seasons - Count 2: Minutes/Episodes)  \\\
  get count1Num(): number {
    return this.isMovie() ? this.runtimeHours : this.totalSeasons;
  }
  get count1Label(): string {
    return this.isMovie() ? this.hoursLabel : this.seasonsLabel;
  }
  get count2Num(): number {
    return this.isMovie() ? this.runtimeMinutesRemainder : this.totalEpisodes;
  }
  get count2Label(): string {
    return this.isMovie() ?  this.minutesLabel : this.episodesLabel;
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.draft()?.poster;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  movie(): (RatedMovieModel & { kind: 'movie' }) | null {
    const d = this.draft();
    return d?.kind === 'movie' ? (d as any) : null;
  }
  series(): (RatedSeriesModel & { kind: 'series' }) | null {
    const d = this.draft();
    return d?.kind === 'series' ? (d as any) : null;
  }


  /// ---------------------------------------- Formatting ----------------------------------------  \\\
  ///  input: '2009-12-18' -> 'December 18, 2009'  \\\
  formatLongDate(dateLike?: string): string {
    if (!dateLike) return '';

    // If it's a full ISO string, keep only the date part
    const ymd = dateLike.includes('T') ? dateLike.slice(0, 10) : dateLike;

    // Strictly parse YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return ymd; // fallback (don’t crash)

    const [, year, month, day] = match;

    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];

    const monthName = months[parseInt(month, 10) - 1];
    const dayNum = parseInt(day, 10);

    return `${monthName} ${dayNum}, ${year}`;
  }
}