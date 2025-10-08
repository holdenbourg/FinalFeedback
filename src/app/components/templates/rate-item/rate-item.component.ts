import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface RatingCriterion {
  key: string;
  label: string;
  explanation?: string;
}

export interface RateResult {
  criteria: Record<string, number>;
  average: number;
}

@Component({
  selector: 'app-rate-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rate-item.component.html',
  styleUrl: './rate-item.component.css',
})

export class RateItemComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) criteria!: RatingCriterion[];
  @Output() rated = new EventEmitter<RateResult>();

  ratings: Record<string, number> = {};
  hoverKey: string | null = null;
  warn = false;

  get isComplete(): boolean {
    return this.criteria.every(c => (this.ratings[c.key] ?? 0) > 0);
  }

  get average(): number {
    const keys = this.criteria.map(c => c.key);
    const sum = keys.reduce((acc, k) => acc + (this.ratings[k] ?? 0), 0);
    const avg = keys.length ? sum / keys.length : 0;
    return Number(avg.toFixed(1));
  }

  setRating(key: string, value: number) {
    this.ratings[key] = value;
  }

  submit() {
    if (!this.isComplete) {
      this.warn = true;
      setTimeout(() => (this.warn = false), 3500);
      return;
    }
    
    this.rated.emit({ criteria: { ...this.ratings }, average: this.average });
  }

  reset() {
    this.ratings = {};
    this.warn = false;
  }

  trackByKey = (_: number, c: RatingCriterion) => c.key;
  ten = Array.from({ length: 10 }, (_, i) => i + 1);
}
