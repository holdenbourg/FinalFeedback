import { KnownForPersonSearchResposneModel } from "./known-for-person-search-response.model";

export interface PersonSearchResposneModel {
    adult?: boolean,
    gender: number,
    id: number,
    known_for_department: string,
    name: string,
    original_name: string,
    popularity: number,
    profile_path: string | null;
    known_for: KnownForPersonSearchResposneModel[]
}