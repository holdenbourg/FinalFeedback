import { RatingModel } from "./rating.model";
import { ReviewModel } from "./review.model";
import { StreamModel } from "./stream.model";

export interface MovieResponseModel {
    title: string,
    year: number,
    released: string,
    released_digital: string,
    description: string,
    runtime: number,
    score: number,
    score_average: number,
    imdbid: string,
    traktid: number,
    tmdbid: number,
    type: string,
    ratings: RatingModel[],
    streams: StreamModel[],
    watch_providers: StreamModel[],
    reviews: ReviewModel[],
    keywords: StreamModel[],
    language: string,
    spoken_language: string,
    country: string,
    certification: string,
    commonsense: number,
    age_rating: number, 
    status: string,
    trailer: string,
    poster: string,
    backdrop: string,
    response: boolean,
    apiused: number
}