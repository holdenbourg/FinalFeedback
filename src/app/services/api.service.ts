import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';

import { SearchedFilmModel } from '../models/api-models/omdb-models/searched-film-model';
import { FilmSearchResposneModel } from '../models/api-models/omdb-models/film-search-response-model';
import { ExtensiveSearchFilmModel } from '../models/api-models/omdb-models/extensive-search-film-model';

import { UpcomingFilmModel } from '../models/api-models/tmdb-models/upcoming-film-model';
import { UpcomingFilmApiResponseModel } from '../models/api-models/tmdb-models/upcoming-film-api-response-model';

import { SeriesResponseModel } from '../models/api-models/mdb-models/series-response-model';
import { MovieResponseModel } from '../models/api-models/mdb-models/movie-response-model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  /// ---------------------------------------- OMDb (Search Multiple Films) ---------------------------------------- \\\
  ///  Search up to 10 films by title + type (movie | series) from OMDb  \\\
  search10Films(title: string, type: 'movie' | 'series'): Observable<SearchedFilmModel[]> {
    const params = new HttpParams()
      .set('apikey', environment.omdb.apiKey)
      .set('s', title)
      .set('type', type);

    return this.http
      .get<FilmSearchResposneModel>(environment.omdb.baseUrl, { params })
      .pipe(
        map(res =>
          (res?.Search ?? []).map(el => ({
            Title: el.Title,
            Year: el.Year,
            imdbID: el.imdbID,
            Type: el.Type,
            Poster: el.Poster
          } as SearchedFilmModel))
        ),
        catchError((err: HttpErrorResponse) => {
          console.error('[ApiService] search10Films error', err);
          
          return of([] as SearchedFilmModel[]);
        })
      );
  }

  ///  Get one film by IMDB id via OMDb  \\\
  getFilmOmdb(imdbId: string): Promise<ExtensiveSearchFilmModel> {
    const params = new HttpParams()
      .set('apikey', environment.omdb.apiKey)
      .set('i', imdbId);

    return firstValueFrom(this.http
      .get<ExtensiveSearchFilmModel>(environment.omdb.baseUrl, { params })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error('[ApiService] getFilmOmdb error', err);

          return of({} as ExtensiveSearchFilmModel);
        })
      ));
  }

  /// ---------------------------------------- TMDb (Upcoming Films) ---------------------------------------- \\\
  ///  Upcoming films (region/language pulled from environment)  \\\
  getUpcomingFilms(): Observable<UpcomingFilmModel[]> {
    const url = `${environment.tmdb.baseUrl}/movie/upcoming`;
    const today = new Date().toISOString().slice(0, 10);

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', environment.tmdb.language)
      .set('region', environment.tmdb.region)
      .set('release_date.gte', today);

    return this.http
      .get<UpcomingFilmApiResponseModel>(url, { params })
      .pipe(
        map(res => (res?.results ?? []).map(el => ({
          adult: el.adult,
          backdrop_path: el.backdrop_path,
          genre_ids: el.genre_ids,
          id: el.id,
          original_language: el.original_language,
          original_title: el.original_title,
          overview: el.overview,
          popularity: el.popularity,
          poster_path: el.poster_path,
          release_date: el.release_date,
          title: el.title,
          video: el.video,
          vote_average: el.vote_average,
          vote_count: el.vote_count
        } as UpcomingFilmModel))),
        catchError((err: HttpErrorResponse) => {
          console.error('[ApiService] getUpcomingFilms error', err);
          return of([] as UpcomingFilmModel[]);
        })
      );
  }

  /// ---------------------------------------- mdblist (Seach One Film) ---------------------------------------- \\\
  ///  mdblist headers  \\\
  private get rapidHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-RapidAPI-Key': environment.mdblist.apiKey,
      'X-RapidAPI-Host': environment.mdblist.host
    });
  }

  ///  Get one SERIES by IMDB id via mdblist  \\\
  getSeriesByImdb(imdbId: string): Promise<SeriesResponseModel> {
    const params = new HttpParams().set('i', imdbId);

    return firstValueFrom(this.http
      .get<SeriesResponseModel>(environment.mdblist.baseUrl, { headers: this.rapidHeaders, params })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error('[ApiService] getSeriesByImdb error', err);

          return of({} as SeriesResponseModel);
        })
      ));
  }

  ///  Get one MOVIE by IMDB id via mdblist  \\\
  getMovieByImdb(imdbId: string): Promise<MovieResponseModel> {
    const params = new HttpParams().set('i', imdbId);

    return firstValueFrom(this.http
      .get<MovieResponseModel>(environment.mdblist.baseUrl, { headers: this.rapidHeaders, params })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error('[ApiService] getMovieByImdb error', err);

          return of({} as MovieResponseModel);
        })
      ));
  }
}