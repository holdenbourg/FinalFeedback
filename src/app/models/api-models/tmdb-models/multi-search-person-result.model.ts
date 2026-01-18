import { MultiSearchMediaResultModel } from "./multi-search-media-result.model";

export interface MultiSearchPersonResultModel {
  adult?: boolean,
  id:  number,
  name: string,
  original_name: string,
  media_type: 'person',
  popularity: number,
  gender: number,
  known_for_department: string,
  profile_path: string | null,
  known_for: MultiSearchMediaResultModel[]
}