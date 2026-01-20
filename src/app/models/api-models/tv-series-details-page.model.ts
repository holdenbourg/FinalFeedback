import { RatingModel } from "./mdb-models/rating.model";
import { StreamModel } from "./mdb-models/stream.model";
import { CreatedByModel } from "./tmdb-models/created-by.model";
import { GenreModel } from "./tmdb-models/genre.model";
import { LastEpisodeToAirModel } from "./tmdb-models/last-episode-to-air.model";
import { ProductionCompanyModel } from "./tmdb-models/production-company.model";
import { ProductionCountryModel } from "./tmdb-models/production-country.model";
import { SeasonModel } from "./tmdb-models/season.model";
import { SpokenLanguageModel } from "./tmdb-models/spoken-language.model";

export interface TvSeriesDetailsPageModel {
    //TMDb
    imdb_id: string,
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
    last_episode_to_air: LastEpisodeToAirModel | null,
    name: string,
    next_episode_to_air: LastEpisodeToAirModel | null,
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

    // OMDb
    boxOffice: number,
    rated: string,
    director: string,
    writer: string,
    awards: string,
    ratings: RatingModel[],
    
    // MDB
    watch_providers: StreamModel[],
    trailer: string,
}