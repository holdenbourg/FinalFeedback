import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CombinedFilmApiResponseModel } from '../models/api-models/combined-film-api-response';

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private router = inject(Router);

  navigateToLogin() {
    this.router.navigate(['']);
  }

  ///  Sidebar  \\\
  navigateToHome() {
    this.router.navigate(['/home'], { replaceUrl: true });
  }
  navigateToSearchMovies(q?: string) {
    this.router.navigate(['/search', 'movies'], { queryParams: { q: q || null } });
  }
  navigateToSearchSeries(q?: string) {
    this.router.navigate(['/search', 'series'], { queryParams: { q: q || null } });
  }
  navigateToSearchUsers(q?: string) {
    this.router.navigate(['/search', 'users'], { queryParams: { q: q || null } });
  }


  ///  movie info path  \\\
  navigateToMovie(imdbId: string) {
    this.router.navigate(['/movie', imdbId], { queryParams: {} });
  }
  navigateToRateMovie(imdbId: string, film: CombinedFilmApiResponseModel) {
    this.router.navigate(['/rate', 'movie', imdbId], { state: { film } });
  }
  navigateToPostMovie(postId: string) {
    this.router.navigate(['/post-movie', postId]);
  }

  ///  series info path  \\\
  navigateToSeries(imdbId: string) {
    this.router.navigate(['/series', imdbId], { queryParams: {} });
  }
  navigateToRateSeries(imdbId: string, film: CombinedFilmApiResponseModel) {
    this.router.navigate(['/rate', 'series', imdbId], { state: { film } });
  }
  navigateToPostSeries(postId: string) {
    this.router.navigate(['/post-series', postId]);
  }




  navigateToMovies() {
    this.router.navigate(['/movies']);
  }
  navigateToShows() {
    this.router.navigate(['/shows']);
  }
  navigateToSummary() {
    this.router.navigate(['/summary']);
  }

  navigateToAccountsPosts(username: string) {
    this.router.navigate(['/account', username, 'posts']);
  }
  navigateToAccountsTagged(username: string) {
    this.router.navigate(['/account', username, 'tagged']);
  }
  navigateToAccountsArchived(username: string) {
    this.router.navigate(['/account', username, 'archive']);
  }
  navigateToSettings() {
    this.router.navigate(['/settings', 'account-info']);
  }
  navigateToPrivacy() {
    this.router.navigate(['/settings', 'privacy']);
  }
  navigateToLogout() {
    this.router.navigate(['/settings', 'logout']);
  }

  // edit
  navigateToEditMovie() {
    this.router.navigate(['/edit-movie']);
  }
  navigateToEditSeries() {
    this.router.navigate(['/edit-series']);
  }
}