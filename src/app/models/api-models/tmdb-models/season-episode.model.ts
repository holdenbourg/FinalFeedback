import { SeasonEpisodeCrewModel } from "./season-episode-crew.model";
import { SeasonEpisodeGuestStartModel } from "./season-episode-guest-star.model";

export interface SeasonEpisodeModel {
    air_date: Date | null,
    episode_number: number,
    episode_type: string,
    id: number,
    name: string,
    overview: string,
    production_code: string,
    runtime: number,
    season_number: number,
    show_id: number,
    still_path: string,
    vote_average: number,
    vote_count: number,
    crew: SeasonEpisodeCrewModel[],
    guest_stars: SeasonEpisodeGuestStartModel[],    
}