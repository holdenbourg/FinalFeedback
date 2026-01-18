import { MovieCastModel } from "./movie-cast.model";
import { TvCastModel } from "./tv-cast.model";
import { MovieCrewModel } from "./movie-crew.model";
import { TvCrewModel } from "./tv-crew.model";

export type PeopleCastCredit = MovieCastModel | TvCastModel;
export type PeopleCrewCredit = MovieCrewModel | TvCrewModel;

export interface PeopleCombinedCreditsModel {
  cast: PeopleCastCredit[];
  crew: PeopleCrewCredit[];
  id: number;
}