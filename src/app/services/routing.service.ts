import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CombinedFilmApiResponseModel } from '../models/api-models/combined-film-api-response.model';

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
    this.router.navigate(['/post', 'movie', postId]);
  }

  ///  series info path  \\\
  navigateToSeries(imdbId: string) {
    this.router.navigate(['/series', imdbId], { queryParams: {} });
  }
  navigateToRateSeries(imdbId: string, film: CombinedFilmApiResponseModel) {
    this.router.navigate(['/rate', 'series', imdbId], { state: { film } });
  }
  navigateToPostSeries(postId: string) {
    this.router.navigate(['/post', 'series', postId]);
  }

  navigateToLibrary() {
    this.router.navigate(['/library']);
  }
  navigateToSummary() {
    this.router.navigate(['/summary']);
  }

  navigateToEditFilm(type: 'movie' | 'series', postId: string) {
    this.router.navigate(['/edit', type, postId]);
  }

  navigateToAccount(username: string, tab: 'posts' | 'tagged' | 'archive' = 'posts') {
    this.router.navigate(['/account', username], { queryParams: { tab } });
  }
  navigateToAccountsPosts(username: string) {
    this.navigateToAccount(username, 'posts');
  }
  navigateToAccountsTags(username: string) {
    this.navigateToAccount(username, 'tagged');
  }
  navigateToAccountsArchive(username: string) {
    this.navigateToAccount(username, 'archive');
  }
  
  navigateToSettings() {
    this.router.navigate(['/settings', 'account-info']);
  }
  navigateToPrivacy() {
    this.router.navigate(['/settings', 'privacy']);
  }
  navigateToPrivacyPolicy() {
    this.router.navigate(['/settings', 'privacy-policy']);
  }
}