import { SearchApiResponseModel } from './search-api-response.model';
import { MovieSearchResposneModel } from './movie-search-response.model';
import { TvSearchResposneModel } from './tv-search-response.model';
import { PersonSearchResposneModel } from './person-search-response.model';
import { MultiSearchMediaResultModel } from './multi-search-media-result.model';
import { MultiSearchPersonResultModel } from './multi-search-person-result.model';

export type MultiSearchResultModel = MultiSearchMediaResultModel | MultiSearchPersonResultModel;

export type MovieSearchApiResponseModel = SearchApiResponseModel<MovieSearchResposneModel>;
export type TvSearchApiResponseModel = SearchApiResponseModel<TvSearchResposneModel>;
export type PersonSearchApiResponseModel = SearchApiResponseModel<PersonSearchResposneModel>;
export type MultiSearchApiResponseModel = SearchApiResponseModel<MultiSearchResultModel>;