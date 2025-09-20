import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RoutingService } from '../../services/routing.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { UsersService } from '../../services/users.service';
import { AccountInformationModel } from '../../models/database-models/account-information-model';
import { LoginModel } from '../../models/login-register-models/login-model';
import { RegisterModel } from '../../models/login-register-models/register-model';
import { RawAccountInformationModel } from '../../models/database-models/raw-account-information-model';
import { UsersDatabase } from '../../databases/users-database';
import { FormsModule } from '@angular/forms';
import { CommentsDatabase } from '../../databases/comments-database';
import { PostsDatabase } from '../../databases/posts-database';
import { RatedMoviesDatabase } from '../../databases/rated-movies-database';
import { RatedSeriesDatabase } from '../../databases/rated-series-database';
import { RepliesDatabase } from '../../databases/replies-database';

@Component({
  selector: 'app-login-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-register.component.html',
  styleUrls: ['./login-register.component.css']
})
export class LoginRegisterComponent {
  private routingService = inject(RoutingService);
  private localStorageService = inject(LocalStorageService);

  /// Databases/Services \\\
  private usersService = inject(UsersService);
  private usersDatabase = inject(UsersDatabase);
  private ratedMoviesDatabase = inject(RatedMoviesDatabase);
  private ratedSeriesDatabase = inject(RatedSeriesDatabase);
  private postsDatabase = inject(PostsDatabase);
  private commentsDatabase = inject(CommentsDatabase);
  private repliesDatabase = inject(RepliesDatabase);

  public activePanel: 'login' | 'register' = 'login';

  public termsChecked: boolean = false;
  public rememberMeChecked: boolean = false;

  public showLoginPassword = false;
  public showRegisterPassword = false;

  public showWarning = false;
  public warning: string = '';
  public warningType: 'error' | 'success' | '' = '';

  public currentUser: AccountInformationModel | undefined = this.localStorageService.getInformation('current-user');

  registerObject: RegisterModel = {
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: ''
  };
  loginObject: LoginModel = {
    username: '',
    password: ''
  };


  ngOnInit() {
    this.rememberMeChecked = this.localStorageService.getInformation('remember-me') === true;

    this.addRandomStartPointForRows();

    if(this.currentUser !== undefined && this.rememberMeChecked) {
      this.loginObject = {
        username: this.currentUser.username,
        password: this.currentUser.password
      }
    }

    this.localStorageService.cleanTemporaryLocalStorages();

    /// resets the mock databases in local storage \\\
    this.localStorageService.clearInformation('current-user'); 
    this.resetMockDatabses();
  }


  /// ---------------------------------------- Login/Register Logic ---------------------------------------- \\\
  onRegister() {
    console.log('register entered');
    
    const warningMessage = this.validateRegister();

    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      
      return;
    }

    const newAccount: RawAccountInformationModel = {
      profilePicture: '',
      username: this.registerObject.username.trim(),
      password: this.registerObject.password,
      email: this.registerObject.email.trim().toLowerCase(),
      firstName: this.registerObject.firstName.trim(),
      lastName: this.registerObject.lastName.trim(),
      bio: '',
      followers: [],
      following: [],
      requests: [],
      blocked: [],
      isBlockedBy: [],
      postIds: [],
      taggedPostIds: [],
      archivedPostIds: [],
      dateJoined: new Date().toISOString(),
      private: false
    }

    this.usersDatabase.addUserToDatabase(newAccount);

    this.localStorageService.setInformation('current-user', this.usersService.convertRawUserToUser(newAccount));
    
