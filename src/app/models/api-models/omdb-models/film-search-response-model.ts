import { SearchedFilmModel } from "./searched-film-model";

export interface FilmSearchResposneModel {
    Response: string,
    Search: SearchedFilmModel[],
    toalResults: number
}