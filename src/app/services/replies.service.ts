import { inject, Injectable } from "@angular/core";
import { LocalStorageService } from "./local-storage.service";
import { RepliesDatabase } from "../databases/replies-database";
import { ReplyModel } from "../models/database-models/reply-model";
import { Subject } from "rxjs";

@Injectable({ providedIn: 'root' })
export class RepliesService {
    private localStorageService: LocalStorageService = inject(LocalStorageService);
    private repliesDatabase: RepliesDatabase = inject(RepliesDatabase);

    postId: string | null = null;
    commentId: string | null = null;
    replyingToUsername: string | null = null;

    private replyChangedSubject = new Subject<{ commentId: string; replyId?: string }>();
    replyChanged$ = this.replyChangedSubject.asObservable();


    setReplyContext(postId: string, commentId: string, username: string) {
        this.postId = postId;
        this.commentId = commentId;
        this.replyingToUsername = username;
    }
    clearReplyContext() {
        this.postId = this.commentId = this.replyingToUsername = null;
    }

    addReply(newReply: ReplyModel) {
        this.repliesDatabase.addReplyToDatabase(newReply);
        this.replyChangedSubject.next({ commentId: newReply.commentId, replyId: newReply.replyId });
    }

    likeReply(username: string, replyId: string): boolean {
        const reply = this.repliesDatabase.getReplyById(replyId);

        if (!reply) return false;
        if (reply.likes.includes(username)) return false;

        reply.likes = [...reply.likes, username];
        this.repliesDatabase.replaceReplyInDatabase(reply);

        return true;
    }
    unlikeReply(username: string, replyId: string): boolean {
        const reply = this.repliesDatabase.getReplyById(replyId);

        if (!reply) return false;
        if (!reply.likes.includes(username)) return false;

        reply.likes = reply.likes.filter(u => u !== username);
        this.repliesDatabase.replaceReplyInDatabase(reply);

        return true;
    }
    toggleReplyLike(username: string, reply: ReplyModel): ReplyModel {
        if (reply.likes.includes(username)) {
            this.unlikeReply(username, reply.replyId);
            return { ...reply, likes: reply.likes.filter(u => u !== username) };
        } else {
            this.likeReply(username, reply.replyId);
            return  { ...reply, likes: [...reply.likes, username] };
        }
    }

    generateUniqueReplyId() {
        let allReplies: ReplyModel[] = this.localStorageService.getInformation('replies');

        let replyId: string = 'r' + Math.random().toString(16).slice(2);
        let isUnique: boolean = false;

        while (!isUnique) {
            for (let i = 0; i < allReplies.length; i++) {
                if (allReplies[i].replyId == replyId) {
                    replyId = 'r' + Math.random().toString(16).slice(2);
                    break;
                } else if (i == (allReplies.length - 1) && allReplies[i].replyId != replyId) {
                    isUnique = true;
                }
            }
        }

        return replyId;
    }
}