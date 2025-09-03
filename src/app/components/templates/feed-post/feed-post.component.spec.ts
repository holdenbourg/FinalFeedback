//~ ---------- ng test --include src/app/components/templates/feed-post/feed-post.component.spec.ts ---------- ~\\

import { Component, Input } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Subject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';

import { FeedPostComponent } from './feed-post.component';

// ---- Real DI tokens ----
import { LocalStorageService } from '../../../services/local-storage.service';
import { RatedMoviesDatabase } from '../../../databases/rated-movies-database';
import { RatedSeriesDatabase } from '../../../databases/rated-series-database';
import { CommentsDatabase } from '../../../databases/comments-database';
import { CommentsService } from '../../../services/comments.service';
import { PostsService } from '../../../services/posts.service';
import { RepliesService } from '../../../services/replies.service';
import { CommentModerationService } from '../../../services/comment-moderation-service';


/// ----- Models For Testing ----- \\\
type UserPostModel = {
  postId: string; profilePicture: string; username: string; poster: string;
  caption: string; likes: string[]; taggedUsers: Array<{ username: string; profilePicture: string }>;
  postDate: string; seenBy: string[];
};
type CommentModel = {
  postId: string; commentId: string; profilePicture: string; username: string;
  comment: string; likes: string[]; commentDate: string;
};
type ReplyModel = {
  postId: string; commentId: string; replyId: string;
  profilePicture: string; username: string; replyingToUsername: string;
  comment: string; likes: string[]; commentDate: string;
};


/// ----- Stubs/Mocks ----- \\\
@Component({
  selector: 'app-feed-comment',
  template: '<ng-content></ng-content>',
  standalone: true
})
class StubFeedCommentComponent {
  @Input() comment!: CommentModel;
}

class MockLocalStorageService {
  private store = new Map<string, any>([
    ['current-user', {
      username: 'me',
      profilePicture: 'pp.png',
      blocked: [],
      isBlockedBy: [],
      following: [{ username: 'author', profilePicture: '' }]
    }],
    ['users', [
      { username: 'me',     profilePicture: '' },
      { username: 'author', profilePicture: '' },
      { username: 'alice',  profilePicture: '' }
    ]],
    ['rate-limit', {}],
    ['comments', []],
    ['replies', []],
  ]);
  getInformation<T = any>(key: string): T | undefined { return this.store.get(key); }
  setInformation<T = any>(key: string, val: T) { this.store.set(key, val); }
  clearInformation(key: string) { this.store.delete(key); }
  cleanTemporaryLocalStorages() { /* no-op */ }
}

class MockRatedMoviesDatabase { getRatedMovieById() { return null; } }
class MockRatedSeriesDatabase { getRatedSeriesById() { return null; } }

/// ----- Seed Comments For Data Validation ----- \\\
class MockCommentsDatabase {
  commentsByPostId = new Map<string, CommentModel[]>([
    ['m123', [{
      postId: 'm123',
      commentId: 'c-1',
      profilePicture: '',
      username: 'author',
      comment: 'seed parent comment',
      likes: [],
      commentDate: '2025-01-02',
    }]]
  ]);

  addCommentToDatabase = jasmine.createSpy('addCommentToDatabase').and.callFake((c: CommentModel) => {
    const arr = this.commentsByPostId.get(c.postId) ?? [];
    arr.push(c);
    this.commentsByPostId.set(c.postId, arr);
  });

  getAllCommentsByPostId = (postId: string) => (this.commentsByPostId.get(postId) ?? []);
}


/// ----- Mock Services ----- \\\
class MockCommentsService {
  generateUniqueCommentId = () => 'c-gen-1';
  toggleCommentLike = (_u: string, c: CommentModel) => c;

  addComment           = jasmine.createSpy('cs.addComment').and.callFake((c: CommentModel) => c);
  addCommentToDatabase = jasmine.createSpy('cs.addCommentToDatabase').and.callFake((c: CommentModel) => c);
  createComment        = jasmine.createSpy('cs.createComment').and.callFake((c: CommentModel) => c);
  saveComment          = jasmine.createSpy('cs.saveComment').and.callFake((c: CommentModel) => c);
}

