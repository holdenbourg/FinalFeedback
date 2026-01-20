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
import { PeopleCombinedCreditsModel } from '../models/api-models/tmdb-models/people-combined-credits.model';
import { PeopleDetailsModel } from '../models/api-models/tmdb-models/people-details.model';
import { MovieCastModel } from '../models/api-models/tmdb-models/movie-cast.model';
import { MovieCrewModel } from '../models/api-models/tmdb-models/movie-crew.model';
import { TvCastModel } from '../models/api-models/tmdb-models/tv-cast.model';
import { TvCrewModel } from '../models/api-models/tmdb-models/tv-crew.model';
import { TvSeriesDetailsResponseModel } from '../models/api-models/tmdb-models/tv-series-deatils-response.model';
import { LastEpisodeToAirModel } from '../models/api-models/tmdb-models/last-episode-to-air.model';
import { TvSeasonDetailsResponseModel } from '../models/api-models/tmdb-models/tv-season-details-response.model';
import { SeasonEpisodeModel } from '../models/api-models/tmdb-models/season-episode.model';

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
  
  ///==-  Movie Details  -==\\\
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

  ///==-  TV Series Details  -==\\\
  getTvSeriesDetailsTmdb(seriesId: number, language: string = environment.tmdb.language ?? 'en-US'): Observable<TvSeriesDetailsResponseModel> {
    const url = `${environment.tmdb.baseUrl}/tv/${seriesId}`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', language);

    return this.http.get<any>(url, { params }).pipe(
      map(raw => this.mapTvDetails(raw)),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getTvDetailsTmdb error', err);
        return of(this.mapTvDetails({ id: seriesId }));
      })
    );
  }

  private mapTvDetails(raw: any): TvSeriesDetailsResponseModel {
    const showId = raw?.id ?? 0;

    return {
      adult: !!raw?.adult,
      backdrop_path: raw?.backdrop_path ?? '',

      created_by: Array.isArray(raw?.created_by)
        ? raw.created_by.map((cb: any) => ({
            id: cb?.id ?? 0,
            credit_id: cb?.credit_id ?? '',
            name: cb?.name ?? '',
            original_name: cb?.original_name ?? '',
            gender: cb?.gender ?? 0,
            profile_path: cb?.profile_path ?? null
          }))
        : [],

      episode_run_time: Array.isArray(raw?.episode_run_time)
        ? raw.episode_run_time
        : null,

      first_air_date: this.parseTmdbDate(raw?.first_air_date),

      genres: Array.isArray(raw?.genres)
        ? raw.genres.map((g: any) => ({
            id: g?.id ?? 0,
            name: g?.name ?? ''
          }))
        : [],

      homepage: raw?.homepage ?? '',
      id: showId,
      in_production: !!raw?.in_production,
      languages: Array.isArray(raw?.languages) ? raw.languages : [],
      last_air_date: this.parseTmdbDate(raw?.last_air_date),

      last_episode_to_air: raw?.last_episode_to_air
        ? this.mapTvEpisode(raw.last_episode_to_air, showId)
        : null,

      name: raw?.name ?? '',

      next_episode_to_air: raw?.next_episode_to_air
        ? this.mapTvEpisode(raw.next_episode_to_air, showId)
        : null,

      networks: Array.isArray(raw?.networks)
        ? raw.networks.map((n: any) => ({
            id: n?.id ?? 0,
            logo_path: n?.logo_path ?? '',
            name: n?.name ?? '',
            origin_country: n?.origin_country ?? ''
          }))
        : [],

      number_of_episodes: raw?.number_of_episodes ?? 0,
      number_of_seasons: raw?.number_of_seasons ?? 0,
      origin_country: Array.isArray(raw?.origin_country) ? raw.origin_country : [],
      original_language: raw?.original_language ?? '',
      original_name: raw?.original_name ?? '',
      overview: raw?.overview ?? '',
      popularity: raw?.popularity ?? 0,
      poster_path: raw?.poster_path ?? '',

      production_companies: Array.isArray(raw?.production_companies)
        ? raw.production_companies.map((c: any) => ({
            id: c?.id ?? 0,
            logo_path: c?.logo_path ?? null,
            name: c?.name ?? '',
            origin_country: c?.origin_country ?? ''
          }))
        : [],

      production_countries: Array.isArray(raw?.production_countries)
        ? raw.production_countries.map((c: any) => ({
            iso_3166_1: c?.iso_3166_1 ?? '',
            name: c?.name ?? ''
          }))
        : [],

      seasons: Array.isArray(raw?.seasons)
        ? raw.seasons.map((s: any) => ({
            air_date: this.parseTmdbDate(s?.air_date),
            episode_count: s?.episode_count ?? 0,
            id: s?.id ?? 0,
            name: s?.name ?? '',
            overview: s?.overview ?? '',
            poster_path: s?.poster_path ?? '',
            season_number: s?.season_number ?? 0,
            vote_average: s?.vote_average ?? 0
          }))
        : [],

      spoken_languages: Array.isArray(raw?.spoken_languages)
        ? raw.spoken_languages.map((l: any) => ({
            english_name: l?.english_name ?? '',
            iso_639_1: l?.iso_639_1 ?? '',
            name: l?.name ?? ''
          }))
        : [],

      status: raw?.status ?? '',
      tagline: raw?.tagline ?? '',
      type: raw?.type ?? '',
      vote_average: raw?.vote_average ?? 0,
      vote_count: raw?.vote_count ?? 0
    };
  }


  private mapTvEpisode(rawEp: any, fallbackShowId: number): LastEpisodeToAirModel {
    return {
      id: rawEp?.id ?? 0,
      name: rawEp?.name ?? '',
      overview: rawEp?.overview ?? '',
      vote_average: rawEp?.vote_average ?? 0,
      vote_count: rawEp?.vote_count ?? 0,
      air_date: this.parseTmdbDate(rawEp?.air_date),
      episode_number: rawEp?.episode_number ?? 0,
      episode_type: rawEp?.episode_type ?? '',
      production_code: rawEp?.production_code ?? '',
      runtime: rawEp?.runtime ?? 0,
      season_number: rawEp?.season_number ?? 0,
      show_id: rawEp?.show_id ?? fallbackShowId,
      still_path: rawEp?.still_path ?? null
    };
  }

  getTvExternalIdsTmdb(seriesId: number): Observable<{ imdb_id: string | null }> {
    const url = `${environment.tmdb.baseUrl}/tv/${seriesId}/external_ids`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey);

    return this.http.get<any>(url, { params }).pipe(
      map(raw => ({
        imdb_id: raw?.imdb_id || null
      })),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getTvExternalIdsTmdb error', err);
        return of({ imdb_id: null });
      })
    );
  }

  ///==-  TV Series Season Details  -==\\\
  getTvSeriesSeasonDetailsTmdb(seriesId: number, seasonNumber: number, language: string = environment.tmdb.language ?? 'en-US'): Observable<TvSeasonDetailsResponseModel> {
    const url = `${environment.tmdb.baseUrl}/tv/${seriesId}/season/${seasonNumber}`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', language);

    return this.http.get<any>(url, { params }).pipe(
      map(raw => this.mapTvSeasonDetails(raw, seriesId)),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getTvSeasonDetailsTmdb error', err);
        return of(this.mapTvSeasonDetails({ season_number: seasonNumber }, seriesId));
      })
    );
  }

  private mapTvSeasonDetails(raw: any, showId: number): TvSeasonDetailsResponseModel {
    return {
      _id: raw?._id ?? '',
      air_date: this.parseTmdbDate(raw?.air_date),

      episodes: Array.isArray(raw?.episodes)
        ? raw.episodes.map((ep: any) => this.mapTvSeasonEpisode(ep, showId))
        : [],

      id: raw?.id ?? 0,
      name: raw?.name ?? '',
      overview: raw?.overview ?? '',
      poster_path: raw?.poster_path ?? '',
      season_number: raw?.season_number ?? 0,
      networks: Array.isArray(raw?.networks)
        ? raw.networks.map((n: any) => ({
            id: n?.id ?? 0,
            logo_path: n?.logo_path ?? '',
            name: n?.name ?? '',
            origin_country: n?.origin_country ?? ''
          }))
        : [],

      vote_average: raw?.vote_average ?? 0
    };
  }

  private mapTvSeasonEpisode(rawEp: any, showId: number): SeasonEpisodeModel {
    return {
      air_date: this.parseTmdbDate(rawEp?.air_date),
      episode_number: rawEp?.episode_number ?? 0,
      id: rawEp?.id ?? 0,
      name: rawEp?.name ?? '',
      overview: rawEp?.overview ?? '',
      production_code: rawEp?.production_code ?? '',
      runtime: rawEp?.runtime ?? 0,
      season_number: rawEp?.season_number ?? 0,
      show_id: rawEp?.show_id ?? showId,
      still_path: rawEp?.still_path ?? null,
      vote_average: rawEp?.vote_average ?? 0,
      vote_count: rawEp?.vote_count ?? 0,
      episode_type: rawEp?.episode_type ?? '',

      crew: Array.isArray(rawEp?.crew)
        ? rawEp.crew.map((c: any) => ({
            id: c?.id ?? 0,
            credit_id: c?.credit_id ?? '',
            department: c?.department ?? '',
            job: c?.job ?? '',
            name: c?.name ?? '',
            original_name: c?.original_name ?? '',
            profile_path: c?.profile_path ?? null
          }))
        : [],

      guest_stars: Array.isArray(rawEp?.guest_stars)
        ? rawEp.guest_stars.map((g: any) => ({
            id: g?.id ?? 0,
            name: g?.name ?? '',
            original_name: g?.original_name ?? '',
            credit_id: g?.credit_id ?? '',
            character: g?.character ?? '',
            order: g?.order ?? 0,
            profile_path: g?.profile_path ?? null
          }))
        : []
    };
  }

  ///==-  People Details  -==\\\
  getPersonDetailsTmdb(personId: number, language: string = environment.tmdb.language ?? 'en-US'): Observable<PeopleDetailsModel> {
    const url = `${environment.tmdb.baseUrl}/person/${personId}`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', language);

    return this.http.get<any>(url, { params }).pipe(
      map((raw) => ({
        adult: !!raw?.adult,
        also_known_as: Array.isArray(raw?.also_known_as) ? raw.also_known_as : [],
        biography: raw?.biography ?? '',
        birthday: this.parseTmdbDate(raw?.birthday),
        deathday: this.parseTmdbDate(raw?.deathday),
        gender: raw?.gender ?? 0,
        homepage: raw?.homepage ?? '',
        id: raw?.id ?? personId,
        imdb_id: raw?.imdb_id ?? '',
        known_for_department: raw?.known_for_department ?? '',
        name: raw?.name ?? '',
        place_of_birth: raw?.place_of_birth ?? '',
        popularity: raw?.popularity ?? 0,
        profile_path: raw?.profile_path ?? '' // TMDB may return null
      } as PeopleDetailsModel)),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getPersonDetailsTmdb error', err);
        return of({
          adult: false,
          also_known_as: [],
          biography: '',
          birthday: null,
          deathday: null,
          gender: 0,
          homepage: '',
          id: personId,
          imdb_id: '',
          known_for_department: '',
          name: '',
          place_of_birth: '',
          popularity: 0,
          profile_path: ''
        } as PeopleDetailsModel);
      })
    );
  }

  ///==-  People Combined Credits  -==\\\
  getPersonCombinedCreditsTmdb(personId: number, language: string = environment.tmdb.language ?? 'en-US'): Observable<PeopleCombinedCreditsModel> {
    const url = `${environment.tmdb.baseUrl}/person/${personId}/combined_credits`;

    const params = new HttpParams()
      .set('api_key', environment.tmdb.apiKey)
      .set('language', language);

    return this.http.get<any>(url, { params }).pipe(
      map((raw) => ({
        id: raw?.id ?? personId,
        cast: Array.isArray(raw?.cast) ? raw.cast.map((c: any) => this.mapPersonCombinedCast(c)) : [],
        crew: Array.isArray(raw?.crew) ? raw.crew.map((c: any) => this.mapPersonCombinedCrew(c)) : []
      } as PeopleCombinedCreditsModel)),
      catchError((err: HttpErrorResponse) => {
        console.error('[ApiService] getPersonCombinedCreditsTmdb error', err);
        return of({ id: personId, cast: [], crew: [] } as PeopleCombinedCreditsModel);
      })
    );
  }

  private mapPersonCombinedCast(raw: any): MovieCastModel | TvCastModel {
    if (raw?.media_type === 'tv') {
      return {
        adult: !!raw?.adult,
        backdrop_path: raw?.backdrop_path ?? null,
        genre_ids: raw?.genre_ids ?? [],
        id: raw?.id ?? 0,
        origin_country: raw?.origin_country ?? [],
        original_language: raw?.original_language ?? '',
        original_name: raw?.original_name ?? '',
        overview: raw?.overview ?? '',
        popularity: raw?.popularity ?? 0,
        poster_path: raw?.poster_path ?? '',
        first_air_date: this.parseTmdbDate(raw?.first_air_date),
        name: raw?.name ?? '',
        vote_average: raw?.vote_average ?? 0,
        vote_count: raw?.vote_count ?? 0,
        character: raw?.character ?? '',
        credit_id: raw?.credit_id ?? '',
        episode_count: raw?.episode_count ?? 0,
        first_credit_air_date: this.parseTmdbDate(raw?.first_credit_air_date),
        media_type: 'tv'
      } as TvCastModel;
    }

    // default to movie
    return {
      adult: !!raw?.adult,
      backdrop_path: raw?.backdrop_path ?? '',
      genre_ids: raw?.genre_ids ?? [],
      id: raw?.id ?? 0,
      original_language: raw?.original_language ?? '',
      original_title: raw?.original_title ?? '',
      overview: raw?.overview ?? '',
      popularity: raw?.popularity ?? 0,
      poster_path: raw?.poster_path ?? '',
      release_date: this.parseTmdbDate(raw?.release_date),
      title: raw?.title ?? '',
      video: !!raw?.video,
      vote_average: raw?.vote_average ?? 0,
      vote_count: raw?.vote_count ?? 0,
      character: raw?.character ?? '',
      credit_id: raw?.credit_id ?? '',
      order: raw?.order ?? 0,
      media_type: 'movie'
    } as MovieCastModel;
  }

  private mapPersonCombinedCrew(raw: any): MovieCrewModel | TvCrewModel {
    if (raw?.media_type === 'tv') {
      return {
        adult: !!raw?.adult,
        backdrop_path: raw?.backdrop_path ?? '',
        genre_ids: raw?.genre_ids ?? [],
        id: raw?.id ?? 0,
        origin_country: raw?.origin_country ?? [],
        original_language: raw?.original_language ?? '',
        original_name: raw?.original_name ?? '',
        overview: raw?.overview ?? '',
        popularity: raw?.popularity ?? 0,
        poster_path: raw?.poster_path ?? '',
        first_air_date: this.parseTmdbDate(raw?.first_air_date),
        name: raw?.name ?? '',
        vote_average: raw?.vote_average ?? 0,
        vote_count: raw?.vote_count ?? 0,
        credit_id: raw?.credit_id ?? '',
        department: raw?.department ?? '',
        episode_count: raw?.episode_count ?? 0,
        first_credit_air_date: this.parseTmdbDate(raw?.first_credit_air_date),
        job: raw?.job ?? '',
        media_type: 'tv'
      } as TvCrewModel;
    }

    // default to movie
    return {
      adult: !!raw?.adult,
      backdrop_path: raw?.backdrop_path ?? '',
      genre_ids: raw?.genre_ids ?? [],
      id: raw?.id ?? 0,
      original_language: raw?.original_language ?? '',
      original_title: raw?.original_title ?? '',
      overview: raw?.overview ?? '',
      popularity: raw?.popularity ?? 0,
      poster_path: raw?.poster_path ?? '',
      release_date: this.parseTmdbDate(raw?.release_date),
      title: raw?.title ?? '',
      video: !!raw?.video,
      vote_average: raw?.vote_average ?? 0,
      vote_count: raw?.vote_count ?? 0,
      credit_id: raw?.credit_id ?? '',
      department: raw?.department ?? '',
      job: raw?.job ?? '',
      media_type: 'movie'
    } as MovieCrewModel;
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