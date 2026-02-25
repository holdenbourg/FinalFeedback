import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RatingModel, MovieCriteria, SeriesCriteria } from '../../models/database-models/rating.model';
import { FilmCacheService } from '../../services/film-cache.service';
import { RatingsService } from '../../services/ratings.service';
import { from } from 'rxjs';
import { RoutingService } from '../../services/routing.service';

type FilmKind = 'movie' | 'series';

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
    imports: [CommonModule, FormsModule],
    templateUrl: './edit-film-rating.component.html',
    styleUrls: ['./edit-film-rating.component.css']
})

export class EditFilmRatingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private filmCache = inject(FilmCacheService);
  private ratingsService = inject(RatingsService);
  private routingService = inject(RoutingService);

  readonly postId = signal<string>('');
  readonly type = signal<FilmKind>('movie');
  readonly draft = signal<RatingModel | null>(null);

  private useFallback = false;
  readonly fallbackPoster = 'assets/images/no-poster.jpg';

  readonly initialCriteria = signal<Criteria | null>(null);

  readonly confirmOpen = signal(false);
  readonly initialRating = signal<number | null>(null);
  readonly oldRating = signal<number | null>(null);
  readonly newRating = signal<number | null>(null);

  readonly changeList = signal<Delta[]>([]);


  ngOnInit(): void {
    const typeParam = (this.route.snapshot.paramMap.get('type') || 'movie') as FilmKind;
    const postIdParam = this.route.snapshot.paramMap.get('postId') || '';

    this.type.set(typeParam);
    this.postId.set(postIdParam);

    if (!postIdParam) { this.router.navigate(['/movies']); return; }

    from(Promise.all([this.filmCache.getDraft(postIdParam), this.filmCache.getOriginal(postIdParam)])).subscribe(([editDraft, originalSnapshot]) => {
      if (!editDraft) { this.router.navigate(['/movies']); return; }

      if ((editDraft.media_type as FilmKind) !== typeParam) {
        this.router.navigate(['/edit', editDraft.media_type, postIdParam]);
        return;
      }

      this.draft.set(editDraft);

      // Use an "original snapshot" (stored when the user first clicked Edit) to compute deltas,
      // so a refresh doesn't erase the pending-change confirmation.
      const original = originalSnapshot ?? editDraft;
      if (!originalSnapshot) {
        // Seed baseline for older sessions that didn't store originals.
        this.filmCache.setOriginal(postIdParam, original);
      }

      if (this.initialCriteria() == null) {
        this.initialCriteria.set(this.getCriteria(original));
      }
      if (this.initialRating() == null) {
        this.initialRating.set(original.rating ?? 0);
      }
    });
  }


  /// -======================================-  Save Functionality  -======================================- \\\
  async onSave() {
    const editDraft = this.draft();
    if (!editDraft) return;

    try {
      await this.ratingsService.updateRatingAndStamp(editDraft.id, {
        title: editDraft.title,
        release_date: editDraft.release_date,
        rating: editDraft.rating,
        criteria: editDraft.criteria,
      });

      this.filmCache.clearDraft(this.postId());
      this.filmCache.clearOriginal(this.postId());
      this.routingService.navigateToLibrary();    
    } catch (e) {
      console.error('Failed to update rating', e);
      // TODO: surface toast/snackbar
    }
  }


  /// -======================================-  Helper Methods  -======================================- \\\
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

  private getCriteria(item: RatingModel): Criteria {
    const isMovie = item.media_type === 'movie';
    const c = item.criteria as MovieCriteria | SeriesCriteria;

    const midKey: MidKey = isMovie ? 'climax' : 'length';
    const mid = Number(isMovie ? (c as MovieCriteria).climax ?? 0 : (c as SeriesCriteria).length ?? 0);

    return {
      acting:  Number(c.acting  ?? 0),
      visuals: Number(c.visuals ?? 0),
      story:   Number(c.story   ?? 0),
      pacing:  Number(c.pacing  ?? 0),
      ending:  Number(c.ending  ?? 0),
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

  private clamp(v: number) { return Math.max(1, Math.min(10, v)); }

  private setField(field: 'acting'|'visuals'|'story'|'pacing'|'climax'|'length'|'ending', val: number) {
    const editDraft = this.draft();
    if (!editDraft) return;

    const isMovie = editDraft.media_type === 'movie';
    const prev = editDraft.criteria as MovieCriteria | SeriesCriteria;
    let nextCriteria: MovieCriteria | SeriesCriteria;

    if (isMovie) {
      const mc: MovieCriteria = { ...(prev as MovieCriteria) };

      if (field === 'climax') mc.climax = val;
      else if (field in mc) (mc as any)[field] = val;  ///  acting/visuals/story/pacing/climax/ending  \\\

      nextCriteria = mc;

    } else {
      const sc: SeriesCriteria = { ...(prev as SeriesCriteria) };

      if (field === 'length') sc.length = val;
      else if (field in sc) (sc as any)[field] = val;  ///  acting/visuals/story/pacing/length/ending  \\\
      
      nextCriteria = sc;
    }

    const next: RatingModel = {
      ...editDraft,
      criteria: nextCriteria,
      rating: this.computeAverageFromCriteria(nextCriteria, isMovie),
    };

    this.draft.set(next);
    this.filmCache.setDraft(this.postId(), next);
  }

  onUp(field: 'acting'|'visuals'|'story'|'pacing'|'climax'|'length'|'ending') {
    const d = this.draft();
    if (!d) return;

    const isMovie = d.media_type === 'movie';
    const c = d.criteria as MovieCriteria | SeriesCriteria;

    const cur =
      field === 'climax' ? (isMovie ? (c as MovieCriteria).climax ?? 0 : 0)
      : field === 'length' ? (!isMovie ? (c as SeriesCriteria).length ?? 0 : 0)
      : Number((c as any)[field] ?? 0);

    this.setField(field, this.clamp(Number(cur) + 1));
  }

  onDown(field: 'acting'|'visuals'|'story'|'pacing'|'climax'|'length'|'ending') {
    const d = this.draft();
    if (!d) return;

    const isMovie = d.media_type === 'movie';
    const c = d.criteria as MovieCriteria | SeriesCriteria;

    const cur =
      field === 'climax' ? (isMovie ? (c as MovieCriteria).climax ?? 0 : 0)
      : field === 'length' ? (!isMovie ? (c as SeriesCriteria).length ?? 0 : 0)
      : Number((c as any)[field] ?? 0);

    this.setField(field, this.clamp(Number(cur) - 1));
  }

  private computeAverageFromCriteria(c: MovieCriteria | SeriesCriteria, isMovie: boolean): number {
    const vals = isMovie
      ? [c.acting, c.visuals, c.story, c.pacing, (c as MovieCriteria).climax, c.ending]
      : [c.acting, c.visuals, c.story, c.pacing, (c as SeriesCriteria).length, c.ending];

    const avg = vals.map(n => Number(n || 0)).reduce((a,b)=>a+b,0) / 6;
    return Number(avg.toFixed(1));
  }

  computeAverage(item: RatingModel): number {
    const isMovie = item.media_type === 'movie';
    return this.computeAverageFromCriteria(item.criteria as any, isMovie);
  }

  openConfirmEdit() {
    const draft = this.draft();
    if (!draft) return;

    const currentCriteria = this.getCriteria(draft);
    const init = this.initialCriteria();

    const changed = this.criteriaChanged(init, currentCriteria);
    if (!changed) {
      this.routingService.navigateToLibrary();
      return;
    }

    this.oldRating.set(this.initialRating() ?? draft.rating ?? 0);
    this.newRating.set(draft.rating ?? this.computeAverage(draft));

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
    return this.movie() ? this.runtimeHours : this.totalSeasons;
  }
  get count1Label(): string {
    return this.movie() ? this.hoursLabel : this.seasonsLabel;
  }
  get count2Num(): number {
    return this.movie() ? this.runtimeMinutesRemainder : this.totalEpisodes;
  }
  get count2Label(): string {
    return this.movie() ?  this.minutesLabel : this.episodesLabel;
  }

  ///  Get poster if not use fallback "No Poster" image  \\\
  get posterSrc(): string {
    const poster = this.draft()?.poster_url;
    const hasPoster = !!poster && poster !== 'N/A';

    return (hasPoster && !this.useFallback) ? poster! : this.fallbackPoster;
  }
  ///  If poster fails to load, use fallback "No Poster" image  \\\
  setFallback(ev?: Event) {
    this.useFallback = true;

    if (ev) (ev.target as HTMLImageElement).src = this.fallbackPoster;
  }

  movie(): MovieCriteria | null {
    const d = this.draft();
    return d?.media_type === 'movie' ? (d.criteria as MovieCriteria) : null;
  }
  series(): SeriesCriteria | null {
    const d = this.draft();
    return d?.media_type === 'series' ? (d.criteria as SeriesCriteria) : null;
  }

  acting(): number  { return this.draft()?.criteria.acting  ?? 0; }
  visuals(): number { return this.draft()?.criteria.visuals ?? 0; }
  story(): number   { return this.draft()?.criteria.story   ?? 0; }
  pacing(): number  { return this.draft()?.criteria.pacing  ?? 0; }
  ending(): number  { return this.draft()?.criteria.ending  ?? 0; }

  /// -======================================-  Formatting  -======================================- \\\
  ///  input: '2009-12-18' -> 'December 18, 2009'  \\\
  formatLongDate(dateLike?: string): string {
    if (!dateLike) return '';

    // If it's a full ISO string, keep only the date part
    const ymd = dateLike.includes('T') ? dateLike.slice(0, 10) : dateLike;

    // Strictly parse YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return ymd; // fallback (don't crash)

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