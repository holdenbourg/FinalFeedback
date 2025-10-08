export interface RatingModel {
  id: string;
  user_id: string;
  media_type: MediaType;
  media_id: string;
  title: string;
  release_date: string | null;
  rating: number;
  criteria: MovieCriteria | SeriesCriteria;
  date_rated: string;
}

export type MediaType = 'movie' | 'series';

export interface BaseCriteria {
  acting: number;
  visuals: number;
  story: number;
  pacing: number;
  ending: number;
}

export interface MovieCriteria extends BaseCriteria {
  climax: number;
  length: number;
}

export interface SeriesCriteria extends BaseCriteria {
  length: number;
  seasons: number;
  episodes: number;
}