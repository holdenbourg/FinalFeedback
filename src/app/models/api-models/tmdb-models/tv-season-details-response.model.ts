import { NetworkModel } from "./network.model";
import { SeasonEpisodeModel } from "./season-episode.model";

export interface TvSeasonDetailsResponseModel {
    _id: string,
    air_date: Date | null;
    episodes: SeasonEpisodeModel[],
    name: string,
    networks: NetworkModel[],
    overview: string,
    id: number,
    poster_path: string,
    season_number: number,
    vote_average: number
}