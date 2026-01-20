import { MovieCriteria, SeriesCriteria } from "../database-models/rating.model";

export type FilmType = 'movie' | 'series';

export interface FilmData {
  // Basic film info
  imdbId: string;
  title: string;
  poster: string;
  type: FilmType;
  criteria: MovieCriteria | SeriesCriteria;
  rating: number;
  dateRated: string;
  releaseDate: Date | null;
  rated: string | null;  // PG, PG-13, R, TV-MA, etc.
  genres: string[];
}

export interface TaggedUser {
  id: string;
  username: string;
  profile_picture_url: string | null;
}