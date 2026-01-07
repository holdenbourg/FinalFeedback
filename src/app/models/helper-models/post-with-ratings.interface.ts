import { PostRating } from "../../services/ratings.service";
import { UserModel } from "../database-models/user.model";
import { TaggedUser } from "./film-data.model";

export interface PostWithRating {
  post: {
    id: string;
    author_id: string;
    poster_url: string;
    caption: string | null;
    visibility: 'public' | 'archived';
    like_count: number;
    save_count: number;
    comment_count: number;
    tag_count: number;
    created_at: string;
  };
  rating: PostRating;
  author: UserModel;
  taggedUsers: TaggedUser[];
}