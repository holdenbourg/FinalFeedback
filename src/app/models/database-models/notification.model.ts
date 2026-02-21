export enum NotificationType {
  // Messages
  MESSAGE_SENT            = 'message_sent',
  MESSAGE_REPLIED         = 'message_replied',
  MESSAGE_SHARED_RATING   = 'message_shared_rating',

  // Likes
  LIKED_POST              = 'liked_post',
  LIKED_COMMENT           = 'liked_comment',
  LIKED_REPLY             = 'liked_reply',

  // Comments
  COMMENTED_ON_POST       = 'commented_on_post',
  REPLIED_TO_COMMENT      = 'replied_to_comment',
  REPLIED_TO_COMMENT_ON_POST = 'replied_to_comment_on_post',

  // Tags
  TAGGED_IN_POST          = 'tagged_in_post',
  TAGGED_IN_COMMENT       = 'tagged_in_comment',
  TAGGED_IN_REPLY         = 'tagged_in_reply',

  // Post ownership
  COMMENT_ON_TAGGED_POST  = 'comment_on_tagged_post',

  // Ratings
  RATED_TITLE             = 'rated_title',
  RERATED_TITLE           = 'rerated_title',

  // Follows
  STARTED_FOLLOWING       = 'started_following',
  REQUESTED_FOLLOW        = 'requested_follow',
  ACCEPTED_FOLLOW_REQUEST = 'accepted_follow_request',
}

export interface NotificationActor {
  id: string;
  username: string;
  profile_picture_url: string | null;
}

export interface NotificationMetadata {
  conversation_id?: string;
  message_preview?: string;
  rating_value?: number;
  rating_title?: string;
  post_poster_url?: string;
  comment_preview?: string;
  author_username?: string;
}

export interface NotificationModel {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  rating_id: string | null;
  metadata: NotificationMetadata;
  read: boolean;
  created_at: string;
  actor?: NotificationActor;
}

export interface GroupedNotification {
  groupKey: string;
  type: NotificationType;
  actors: NotificationActor[];
  totalActorCount: number;
  representative: NotificationModel;
  allRead: boolean;
  latestAt: string;
}
