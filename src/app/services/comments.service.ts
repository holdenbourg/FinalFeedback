import { inject, Injectable } from "@angular/core";
import { LocalStorageService } from "./local-storage.service";
import { CommentModel } from "../models/database-models/comment-model";
import { CommentsDatabase } from "../databases/comments-database";

@Injectable({ providedIn: 'root' })
export class CommentsService {
    private localStorageService: LocalStorageService = inject(LocalStorageService);
    private commentsDatabase: CommentsDatabase = inject(CommentsDatabase);

    likeComment(username: string, commentId: string): boolean {
        const comment = this.commentsDatabase.getCommentById(commentId);

        if (!comment) return false;
        if (comment.likes.includes(username)) return false;

        const updated: CommentModel = { ...comment, likes: [...comment.likes, username] };
        this.commentsDatabase.replaceCommentInDatabase(updated);
        
        return true;
    }
    unlikeComment(username: string, commentId: string): boolean {
        const comment = this.commentsDatabase.getCommentById(commentId);

        if (!comment) return false;
        if (!comment.likes.includes(username)) return false;

        const updated: CommentModel = { ...comment, likes: comment.likes.filter(u => u !== username) };
        this.commentsDatabase.replaceCommentInDatabase(updated);

        return true;
    }
    toggleCommentLike(username: string, comment: CommentModel): CommentModel {
        if (comment.likes.includes(username)) {
            this.unlikeComment(username, comment.commentId);
            return { ...comment, likes: comment.likes.filter(u => u !== username) };
        } else {
            this.likeComment(username, comment.commentId);
            return { ...comment, likes: [...comment.likes, username] };
        }
    }

    generateUniqueCommentId() {
        let allComments: CommentModel[] = this.localStorageService.getInformation('comments');

        let commentId: string = 'c' + Math.random().toString(16).slice(2);
        let isUnique: boolean = false;

        while (!isUnique) {
            for (let i = 0; i < allComments.length; i++) {
                if (allComments[i].commentId == commentId) {
                    commentId = 'c' + Math.random().toString(16).slice(2);
                    break;

                } else if (i == (allComments.length - 1) && allComments[i].commentId != commentId) {
                    isUnique = true;
                }
            }
        }

        return commentId;
    }
}