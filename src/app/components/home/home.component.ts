import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountInformationModel } from '../../models/database-models/account-information-model';
import { UserPostModel } from '../../models/database-models/post-model';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing.service';
import { FollowerModel } from '../../models/database-models/follower-model';
import { PostsDatabase } from '../../databases/posts-database';
import { PostsService } from '../../services/posts.service';
import { FeedPostComponent } from '../templates/feed-post/feed-post.component';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedPostComponent, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  readonly routingService = inject(RoutingService);
  private localStorageService = inject(LocalStorageService);

  private postsDatabase: PostsDatabase = inject(PostsDatabase);
  private postsService: PostsService = inject(PostsService);

  readonly sidebarActive = signal(true);
  readonly currentUser: AccountInformationModel = this.localStorageService.getInformation('current-user')!;

  usersFeedPosts: UserPostModel[] = [];
  usersMemoryLanePosts: UserPostModel[] = [];

  searchInput = '';

  ngOnInit() {
    this.addRandomStartPointForRows();
    
    /// provides the users feed/memory lane (if they view all feed posts) \\\
    this.populateUsersFeed();

    this.populateMemoryLane();

    /// automatically closes side bar if screen width gets to low \\\
    this.applySidebarByWidth(window.innerWidth);

    this.localStorageService.cleanTemporaryLocalStorages();
  }
  

  /// ---------------------------------------- Responsive Sidebar ---------------------------------------- \\\
  @HostListener('window:resize', ['$event'])
  onWindowResize(evt: UIEvent) {
    const width = (evt.target as Window).innerWidth;
    this.applySidebarByWidth(width);
  }

  private applySidebarByWidth(width: number) {
    if (width <= 1275 && this.sidebarActive()) this.sidebarActive.set(false);
    if (width >= 1275 && !this.sidebarActive()) this.sidebarActive.set(true);
  }
  
  toggleSidebar() {
    this.sidebarActive.update(v => !v);
  }


  /// ---------------------------------------- Feed/Memory Lane Generation ---------------------------------------- \\\
  populateUsersFeed() {
    const rawPosts = this.postsDatabase.getAllPostsFromDatabase();
    const followeesUsernames = this.getFolloweesUsernames();
    const curretUserUsername = this.currentUser.username;

    /// feed = posts (posted by currentUser's following) that hasn't been seen or liked by the currentUser
    const feed = rawPosts
      .filter(post => followeesUsernames.includes(post.username))
      .filter(post => !post.likes.includes(curretUserUsername))
      .filter(post => !post.seenBy.includes(curretUserUsername))
      .map(post => this.postsService.convertRawPostToPost(post))
      .sort((a, b) => new Date(b.postDate).getTime() - new Date(a.postDate).getTime());

    this.usersFeedPosts = feed;
  }

  populateMemoryLane() {
    const rawPosts = this.postsDatabase.getAllPostsFromDatabase();
    const followeesUsernames = this.getFolloweesUsernames();
    const curretUserUsername = this.currentUser.username;

    /// memoryLane = posts liked by user in the past
    const liked = rawPosts
      .filter(post => followeesUsernames.includes(post.username))
      .filter(post => post.likes.includes(curretUserUsername))
      .map(post => this.postsService.convertRawPostToPost(post));

    this.usersMemoryLanePosts = liked;
  }

  private getFolloweesUsernames(): string[] {
    const following: FollowerModel[] = this.currentUser?.following ?? [];

    return following.map(followee => followee.username);
  }

  trackPost = (_: number, post: UserPostModel) => post.postId ?? `${post.username}-${post.postDate}`;


  /// ---------------------------------------- Helper Methods ---------------------------------------- \\\
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}