class MockPostsService {
  togglePostLike = (user: string, post: UserPostModel) => ({
    ...post,
    likes: post.likes.includes(user)
      ? post.likes.filter(u => u !== user)
      : [...post.likes, user],
  });
}

class MockRepliesService {
  postId: string | null = null;
  commentId: string | null = null;
  replyingToUsername: string | null = null;

  private changedSubj = new Subject<{ commentId: string; replyId?: string }>();
  replyChanged$ = this.changedSubj.asObservable();

  private ctx$ = new BehaviorSubject<{ postId: string | null; commentId: string | null; username: string | null }>({
    postId: null, commentId: null, username: null
  });
  replyContext$ = this.ctx$.asObservable();

  setReplyContext(postId: string, commentId: string, username: string) {
    this.postId = postId;
    this.commentId = commentId;
    this.replyingToUsername = username;
    this.ctx$.next({ postId, commentId, username });
  }
  clearReplyContext() {
    this.postId = this.commentId = this.replyingToUsername = null;
    this.ctx$.next({ postId: null, commentId: null, username: null });
  }

  private _commit(r: ReplyModel) { this.changedSubj.next({ commentId: r.commentId, replyId: r.replyId }); }

  addReply = jasmine.createSpy('addReply').and.callFake((r: ReplyModel) => this._commit(r));
  addReplyToDatabase = (...args: any[]) => (this.addReply as any)(...args);
  createReply = (...args: any[]) => (this.addReply as any)(...args);
  saveReply = (...args: any[]) => (this.addReply as any)(...args);
  postReply = (...args: any[]) => (this.addReply as any)(...args);

  generateUniqueReplyId = () => 'r-gen-1';
  toggleReplyLike = (_u: string, r: ReplyModel) => r;
}


  /// ---------------------------------------- Testing Bed ---------------------------------------- \\\
