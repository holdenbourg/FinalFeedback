import { inject, Injectable } from '@angular/core';
import { UsersDatabase } from '../databases/users-database';
import { RawAccountInformationModel } from '../models/database-models/raw-account-information-model';
import { FollowerModel } from '../models/database-models/follower-model';
import { AccountInformationModel } from '../models/database-models/account-information-model';

@Injectable({ providedIn: 'root' })
export class UsersService {
    private usersDatabase: UsersDatabase = inject(UsersDatabase);

    followUser(follower: string, followee: string) {
        let followerUser = this.usersDatabase.getUserByUsername(follower);
        let followeeUser = this.usersDatabase.getUserByUsername(followee);

        if (!followerUser || !followeeUser) return;

        if (!followerUser.following.includes(followeeUser.profilePicture + '::::' + followeeUser.username)) followerUser.following.push(followeeUser.profilePicture + '::::' + followeeUser.username);
        if (!followeeUser.followers.includes(followerUser.profilePicture + '::::' + followerUser.username)) followeeUser.followers.push(followerUser.profilePicture + '::::' + followerUser.username);

        let updatedUsers = [followerUser, followeeUser];

        this.usersDatabase.replaceMultipleUsersInDatabase(updatedUsers);
    }
    unfollowUser(unfollower: string, unfollowee: string) {
        let unfollowerUser = this.usersDatabase.getUserByUsername(unfollower);
        let unfolloweeUser = this.usersDatabase.getUserByUsername(unfollowee);

        if (!unfollowerUser || !unfolloweeUser) return;

        unfollowerUser.following = unfollowerUser.following.filter(user => user !== unfolloweeUser.profilePicture + '::::' + unfolloweeUser.username);
        unfolloweeUser.followers = unfolloweeUser.followers.filter(user => user !== unfollowerUser.profilePicture + '::::' + unfollowerUser.username);

        let updatedUsers = [unfollowerUser, unfolloweeUser];

        this.usersDatabase.replaceMultipleUsersInDatabase(updatedUsers);
    }

    acceptFollowRequest(acceptor: string, requester: string) {
        let acceptorUser = this.usersDatabase.getUserByUsername(acceptor);
        let requesterUser = this.usersDatabase.getUserByUsername(requester);

        if (!acceptorUser || !requesterUser) return;

        // Remove requester from requests
        acceptorUser.requests = acceptorUser.requests.filter(user => user !== requesterUser.profilePicture + '::::' + requesterUser.username);

        // Add the requester to acceptors followers
        if (!acceptorUser.followers.includes(requesterUser.profilePicture + '::::' + requesterUser.username)) acceptorUser.followers.push(requesterUser.profilePicture + '::::' + requesterUser.username);

        let updatedUsers = [acceptorUser, requesterUser];

        this.usersDatabase.replaceMultipleUsersInDatabase(updatedUsers);
    }
    declineFollowRequest(decliner: string, requester: string) {
        let declinerUser = this.usersDatabase.getUserByUsername(decliner);
        let requesterUser = this.usersDatabase.getUserByUsername(requester);

        if (!declinerUser || !requesterUser) return;

        // Remove requester from decliner's requests
        declinerUser.requests = declinerUser.requests.filter(user => user !== requesterUser.profilePicture + '::::' + requesterUser.username);

        this.usersDatabase.replaceUserInDatabase(declinerUser);
    }

    blockUser(blocker: string, blockee: string) {
        let blockerUser = this.usersDatabase.getUserByUsername(blocker);
        let blockeeUser = this.usersDatabase.getUserByUsername(blockee);

        if (!blockerUser || !blockeeUser) return;

        if (!blockerUser.blocked.includes(blockeeUser.profilePicture + '::::' + blockeeUser.username)) blockerUser.blocked.push(blockeeUser.profilePicture + '::::' + blockeeUser.username);
        if (!blockeeUser.isBlockedBy.includes(blockerUser.profilePicture + '::::' + blockerUser.username)) blockeeUser.isBlockedBy.push(blockerUser.profilePicture + '::::' + blockerUser.username);

        // Remove any following/follower/request relationships
        blockerUser.following = blockerUser.following.filter(user => user !== blockeeUser.profilePicture + '::::' + blockeeUser.username);
        blockerUser.followers = blockerUser.followers.filter(user => user !== blockeeUser.profilePicture + '::::' + blockeeUser.username);
        blockerUser.requests = blockerUser.requests.filter(user => user !== blockeeUser.profilePicture + '::::' + blockeeUser.username);

        blockeeUser.following = blockeeUser.following.filter(user => user !== blockerUser.profilePicture + '::::' + blockerUser.username);
        blockeeUser.followers = blockeeUser.followers.filter(user => user !== blockerUser.profilePicture + '::::' + blockerUser.username);
        blockeeUser.requests = blockeeUser.requests.filter(user => user !== blockerUser.profilePicture + '::::' + blockerUser.username);

        let updatedUsers = [blockerUser, blockeeUser];

        this.usersDatabase.replaceMultipleUsersInDatabase(updatedUsers);
    }
    unblockUser(unblocker: string, unblockee: string) {
        let unblockerUser = this.usersDatabase.getUserByUsername(unblocker);
        let unblockeeUser = this.usersDatabase.getUserByUsername(unblockee);

        if (!unblockerUser || !unblockeeUser) return;

        unblockerUser.blocked = unblockerUser.blocked.filter(user => user !== unblockeeUser.profilePicture + '::::' + unblockeeUser.username);
        unblockerUser.isBlockedBy = unblockerUser.isBlockedBy.filter(user => user !== unblockeeUser.profilePicture + '::::' + unblockeeUser.username);

        unblockeeUser.blocked = unblockeeUser.blocked.filter(user => user !== unblockerUser.profilePicture + '::::' + unblockerUser.username);
        unblockeeUser.isBlockedBy = unblockeeUser.isBlockedBy.filter(user => user !== unblockerUser.profilePicture + '::::' + unblockerUser.username);

        let updatedUsers = [unblockerUser, unblockeeUser];

        this.usersDatabase.replaceMultipleUsersInDatabase(updatedUsers);
    }

