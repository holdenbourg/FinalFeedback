export interface LastEpisodeToAirModel {
    id: number,
    name: string,
    overview: string,
    vote_average: number,
    vote_count: number,
    air_date: Date | null,
    episode_number: number,
    episode_type: string,
    production_code: string,
    runtime: number,
    season_number: number,
    show_id: number,
    still_path: string
}