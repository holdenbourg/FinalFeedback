import { RatingModel } from "../mdb-models/rating.model";

export interface ExtensiveSearchFilmModel {
    Title: string,
    Year: number,
    Rated: string,
    Released: string,
    Runtime: string,
    Genre: string,
    Director: string,
    Writer: string,
    Actors: string,
    Plot: string,
    Language: string,
    Country: string,
    Awards: string,
    Poster: string,
    Ratings: RatingModel[],
    Metascore: number,
    imdbRating: number,
    imdbVotes: number,
    imdbID: string,
    Type: string,
    DVD: string,
    BoxOffice: string,
    Production: string,
    Website: string,
    Response: string
}