    usernameExists(username: string) {
        return this.usersDatabase.getUserByUsername(username) !== undefined;
    }
    usernameExistsCaseInsensitive(raw: string): boolean {
        return this.getCanonicalUsername(raw) !== null;
    }
    emailExists(email: string) {
        return this.usersDatabase.getUserByEmail(email) !== undefined;
    }

    getCanonicalUsername(rawUsername: string): string | null {
        if (!rawUsername) return null;

        const lowerCaseUsername = rawUsername.toLowerCase();

        const allUsers = this.usersDatabase.getAllUsersFromDatabase?.() ?? [];
        const hit = allUsers.find(user => (user.username ?? '').toLowerCase() === lowerCaseUsername);
        
        return hit?.username ?? null;
    }

    getAllUsersCanonicalMap(): Map<string, string> {
        const usernameMap = new Map<string, string>();
        const allUsers = this.usersDatabase.getAllUsersFromDatabase?.() ?? [];

        for (const user of allUsers) {
            const username = user?.username;

            if (username) usernameMap.set(username.toLowerCase(), username);
        }

        return usernameMap;
    }

    convertRawUserToUser(rawUser: RawAccountInformationModel) {
        let user: AccountInformationModel = {
            profilePicture: rawUser.profilePicture,
            username: rawUser.username,
            password: rawUser.password,
            email: rawUser.email,
            firstName: rawUser.firstName,
            lastName: rawUser.lastName,
            bio: rawUser.bio,
            followers: this.convertRawFollowersToFollowers(rawUser.followers),
            following: this.convertRawFollowersToFollowers(rawUser.following),
            requests: this.convertRawFollowersToFollowers(rawUser.requests),
            blocked: this.convertRawFollowersToFollowers(rawUser.blocked),
            isBlockedBy: this.convertRawFollowersToFollowers(rawUser.isBlockedBy),
            postIds: rawUser.postIds,
            taggedPostIds: rawUser.taggedPostIds,
            archivedPostIds: rawUser.archivedPostIds,
            dateJoined: rawUser.dateJoined,
            private: rawUser.private
        }

        return user;
    }
    convertUserToRawUser(user: AccountInformationModel) {
        let rawUser: RawAccountInformationModel = {
            profilePicture: user.profilePicture,
            username: user.username,
            password: user.password,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            followers: this.convertFollowersToRawFollowers(user.followers),
            following: this.convertFollowersToRawFollowers(user.following),
            requests: this.convertFollowersToRawFollowers(user.requests),
            blocked: this.convertFollowersToRawFollowers(user.blocked),
            isBlockedBy: this.convertFollowersToRawFollowers(user.isBlockedBy),
            postIds: user.postIds,
            taggedPostIds: user.taggedPostIds,
            archivedPostIds: user.archivedPostIds,
            dateJoined: user.dateJoined,
            private: user.private
        }

        return rawUser;
    }

    convertRawFollowersToFollowers(rawFollowers: string[]) {
        let returnArray: FollowerModel[] = [];

        rawFollowers.forEach((rawFollowerString) => {
            let splitArray = rawFollowerString.split('::::');

            let follower: FollowerModel = {
                profilePicture: splitArray.at(0)!,
                username: splitArray.at(1)!
            }

            returnArray.push(follower);
        })

        return returnArray;
    }
    convertFollowersToRawFollowers(followers: FollowerModel[]) {
        let returnArray: string[] = [];

        followers.forEach((follower) => {
            returnArray.push(follower.profilePicture + '::::' + follower.username);
        })

        return returnArray;
    }
}