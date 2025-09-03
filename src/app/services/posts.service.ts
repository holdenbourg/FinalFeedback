import { inject, Injectable } from "@angular/core";
import { LocalStorageService } from "./local-storage.service";
import { PostsDatabase } from "../databases/posts-database";
import { RatedMovieModel } from "../models/database-models/rated-movie-model";
import { RatedSeriesModel } from "../models/database-models/rated-series-model";
import { RawPostModel } from "../models/database-models/raw-post-model";
import { UserPostModel } from "../models/database-models/post-model";
import { UsersService } from "./users.service";

@Injectable({ providedIn: 'root' })
export class PostsService {
    private localStorageService: LocalStorageService = inject(LocalStorageService);
    private postsDatabase: PostsDatabase = inject(PostsDatabase);

    private usersService = inject(UsersService);

    likePost(username: string, postId: string) {
        let post = this.postsDatabase.getPostById(postId);

        if (!post) return;

        if (!post.likes.includes(username)) post.likes.push(username);

        this.postsDatabase.replacePostInDatabase(post);
    }
    unlikePost(username: string, postId: string) {
        let post = this.postsDatabase.getPostById(postId);

        if (!post) return;

        post.likes = post.likes.filter(user => user !== username);

        this.postsDatabase.replacePostInDatabase(post);
    }
    togglePostLike(username: string, post: UserPostModel): UserPostModel {
        if (post.likes.includes(username)) {
            this.unlikePost(username, post.postId);
            return { ...post, likes: post.likes.filter(u => u !== username) };
        } else {
            this.likePost(username, post.postId);
            return { ...post, likes: [...post.likes, username] };
        }
    }

    addUsernameToSeenBy(username: string, postId: string) {
        let post = this.postsDatabase.getPostById(postId);

        if (!post) return;

        if(!post.seenBy.includes(username)) post.seenBy.push(username);

        this.postsDatabase.replacePostInDatabase(post);
    }

    sharePost(sherer: string, sharee: string, postId: string) {
        //! Not implemented yet
    }

    savePost(postId: string) {
        //! Not implemented yet
    }

    convertRawPostToPost(rawPost: RawPostModel) {
        let post: UserPostModel = {
            postId: rawPost.postId,
            profilePicture: rawPost.profilePicture,
            username: rawPost.username,
            poster: rawPost.poster,
            caption: rawPost.caption,
            likes: rawPost.likes,
            taggedUsers: this.usersService.convertRawFollowersToFollowers(rawPost.taggedUsers),
            postDate: rawPost.postDate,
            seenBy: []
        }

        return post;
    }
    convertPostToRawPost(post: UserPostModel) {
        let rawPost: RawPostModel = {
            postId: post.postId,
            profilePicture: post.profilePicture,
            username: post.username,
            poster: post.poster,
            caption: post.caption,
            likes: post.likes,
            taggedUsers: this.usersService.convertFollowersToRawFollowers(post.taggedUsers),
            postDate: post.postDate,
            seenBy: []
        }

        return rawPost;
    }

    generateUniquePostId(type: string) {
        if (type === 'm') {
            let allRatedMovies: RatedMovieModel[] = this.localStorageService.getInformation('rated-movies');

            let ratedMovieId: string = 'm' + Math.random().toString(16).slice(2);
            let isUnique: boolean = false;

            while (!isUnique) {
                for (let i = 0; i < allRatedMovies.length; i++) {
                    if (allRatedMovies[i].postId == ratedMovieId) {
                        ratedMovieId = 'm' + Math.random().toString(16).slice(2);
                        break;
                        
                    } else if (i == (allRatedMovies.length - 1) && allRatedMovies[i].postId != ratedMovieId) {
                        isUnique = true;
                    }
                }
            }

            return ratedMovieId;
        } else if (type === 's') {
            let allRatedSeries: RatedSeriesModel[] = this.localStorageService.getInformation('rated-series');

            let ratedSeriesId: string = 's' + Math.random().toString(16).slice(2);
            let isUnique: boolean = false;

            while(!isUnique) {
                for (let i = 0; i < allRatedSeries.length; i++) {
                    if (allRatedSeries[i].postId == ratedSeriesId) {
                        ratedSeriesId = 's' + Math.random().toString(16).slice(2);
                        break;

                    } else if (i == (allRatedSeries.length - 1) && allRatedSeries[i].postId != ratedSeriesId) {
                        isUnique = true;
                    }
                }
            }

            return ratedSeriesId;
        }

        return;
    }
}