describe('FeedPostComponent (validation & DB calls)', () => {
  let fixture: ComponentFixture<FeedPostComponent>;
  let component: FeedPostComponent;

  let commentsDb: MockCommentsDatabase;
  let repliesSvc: MockRepliesService;
  let ls: MockLocalStorageService;
  let cs: MockCommentsService;
  let mod: CommentModerationService;

  const ASYNC_DELAY_MS = 5000;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        RouterTestingModule,
        FeedPostComponent,
        StubFeedCommentComponent
      ],
      providers: [
        { provide: LocalStorageService, useClass: MockLocalStorageService },
        { provide: RatedMoviesDatabase, useClass: MockRatedMoviesDatabase },
        { provide: RatedSeriesDatabase, useClass: MockRatedSeriesDatabase },
        { provide: CommentsDatabase, useClass: MockCommentsDatabase },
        { provide: CommentsService, useClass: MockCommentsService },
        { provide: PostsService, useClass: MockPostsService },
        { provide: RepliesService, useClass: MockRepliesService },
      ],
    })
    .overrideComponent(FeedPostComponent, {
      set: {
        styleUrls: [],
        styles: [],
        changeDetection: ChangeDetectionStrategy.Default,
        imports: [CommonModule, FormsModule, RouterTestingModule, StubFeedCommentComponent],
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedPostComponent);
    component = fixture.componentInstance;

    component.feedPost = {
      postId: 'm123',
      profilePicture: '',
      username: 'author',
      poster: '',
      caption: '',
      likes: [],
      taggedUsers: [
        { username: 'author', profilePicture: '' },
        { username: 'alice',  profilePicture: '' }
      ],
      postDate: '2025-01-01',
      seenBy: [],
    };

    commentsDb = TestBed.inject(CommentsDatabase) as any;
    repliesSvc = TestBed.inject(RepliesService) as any;
    ls = TestBed.inject(LocalStorageService) as any;
    cs = TestBed.inject(CommentsService) as any;
    mod = TestBed.inject(CommentModerationService);

    ls.setInformation('rate-limit', {});
    fixture.detectChanges();
  });

  afterEach(fakeAsync(() => {
    flush();
    discardPeriodicTasks();
  }));

  function makeValidForm() {
    return { valid: true, controls: { comment: { valid: true } }, resetForm: () => {} } as any;
  }

  function postAndFlush(str: string, advanceMs: number = ASYNC_DELAY_MS) {
    const form = makeValidForm();
    component.commentInput = str;
    (component as any).onPostComment(form);
    fixture.detectChanges();
    if (advanceMs > 0) tick(advanceMs);
    flush();
    fixture.detectChanges();
  }

  function commentWriteCount() {
    return (
      commentsDb.addCommentToDatabase.calls.count() +
      cs.addComment.calls.count() +
      cs.addCommentToDatabase.calls.count() +
      cs.createComment.calls.count() +
      cs.saveComment.calls.count()
    );
  }


  /// ---------------------------------------- Testing ---------------------------------------- \\\
  it('rejects empty or whitespace-only comments', fakeAsync(() => {
    postAndFlush('   ', 0);
    expect(commentWriteCount()).toBe(0);
    expect(repliesSvc.addReply).not.toHaveBeenCalled();
  }));

  it('rejects comments shorter than 2 or longer than 150 chars', fakeAsync(() => {
    postAndFlush('a', 0);
    postAndFlush('x'.repeat(151), 0);
    expect(commentWriteCount()).toBe(0);
    expect(repliesSvc.addReply).not.toHaveBeenCalled();
  }));

  it('rejects comments with >2 links (http/https)', fakeAsync(() => {
    postAndFlush('see https://a.com and http://b.com and also https://c.com', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('rejects control characters (ASCII C0/C1) in comments', fakeAsync(() => {
    postAndFlush('normal text \u0007 more \u009F text', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('rejects long character spam (>= 11 repeats)', fakeAsync(() => {
    postAndFlush('looooooooooooool', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('rejects @mentions for non-existent users', fakeAsync(() => {
    postAndFlush('Hello @ghost_user', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('rejects profanity/slurs (including leetspeak & stretched chars)', fakeAsync(() => {
    postAndFlush('you are a n1gg3r', 0);
    postAndFlush('niggerrrrr', 0);
    postAndFlush('NiG.gEr', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('enforces rate-limit (1 per user ~2s): drops the 2nd quick post', fakeAsync(() => {
    const spy = spyOn(mod, 'validate').and.returnValues(
      { ok: true, text: 'First valid comment' } as any,
      { ok: false, error: 'Too fast' } as any,
      { ok: true, text: 'Third after cooldown' } as any
    );

    postAndFlush('First valid comment', 0);
    expect(commentWriteCount()).toBe(1);

    postAndFlush('Second too fast', 0);
    expect(commentWriteCount()).toBe(1);

    postAndFlush('Third after cooldown', 0);
    expect(commentWriteCount()).toBe(2);

    expect(spy).toHaveBeenCalledTimes(3);
  }));

  it('requires valid reply context (postId/commentId) to add a reply', fakeAsync(() => {
    postAndFlush('This would reply, but context mismatches post → treat as comment', 0);
    expect(repliesSvc.addReply).not.toHaveBeenCalled();
  }));

  it('rejects duplicate @ of the same user more than once in a comment', fakeAsync(() => {
    postAndFlush('Hi @alice and @alice again', 0);
    expect(commentWriteCount()).toBe(0);
  }));

  it('adds a valid comment (no reply context) to the database', fakeAsync(() => {
    const spy = spyOn(mod, 'validate').and.returnValue({ ok: true, text: 'This is a clean, valid comment.' } as any);
    postAndFlush('This is a clean, valid comment.', 0);
    expect(commentWriteCount()).toBe(1);
    expect(repliesSvc.addReply).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  }));

  it('adds a valid reply when reply context is set and valid', fakeAsync(() => {
    repliesSvc.setReplyContext('m123', 'c-1', 'author');

    const spy = spyOn(mod, 'validate').and.returnValue({ ok: true, text: 'This is a clean reply @author' } as any);

    postAndFlush('This is a clean reply @author', 0);

    expect(repliesSvc.addReply).toHaveBeenCalledTimes(1);
    expect(commentWriteCount()).toBe(0);
    expect(spy).toHaveBeenCalled();
  }));
});