    this.toggleLoginRegister();
    this.transitionWarning(`Your account was created ${this.registerObject.firstName.trim()}, you may log in now`, 'success');
  }

  onLogin() {
    console.log('login entered');

    const warningMessage = this.validateLogin();

    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      
      return;
    }

    const rawUsers = this.usersDatabase.getAllUsersFromDatabase();
    const userWasFound = rawUsers.find((user) => user.username === this.loginObject.username && user.password === this.loginObject.password);

    if(userWasFound) {
      this.localStorageService.setInformation('current-user', this.usersService.convertRawUserToUser(userWasFound));
      this.localStorageService.setInformation('remember-me', this.rememberMeChecked);

      console.log('entered 123');

      this.routingService.navigateToHome();
    } else {
      this.transitionWarning('That username or password does not exist', 'error');
    }
  }

  /// ---------------------------------------- Login/Register Helper Methods ---------------------------------------- \\\
  toggleRememberMe() {
    this.rememberMeChecked = !this.rememberMeChecked;

    this.localStorageService.setInformation('remember-me', this.rememberMeChecked);
  }

  toggleLoginRegister() {
    this.activePanel = this.activePanel === 'login' ? 'register' : 'login';

    if (this.warningType === 'error') {
      this.showWarning = false;

      setTimeout(() => { this.warning = ''; this.warningType = ''; }, 500);
    }
  }

  private transitionWarning(warningMessage: string, warningType: 'error' | 'success') {
    this.warning = warningMessage;
    this.warningType = warningType;
    this.showWarning = true;

    setTimeout(() => {
      this.showWarning = false;

      setTimeout(() => { this.warning = ''; this.warningType = ''; }, 500);
    }, 3000);
  }

  
  /// ---------------------------------------- Validators ---------------------------------------- \\\
  private validateRegister(): string | null {
    const firstName = this.registerObject.firstName.trim();
    const lastName = this.registerObject.lastName.trim();
    const email = this.registerObject.email.trim();
    const username = this.registerObject.username.trim();
    const password = this.registerObject.password;

    if (!this.inputWithinRange(firstName, 2, 16)) return 'First name must be 2–16 characters';
    if (this.containsWhiteSpace(firstName)) return `First name can't contain spaces`;
    if (this.containsAnySpecialCharacters(firstName)) return `First name can't have special characters`;

    if (!this.inputWithinRange(lastName, 2, 16)) return 'Last name must be 2–16 characters';
    if (this.containsWhiteSpace(lastName)) return `Last name can't contain spaces`;
    if (this.containsAnySpecialCharacters(lastName)) return `Last name can't have special characters`;

    if (!this.inputWithinRange(email, 6, 60)) return 'Email must be 6–60 characters';
    if (this.containsWhiteSpace(email)) return `Email cannot contain spaces`;
    if (!this.isEmailValid(email)) return `Email must look like "name@host.tld"`;
    if (this.usersService.emailExists(email.toLowerCase())) return 'Email already exists';

    if (!this.inputWithinRange(username, 6, 14)) return 'Username must be 6–14 characters';
    if (this.containsWhiteSpace(username)) return `Username cannot contain spaces`;
    if (!this.isUsernameValid(username)) return 'Username can only use letters and numbers';
    if (this.usersService.usernameExists(username.toLowerCase())) return 'Username already exists';

    if (!this.inputWithinRange(password, 8, 24)) return 'Password must be 8–24 characters';
    if (this.containsWhiteSpace(password)) return `Password cannot contain spaces`;
    if (!this.containsCapitalLetter(password)) return 'Password must contain a capital letter';
    if (!this.containsNumber(password)) return 'Password must contain a number';
    if (!this.containsAllowedSpecialCharacters(password)) return 'Password must contain one of ! @ # $ % ^ & *';

    if (!this.termsChecked) return 'Must agree to terms & conditions';

    return null;
  }

  private validateLogin(): string | null {
    if (!this.inputWithinRange(this.loginObject.username.trim(), 1, 64)) return 'Enter a username';
    if (this.containsWhiteSpace(this.loginObject.username)) return `Username cannot contain spaces`;

    if (!this.inputWithinRange(this.loginObject.password, 1, 128)) return 'Enter a password';
    if (this.containsWhiteSpace(this.loginObject.password)) return `Password cannot contain spaces`;
    
    return null;
  }

  /// ---------------------------------------- Validator Helper Methods ---------------------------------------- \\\
  private containsAnySpecialCharacters(input: string): boolean {
    const specialCharacters = /[.,\[\]{}()_\-+=!@#$%^&*:;'"<>?|~\/\\]/;

    return specialCharacters.test(input);
  }
  private containsAllowedSpecialCharacters(input: string): boolean {
    const specialCharacters = /[!@#$%^&*]/;

    return specialCharacters.test(input);
  }
  private containsCapitalLetter(input: string): boolean {
    const capitalLetter = /[A-Z]/;

    return capitalLetter.test(input);
  }
  private containsNumber(input: string): boolean {
    const number = /\d/;

    return number.test(input);
  }
  private containsWhiteSpace(input: string): boolean {
    const whiteSpace = /\s/;
    return whiteSpace.test(input);
  }

  private inputWithinRange(input: string, min: number, max: number): boolean {
    return input.length >= min && input.length <= max;
  }

  private isUsernameValid(username: string): boolean {
    const allowedCharacters = /^[A-Za-z0-9]+$/;

    return allowedCharacters.test(username);
  }
  private isEmailValid(email: string): boolean {
    const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailFormat.test(email);
  }


  /// ---------------------------------------- Helper Methods ---------------------------------------- \\\
  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }

  resetMockDatabses() {
    this.usersDatabase.resetUsersDatabase();
    this.ratedMoviesDatabase.resetRatedMoviesDatabase();
    this.ratedSeriesDatabase.resetRatedSeriesDatabase();
    this.postsDatabase.resetPostsDatabase();
    this.commentsDatabase.resetCommentsDatabase();
    this.repliesDatabase.resetRepliesDatabase();
  }
}
