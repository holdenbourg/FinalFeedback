import { CreatedByModel } from "./created-by.model"
import { GenreModel } from "./genre.model"
import { LastEpisodeToAirModel } from "./last-episode-to-air.model"
import { NetworkModel } from "./network.model"
import { ProductionCompanyModel } from "./production-company.model"
import { ProductionCountryModel } from "./production-country.model"
import { SeasonModel } from "./season.model"
import { SpokenLanguageModel } from "./spoken-language.model"

export interface TvDetailsResponseModel {
    adult: boolean,
    backdrop_path: string,
    created_by: CreatedByModel[],
    episode_run_time: number[] | null,
    first_air_date: Date | null,
    genres: GenreModel[],
    homepage: string,
    id: number,
    in_production: boolean,
    languages: string[],
    last_air_date: Date | null,
    last_episode_to_air: LastEpisodeToAirModel,
    name: string,
    next_episode_to_air: string | null,
    networks: NetworkModel[],
    number_of_episodes: number,
    number_of_seasons: number,
    origin_country: string[],
    original_language: string,
    original_name: string,
    overview: string,
    popularity: number,
    poster_path: string,
    production_companies: ProductionCompanyModel[],
    production_countries: ProductionCountryModel[],
    seasons: SeasonModel[],
    spoken_languages: SpokenLanguageModel[],
    status: string,
    tagline: string,
    type: string,
    vote_average: number,
    vote_count: number
}