export enum AccountViewState {
  /** User is viewing their own profile */
  OWN_ACCOUNT = 'own_account',
  
  /** User is following a public account */
  FOLLOWING_PUBLIC = 'following_public',
  
  /** User is following a private account */
  FOLLOWING_PRIVATE = 'following_private',
  
  /** User is not following a public account */
  NOT_FOLLOWING_PUBLIC = 'not_following_public',
  
  /** User is not following a private account */
  NOT_FOLLOWING_PRIVATE = 'not_following_private',
  
  /** User has sent a follow request (pending) */
  REQUESTED = 'requested',
  
  /** Current user is blocked by profile user (use not_found state) */
  BLOCKED = 'blocked',

  /** Current user blocked profile user */
  BLOCKER = 'blocker',
  
  /** Profile user does not exist */
  NOT_FOUND = 'not_found',
  
  /** Loading state */
  LOADING = 'loading'
}