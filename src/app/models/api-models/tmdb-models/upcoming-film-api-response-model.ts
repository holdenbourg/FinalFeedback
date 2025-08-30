import { UpcomingFilmDatesModel } from "./upcoming-film-dates-model"
import { UpcomingFilmModel } from "./upcoming-film-model"

export interface UpcomingFilmApiResponseModel {
    dates: UpcomingFilmDatesModel,
    page: number,
    results: UpcomingFilmModel[],
    total_pages: number,
    total_results: number
}