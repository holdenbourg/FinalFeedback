import { BelongsToCollectionModel } from "./belongs-to-collection.model"
import { GenreModel } from "./genre.model"
import { ProductionCompanyModel } from "./production-company.model"
import { ProductionCountryModel } from "./production-country.model"
import { SpokenLanguageModel } from "./spoken-language.model"

export interface MovieDetailsResponseModel {
    adult: boolean,
    backdrop_path: string,
    belongs_to_collection: BelongsToCollectionModel | null,
    budget: number,
    genres: GenreModel[],
    homepage: string,
    id: number,
    imdb_id: string,
    origin_country: string[],
    original_language: string,
    original_title: string,
    overview: string,
    popularity: number,
    poster_path: string,
    production_companies: ProductionCompanyModel[],
    production_countries: ProductionCountryModel[],
    release_date: Date | null,
    revenue: number,
    runtime: number,
    spoken_languages: SpokenLanguageModel[],
    status: string,
    tagline: string,
    title: string,
    video: boolean,
    vote_average: number,
    vote_count: number
}