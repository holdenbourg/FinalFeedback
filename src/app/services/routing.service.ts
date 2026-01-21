import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MovieDetailsPageModel } from '../models/api-models/movie-details-page.model';
import { TvSeriesDetailsPageModel } from '../models/api-models/tv-series-details-page.model';

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

  navigateToMessages() {
    this.router.navigate(['/messages']);
  }

  navigateToSearchAll(q?: string) {
    this.router.navigate(['/search', 'all'], { queryParams: { q: q || null } });
  }
  navigateToSearchMovies(q?: string) {
    this.router.navigate(['/search', 'movies'], { queryParams: { q: q || null } });
  }
  navigateToSearchSeries(q?: string) {
    this.router.navigate(['/search', 'series'], { queryParams: { q: q || null } });
  }
  navigateToSearchPeople(q?: string) {
    this.router.navigate(['/search', 'people'], { queryParams: { q: q || null } });
  }
  navigateToSearchUsers(q?: string) {
    this.router.navigate(['/search', 'users'], { queryParams: { q: q || null } });
  }

  ///  Details  \\\
  navigateToMovieDetails(id?: string) {
    this.router.navigate(['/details', 'movie', id]);
  }
  navigateToShowDetails(id?: string) {
    this.router.navigate(['/details', 'tv', id]);
  }
  navigateToPersonDetails(id?: string) {
    this.router.navigate(['/details', 'person', id]);
  }


  ///  movie info path  \\\
  navigateToMovie(imdbId: string) {
    this.router.navigate(['/movie', imdbId], { queryParams: {} });
  }
  navigateToRateMovie(imdbId: string, film: MovieDetailsPageModel) {
    this.router.navigate(['/rate', 'movie', imdbId], { state: { film } });
  }
  navigateToPostMovie(postId: string) {
    this.router.navigate(['/post', 'movie', postId]);
  }

  ///  series info path  \\\
  navigateToSeries(imdbId: string) {
    this.router.navigate(['/series', imdbId], { queryParams: {} });
  }
  navigateToRateSeries(imdbId: string, film: TvSeriesDetailsPageModel) {
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

  navigateToNotifications() {
    this.router.navigate(['/notifications']);
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