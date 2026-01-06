export interface RatingModel {
  id: string;
  user_id: string;
  media_type: 'movie' | 'series';
  media_id: string;
  title: string;
  release_date: string | null;
  rating: number;
  criteria: MovieCriteria | SeriesCriteria;
  date_rated: string;
  date_edited?: string | null;
  poster_url: string;
  rated?: string | null;
  genres: string[];
}
export interface BaseCriteria {
  acting: number;
  visuals: number;
  story: number;
  pacing: number;
  ending: number;
}

export interface MovieCriteria extends BaseCriteria {
  climax: number;
  runtime: number;
}

export interface SeriesCriteria extends BaseCriteria {
  length: number;
  seasons: number;
  episodes: number;
}