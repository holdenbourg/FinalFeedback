import { RatingModel } from "./mdb-models/rating.model";
import { StreamModel } from "./mdb-models/stream.model";
import { BelongsToCollectionModel } from "./tmdb-models/belongs-to-collection.model";
import { GenreModel } from "./tmdb-models/genre.model";
import { ProductionCompanyModel } from "./tmdb-models/production-company.model";
import { ProductionCountryModel } from "./tmdb-models/production-country.model";
import { SpokenLanguageModel } from "./tmdb-models/spoken-language.model";

export interface MovieDetailsPageModel {
    // TMDB
    backdrop_path: string;
    id: number;
    media_type: 'movie';
    overview: string;
    poster_path: string;
    belongs_to_collection: BelongsToCollectionModel | null;
    genres: GenreModel[];
    budget: number;
    homepage: string;
    imdb_id: string;
    production_companies: ProductionCompanyModel[];
    production_countries: ProductionCountryModel[];
    release_date: Date | null;
    revenue: number;
    runtime: number;
    spoken_languages: SpokenLanguageModel[];
    tagline: string;
    title: string;
    vote_average: number;
  
    // OMDb
    rated: string;
    director: string;
    writer: string;
    awards: string;
    ratings: RatingModel[];
  
    // MDB
    watch_providers: StreamModel[];
    trailer: string;
  }