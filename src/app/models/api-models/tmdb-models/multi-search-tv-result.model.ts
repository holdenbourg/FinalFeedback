export interface MultiSearchTvResultModel {
  adult?: boolean,
  backdrop_path: string | null,
  id:  number,
  name: string,
  original_name: string,
  overview: string,
  poster_path: string | null,
  media_type: 'tv',
  original_language: string,
  genre_ids: number[],
  popularity: number,
  first_air_date: Date | null,
  vote_average: number,
  vote_count: number,
  origin_country: string[]
}
