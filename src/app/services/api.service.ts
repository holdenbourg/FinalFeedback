import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';

import { SearchedFilmModel } from '../models/api-models/omdb-models/searched-film.model';
import { FilmSearchResposneModel } from '../models/api-models/omdb-models/film-search-response.model';
import { ExtensiveSearchFilmModel } from '../models/api-models/omdb-models/extensive-search-film.model';

import { UpcomingFilmModel } from '../models/api-models/tmdb-models/upcoming-film.model';
import { UpcomingFilmApiResponseModel } from '../models/api-models/tmdb-models/upcoming-film-api-response.model';

import { MultiSearchMovieResultModel } from '../models/api-models/tmdb-models/multi-search-movie-result.model';
import { MultiSearchTvResultModel } from '../models/api-models/tmdb-models/multi-search-tv-result.model';

import { SeriesResponseModel } from '../models/api-models/mdb-models/series-response.model';
import { MovieResponseModel } from '../models/api-models/mdb-models/movie-response.model';
import { MultiSearchMediaResultModel } from '../models/api-models/tmdb-models/multi-search-media-result.model';
import { MovieSearchResposneModel } from '../models/api-models/tmdb-models/movie-search-response.model';
import { TvSearchResposneModel } from '../models/api-models/tmdb-models/tv-search-response.model';
import { KnownForPersonSearchResposneModel } from '../models/api-models/tmdb-models/known-for-person-search-response.model';
import { PersonSearchResposneModel } from '../models/api-models/tmdb-models/person-search-response.model';
import { SearchApiResponseModel } from '../models/api-models/tmdb-models/search-api-response.model';
import { MovieSearchApiResponseModel, MultiSearchResultModel, PersonSearchApiResponseModel, TvSearchApiResponseModel } from '../models/api-models/tmdb-models/tmdb-search-api-response-types.model';
import { MultiSearchPersonResultModel } from '../models/api-models/tmdb-models/multi-search-person-result.model';
import { MovieDetailsResponseModel } from '../models/api-models/tmdb-models/movie-details-response.model';

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

  /// -======================================-  TMDb (Upcoming Films, Multiple Films, and Film Details)  -======================================- \\\
  ///==-  Search Multi (Returns a mixed list of movie's and tv's)  -==\\\
  searchMultiTmdb(query: string, page: number = 1, language: string = environment.tmdb.language ?? 'en-US', includeAdult: boolean = false): Observable<MultiSearchResultModel[]> {
    const url = `${environment.tmdb.baseUrl}/search/multi`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('query', query)
      .set('include_adult', String(includeAdult))
      .set('language', language)
      .set('page', String(page));

    const mapKnownFor = (items: any[] | undefined): MultiSearchMediaResultModel[] => {
      if (!Array.isArray(items)) return [];

      return items
        .map((kf: any) => {
          if (kf?.media_type === 'movie') {
            return {
              id: kf.id,
              media_type: 'movie',
              popularity: kf.popularity ?? 0,
              adult: kf.adult,
              title: kf.title ?? '',
              original_title: kf.original_title ?? '',
              overview: kf.overview ?? '',
              poster_path: kf.poster_path ?? null,
              backdrop_path: kf.backdrop_path ?? null,
              original_language: kf.original_language ?? '',
              genre_ids: kf.genre_ids ?? [],
              release_date: this.parseTmdbDate(kf.release_date),
              video: !!kf.video,
              vote_average: kf.vote_average ?? 0,
              vote_count: kf.vote_count ?? 0
            } as MultiSearchMovieResultModel;
          }

          if (kf?.media_type === 'tv') {
            return {
              id: kf.id,
              media_type: 'tv',
              popularity: kf.popularity ?? 0,
              adult: kf.adult,
              name: kf.name ?? '',
              original_name: kf.original_name ?? '',
              overview: kf.overview ?? '',
              poster_path: kf.poster_path ?? null,
              backdrop_path: kf.backdrop_path ?? null,
              original_language: kf.original_language ?? '',
              genre_ids: kf.genre_ids ?? [],
              first_air_date: this.parseTmdbDate(kf.first_air_date),
              vote_average: kf.vote_average ?? 0,
              vote_count: kf.vote_count ?? 0,
              origin_country: kf.origin_country ?? []
            } as MultiSearchTvResultModel;
          }

          return null;
        })
        .filter((x): x is MultiSearchMediaResultModel => x !== null);
    };

    // NOTE: raw TMDB JSON has date strings, so typing the HTTP call as `any` avoids TS lies.
    return this.http.get<SearchApiResponseModel<any>>(url, { params }).pipe(
      map((res) =>
        (res?.results ?? []).map((el: any) => {

          if (el?.media_type === 'movie') {
            return {
              id: el.id,
              media_type: 'movie',
              popularity: el.popularity ?? 0,
              adult: el.adult,
              title: el.title ?? '',
              original_title: el.original_title ?? '',
              overview: el.overview ?? '',
              poster_path: el.poster_path ?? null,
              backdrop_path: el.backdrop_path ?? null,
              original_language: el.original_language ?? '',
              genre_ids: el.genre_ids ?? [],
              release_date: this.parseTmdbDate(el.release_date),
              video: !!el.video,
              vote_average: el.vote_average ?? 0,
              vote_count: el.vote_count ?? 0
            } as MultiSearchMovieResultModel;
          }

          if (el?.media_type === 'tv') {
            return {
              id: el.id,
              media_type: 'tv',
              popularity: el.popularity ?? 0,
              adult: el.adult,
              name: el.name ?? '',
              original_name: el.original_name ?? '',
              overview: el.overview ?? '',
              poster_path: el.poster_path ?? null,
              backdrop_path: el.backdrop_path ?? null,
              original_language: el.original_language ?? '',
              genre_ids: el.genre_ids ?? [],
              first_air_date: this.parseTmdbDate(el.first_air_date),
              vote_average: el.vote_average ?? 0,
              vote_count: el.vote_count ?? 0,
              origin_country: el.origin_country ?? []
            } as MultiSearchTvResultModel;
          }

          // person
          return {
            id: el.id,
            media_type: 'person',
            popularity: el.popularity ?? 0,
            adult: el.adult,
            name: el.name ?? '',
            original_name: el.original_name ?? '',
            gender: el.gender ?? 0,
            known_for_department: el.known_for_department ?? '',
            profile_path: el.profile_path ?? null,
            known_for: mapKnownFor(el.known_for)
          } as MultiSearchPersonResultModel;

        }) as MultiSearchResultModel[]
      ),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] searchMultiTmdb error', err);
        return of([] as MultiSearchResultModel[]);
      })
    );
  }

  ///==-  Movie Search  -==\\\
  searchMoviesTmdb(query: string, page: number = 1, language: string = environment.tmdb.language ?? 'en-US', includeAdult: boolean = false): Observable<MovieSearchResposneModel[]> {
    const url = `${environment.tmdb.baseUrl}/search/movie`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('query', query)
      .set('include_adult', String(includeAdult))
      .set('language', language)
      .set('page', String(page));

    return this.http.get<MovieSearchApiResponseModel>(url, { params }).pipe(
      map(res => (res?.results ?? []).map((el: any) => ({
        adult: el.adult,
        backdrop_path: el.backdrop_path ?? null,
        genre_ids: el.genre_ids ?? [],
        id: el.id,
        original_language: el.original_language ?? '',
        original_title: el.original_title ?? '',
        overview: el.overview ?? '',
        popularity: el.popularity ?? 0,
        poster_path: el.poster_path ?? null,
        release_date: this.parseTmdbDate(el.release_date),
        title: el.title ?? '',
        video: !!el.video,
        vote_average: el.vote_average ?? 0,
        vote_count: el.vote_count ?? 0
      } as MovieSearchResposneModel))),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] searchMoviesTmdb error', err);
        return of([] as MovieSearchResposneModel[]);
      })
    );
  }

  ///==-  TV Search  -==\\\
  searchTvTmdb(query: string, page: number = 1, language: string = environment.tmdb.language ?? 'en-US', includeAdult: boolean = false): Observable<TvSearchResposneModel[]> {
    const url = `${environment.tmdb.baseUrl}/search/tv`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('query', query)
      .set('include_adult', String(includeAdult))
      .set('language', language)
      .set('page', String(page));

    return this.http.get<TvSearchApiResponseModel>(url, { params }).pipe(
      map(res => (res?.results ?? []).map((el: any) => ({
        adult: el.adult,
        backdrop_path: el.backdrop_path ?? null,
        genre_ids: el.genre_ids ?? [],
        id: el.id,
        origin_country: el.origin_country ?? [],
        original_language: el.original_language ?? '',
        original_name: el.original_name ?? '',
        overview: el.overview ?? '',
        popularity: el.popularity ?? 0,
        poster_path: el.poster_path ?? null,
        first_air_date: this.parseTmdbDate(el.first_air_date),
        name: el.name ?? '',
        vote_average: el.vote_average ?? 0,
        vote_count: el.vote_count ?? 0
      } as TvSearchResposneModel))),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] searchTvTmdb error', err);
        return of([] as TvSearchResposneModel[]);
      })
    );
  }

  ///==-  Person Search  -==\\\
  searchPeopleTmdb(query: string, page: number = 1, language: string = environment.tmdb.language ?? 'en-US', includeAdult: boolean = false): Observable<PersonSearchResposneModel[]> {

    const url = `${environment.tmdb.baseUrl}/search/person`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('query', query)
      .set('include_adult', String(includeAdult))
      .set('language', language)
      .set('page', String(page));

    return this.http.get<PersonSearchApiResponseModel>(url, { params }).pipe(
      map(res => (res?.results ?? []).map((el: any) => ({
        adult: el.adult,
        gender: el.gender ?? 0,
        id: el.id,
        known_for_department: el.known_for_department ?? '',
        name: el.name ?? '',
        original_name: el.original_name ?? '',
        popularity: el.popularity ?? 0,
        profile_path: el.profile_path ?? null,
        known_for: Array.isArray(el.known_for)
          ? el.known_for.map((kf: any) => ({
              adult: kf.adult,
              backdrop_path: kf.backdrop_path ?? null,
              id: kf.id,
              title: kf.title ?? '',
              original_language: kf.original_language ?? '',
              original_title: kf.original_title ?? '',
              overview: kf.overview ?? '',
              poster_path: kf.poster_path ?? null,
              media_type: kf.media_type ?? '',
              genre_ids: kf.genre_ids ?? [],
              popularity: kf.popularity ?? 0,
              release_date: this.parseTmdbDate(kf.release_date),
              video: !!kf.video,
              vote_average: kf.vote_average ?? 0,
              vote_count: kf.vote_count ?? 0
            } as KnownForPersonSearchResposneModel))
          : []
      } as PersonSearchResposneModel))),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] searchPeopleTmdb error', err);
        return of([] as PersonSearchResposneModel[]);
      })
    );
  }

  ///==-  Upcoming Movie List (region/language pulled from environment)  -==\\\
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

  
  getMovieDetailsTmdb(movieId: number, language: string = environment.tmdb.language ?? 'en-US'): Observable<MovieDetailsResponseModel> {
    const url = `${environment.tmdb.baseUrl}/movie/${movieId}`;
  
    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', language);
  
    // Use `any` because TMDB returns date strings / nullable fields.
    return this.http.get<any>(url, { params }).pipe(
      map((raw) => this.mapMovieDetails(raw)),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getMovieDetailsTmdb error', err);
  
        // Return a safe empty object (so component can show error state if desired)
        return of(this.mapMovieDetails({ id: movieId }));
      })
    );
  }
  
  private mapMovieDetails(raw: any): MovieDetailsResponseModel {
    return {
      adult: !!raw?.adult,
      backdrop_path: raw?.backdrop_path ?? '',
      belongs_to_collection: raw?.belongs_to_collection
        ? {
            id: raw.belongs_to_collection.id ?? 0,
            name: raw.belongs_to_collection.name ?? '',
            poster_path: raw.belongs_to_collection.poster_path ?? '',
            backdrop_path: raw.belongs_to_collection.backdrop_path ?? ''
          }
        : null,
  
      budget: raw?.budget ?? 0,
      genres: Array.isArray(raw?.genres)
        ? raw.genres.map((g: any) => ({ id: g.id ?? 0, name: g.name ?? '' }))
        : [],
      homepage: raw?.homepage ?? '',
      id: raw?.id ?? 0,
      imdb_id: raw?.imdb_id ?? '',
      origin_country: Array.isArray(raw?.origin_country) ? raw.origin_country : [],
      original_language: raw?.original_language ?? '',
      original_title: raw?.original_title ?? '',
      overview: raw?.overview ?? '',
      popularity: raw?.popularity ?? 0,
      poster_path: raw?.poster_path ?? '',
      production_companies: Array.isArray(raw?.production_companies)
        ? raw.production_companies.map((c: any) => ({
            id: c.id ?? 0,
            logo_path: c.logo_path ?? null,
            name: c.name ?? '',
            origin_country: c.origin_country ?? ''
          }))
        : [],
      production_countries: Array.isArray(raw?.production_countries)
        ? raw.production_countries.map((c: any) => ({
            iso_3166_1: c.iso_3166_1 ?? '',
            name: c.name ?? ''
          }))
        : [],
      release_date: this.parseTmdbDate(raw?.release_date),
      revenue: raw?.revenue ?? 0,
      runtime: raw?.runtime ?? 0,
      spoken_languages: Array.isArray(raw?.spoken_languages)
        ? raw.spoken_languages.map((l: any) => ({
            english_name: l.english_name ?? '',
            iso_639_1: l.iso_639_1 ?? '',
            name: l.name ?? ''
          }))
        : [],
      status: raw?.status ?? '',
      tagline: raw?.tagline ?? '',
      title: raw?.title ?? '',
      video: !!raw?.video,
      vote_average: raw?.vote_average ?? 0,
      vote_count: raw?.vote_count ?? 0
    };
  }

  private parseTmdbDate(value?: string | null): Date | null {
    if (!value) return null;

    const d = new Date(value);

    return Number.isNaN(d.getTime()) ? null : d;
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