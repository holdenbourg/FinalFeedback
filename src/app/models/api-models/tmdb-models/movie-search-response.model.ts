export interface MovieSearchResposneModel {
    adult?: boolean,
    backdrop_path: string | null,
    genre_ids: number[],
    id: number,
    original_language: string,
    original_title: string,
    overview: string,
    popularity: number,
    poster_path: string | null,
    release_date: Date | null,
    title: string,
    video: boolean,
    vote_average: number,
    vote_count: number
}
      
