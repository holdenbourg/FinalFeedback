import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RatingModel } from "../../../models/database-models/rating.model";

@Component({
    selector: 'app-shared-rating',
    imports: [CommonModule],
    templateUrl: './shared-rating.component.html',
    styleUrl: './shared-rating.component.css'
})
export class SharedRatingComponent {
  @Input() rating!: RatingModel;  // ✅ Changed from PostModel to RatingModel
  
  get posterUrl(): string {
    // ✅ Direct access to poster_url from rating
    return `https://image.tmdb.org/t/p/w154${this.rating.poster_url}`;
  }
  
  get displayRating(): string {
    // ✅ Format rating nicely (e.g., "8.5" not "8.5000000")
    return this.rating.rating.toFixed(1);
  }
}