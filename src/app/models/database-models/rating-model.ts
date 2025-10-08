export interface RatingModel {
  id: string;
  user_id: string;
  media_type: 'movie' | 'series';
  media_id: string;
  title: string;
  release_date: string;
  rating: number;
  criteria: {
    acting?: number;
    visuals?: number;
    story?: number;
    climax?: number;
    pacing?: number;
    ending?: number;
    length?: number;
    seasons?: number;
    episodes?: number;
  };
  date_rated: string;
}