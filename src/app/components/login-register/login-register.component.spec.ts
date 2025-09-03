//~ ---------- ng test --include src/app/components/login-register/login-register.component.spec.ts ---------- ~\\

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LoginRegisterComponent } from './login-register.component';
import { CommentsDatabase } from '../../databases/comments-database';
import { PostsDatabase } from '../../databases/posts-database';
import { RatedMoviesDatabase } from '../../databases/rated-movies-database';
import { RatedSeriesDatabase } from '../../databases/rated-series-database';
import { RepliesDatabase } from '../../databases/replies-database';
import { UsersDatabase } from '../../databases/users-database';
import { LocalStorageService } from '../../services/local-storage.service';
import { RoutingService } from '../../services/routing.service';
import { UsersService } from '../../services/users.service';
import { RawAccountInformationModel } from '../../models/database-models/raw-account-information-model';

/// ----- Minimal Mocks ----- \\\
class RoutingServiceMock {
  navigateToHome() {}
}

class LocalStorageServiceMock {
  private store = new Map<string, any>();
  getInformation(key: string) { return this.store.get(key); }
  setInformation(key: string, value: any) { this.store.set(key, value); }
  clearInformation(key: string) { this.store.delete(key); }
  cleanTemporaryLocalStorages() {}
}

class UsersServiceMock {
  usernameExists = (_: string) => false;
  emailExists = (_: string) => false;
  convertRawUserToUser = (u: RawAccountInformationModel) => u;
}

class UsersDatabaseMock {
  private users: RawAccountInformationModel[] = [];
  addUserToDatabase(u: RawAccountInformationModel) { this.users.push(u); }
  getAllUsersFromDatabase() { return this.users.slice(); }
}

class RatedMoviesDatabaseMock { resetRatedMoviesDatabase() {} }
class RatedSeriesDatabaseMock { resetRatedSeriesDatabase() {} }
class PostsDatabaseMock { resetPostsDatabase() {} }
class CommentsDatabaseMock { resetCommentsDatabase() {} }
class RepliesDatabaseMock { resetRepliesDatabase() {} }

describe('LoginRegisterComponent', () => {
  let component: LoginRegisterComponent;
  let fixture: ComponentFixture<LoginRegisterComponent>;

  /// ----- Helper to call private methods ----- \\\
  const call = <T>(fn: string, ...args: any[]): T =>
    (component as any)[fn](...args);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginRegisterComponent, FormsModule],
      providers: [
        { provide: RoutingService, useClass: RoutingServiceMock },
        { provide: LocalStorageService, useClass: LocalStorageServiceMock },
        { provide: UsersService, useClass: UsersServiceMock },
        { provide: UsersDatabase, useClass: UsersDatabaseMock },
        { provide: RatedMoviesDatabase, useClass: RatedMoviesDatabaseMock },
        { provide: RatedSeriesDatabase, useClass: RatedSeriesDatabaseMock },
        { provide: PostsDatabase, useClass: PostsDatabaseMock },
        { provide: CommentsDatabase, useClass: CommentsDatabaseMock },
        { provide: RepliesDatabase, useClass: RepliesDatabaseMock },
      ],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoginRegisterComponent);
    component = fixture.componentInstance;
  });

  /// ---------------------------------------- Login/Register Helper Method Testing ---------------------------------------- \\\
  it('containsAnySpecialCharacters()', () => {
    expect(call<boolean>('containsAnySpecialCharacters', 'John')).toBeFalse();
    expect(call<boolean>('containsAnySpecialCharacters', 'John-Doe')).toBeTrue();
    expect(call<boolean>('containsAnySpecialCharacters', 'Jane_Doe')).toBeTrue();
    expect(call<boolean>('containsAnySpecialCharacters', 'A.B')).toBeTrue();
    expect(call<boolean>('containsAnySpecialCharacters', 'A/B')).toBeTrue();
  });

  it('containsAllowedSpecialCharacters()', () => {
    expect(call<boolean>('containsAllowedSpecialCharacters', 'Abcdef1!')).toBeTrue();
    expect(call<boolean>('containsAllowedSpecialCharacters', 'Abcdef1@')).toBeTrue();
    expect(call<boolean>('containsAllowedSpecialCharacters', 'Abcdef1#')).toBeTrue();
    expect(call<boolean>('containsAllowedSpecialCharacters', 'Abcdef1_')).toBeFalse();
    expect(call<boolean>('containsAllowedSpecialCharacters', 'Abcdef1?')).toBeFalse();
  });

  it('containsCapitalLetter()', () => {
    expect(call<boolean>('containsCapitalLetter', 'abc')).toBeFalse();
    expect(call<boolean>('containsCapitalLetter', 'abC')).toBeTrue();
  });

  it('containsNumber()', () => {
    expect(call<boolean>('containsNumber', 'abc')).toBeFalse();
    expect(call<boolean>('containsNumber', 'ab3c')).toBeTrue();
  });

  it('containsWhiteSpace()', () => {
    expect(call<boolean>('containsWhiteSpace', 'noSpaces')).toBeFalse();
    expect(call<boolean>('containsWhiteSpace', 'has space')).toBeTrue();
    expect(call<boolean>('containsWhiteSpace', 'tab\tchar')).toBeTrue();
    expect(call<boolean>('containsWhiteSpace', 'new\nline')).toBeTrue();
  });

  it('inputWithinRange()', () => {
    expect(call<boolean>('inputWithinRange', 'abc', 2, 4)).toBeTrue();
    expect(call<boolean>('inputWithinRange', 'a', 2, 4)).toBeFalse();
    expect(call<boolean>('inputWithinRange', 'abcdef', 2, 4)).toBeFalse();
  });

  it('isUsernameValid()', () => {
    expect(call<boolean>('isUsernameValid', 'John123')).toBeTrue();
    expect(call<boolean>('isUsernameValid', 'john')).toBeTrue();
    expect(call<boolean>('isUsernameValid', 'John_123')).toBeFalse();
    expect(call<boolean>('isUsernameValid', 'John-123')).toBeFalse();
    expect(call<boolean>('isUsernameValid', 'John 123')).toBeFalse();
  });

  it('isEmailValid()', () => {
    expect(call<boolean>('isEmailValid', 'a@b.com')).toBeTrue();
    expect(call<boolean>('isEmailValid', 'name.surname@host.co')).toBeTrue();
    expect(call<boolean>('isEmailValid', 'bad-email')).toBeFalse();
    expect(call<boolean>('isEmailValid', 'name@host')).toBeFalse();
    expect(call<boolean>('isEmailValid', 'name@host.')).toBeFalse();
    expect(call<boolean>('isEmailValid', 'name@.tld')).toBeFalse();
    expect(call<boolean>('isEmailValid', 'na me@host.com')).toBeFalse();
  });


  /// ---------------------------------------- validateRegister() Testing ---------------------------------------- \\\
  describe('validateRegister()', () => {
    beforeEach(() => {
      component.termsChecked = true;
      component.registerObject = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@doe.com',
        username: 'john123',
        password: 'Abcdef!1'
      };

      // Ensure UsersService mocks report no conflicts by default
      const usersService = TestBed.inject(UsersService) as any as UsersServiceMock;
      usersService.emailExists = (_: string) => false;
      usersService.usernameExists = (_: string) => false;
    });

    const run = () => call<string | null>('validateRegister');

    it('returns null when all fields are valid', () => {
      expect(run()).toBeNull();
    });

    it('fails on short first name', () => {
      component.registerObject.firstName = 'J';
      expect(run()).toContain('First name');
    });

    it('fails on special chars in last name', () => {
      component.registerObject.lastName = 'Do_e';
      expect(run()).toContain(`Last name can't have special characters`);
    });

    it('fails on invalid email format', () => {
      component.registerObject.email = 'john@doe';
      expect(run()).toContain('Email must look like');
    });

    it('fails when email already exists', () => {
      const usersService = TestBed.inject(UsersService) as any as UsersServiceMock;
      usersService.emailExists = (_: string) => true;
      expect(run()).toBe('Email already exists');
    });

    it('fails on invalid username characters', () => {
      component.registerObject.username = 'john_doe';
      expect(run()).toBe('Username can only use letters and numbers');
    });

    it('fails when username already exists', () => {
      const usersService = TestBed.inject(UsersService) as any as UsersServiceMock;
      usersService.usernameExists = (_: string) => true;
      expect(run()).toBe('Username already exists');
    });

    it('fails on weak password (no capital)', () => {
      component.registerObject.password = 'abcdef!1';
      expect(run()).toBe('Password must contain a capital letter');
    });

    it('fails on weak password (no number)', () => {
      component.registerObject.password = 'Abcdef!!';
      expect(run()).toBe('Password must contain a number');
    });

    it('fails on weak password (no allowed special)', () => {
      component.registerObject.password = 'Abcdef11';
      expect(run()).toBe('Password must contain one of ! @ # $ % ^ & *');
    });

    it('fails if terms not checked', () => {
      component.termsChecked = false;
      expect(run()).toBe('Must agree to terms & conditions');
    });
  });


  /// ---------------------------------------- validateRegister() Testing ---------------------------------------- \\\
  describe('validateLogin()', () => {
    const run = () => call<string | null>('validateLogin');

    it('fails on empty username', () => {
      component.loginObject = { username: '', password: 'x' };
      expect(run()).toBe('Enter a username');
    });

    it('fails when username has spaces', () => {
      component.loginObject = { username: 'john doe', password: 'x' };
      expect(run()).toBe('Username cannot contain spaces');
    });

    it('fails on empty password', () => {
      component.loginObject = { username: 'john', password: '' };
      expect(run()).toBe('Enter a password');
    });

    it('fails when password has spaces', () => {
      component.loginObject = { username: 'john', password: 'has space' };
      expect(run()).toBe('Password cannot contain spaces');
    });

    it('returns null when login inputs valid', () => {
      component.loginObject = { username: 'john', password: 'secret' };
      expect(run()).toBeNull();
    });


    /// ---------------------------------------- onRegister() Testing ---------------------------------------- \\\
    it('onRegister() should add user to database when all criteria pass', () => {
      const usersDb = TestBed.inject(UsersDatabase) as any;
      const usersService = TestBed.inject(UsersService) as any;

      spyOn(usersDb, 'addUserToDatabase').and.callThrough();
      spyOn(usersService, 'convertRawUserToUser').and.callFake((u: RawAccountInformationModel) => u);

      component.activePanel = 'register';

      component.termsChecked = true;
      component.registerObject = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@doe.com',
        username: 'janedoe',
        password: 'Password!1'
      };

      component.onRegister();

      expect(usersDb.addUserToDatabase).toHaveBeenCalledTimes(1);
      expect(usersService.convertRawUserToUser).toHaveBeenCalled();
      expect(component.activePanel).toBe('login');
      expect(component.warningType).toBe('success');
    });


    /// ---------------------------------------- onRegister() Testing ---------------------------------------- \\\
    it('onLogin() should navigate to home when credentials are valid', () => {
      const usersDb = TestBed.inject(UsersDatabase) as any;
      const usersService = TestBed.inject(UsersService) as any;
      const routing = TestBed.inject(RoutingService) as any;
      const storage = TestBed.inject(LocalStorageService) as any;

      // seed DB with a matching raw user
      const rawUser = {
        profilePicture: '',
        username: 'janedoe',
        password: 'Password!1',
        email: 'jane@doe.com',
        firstName: 'Jane',
        lastName: 'Doe',
        bio: '',
        followers: [], following: [], requests: [],
        blocked: [], isBlockedBy: [],
        postIds: [], taggedPostIds: [], archivedPostIds: [],
        dateJoined: '2025-01-01',
        private: false
      };
      spyOn(usersDb, 'getAllUsersFromDatabase').and.returnValue([rawUser]);
      spyOn(usersService, 'convertRawUserToUser').and.callFake((u: RawAccountInformationModel) => ({ ...u, converted: true }));
      spyOn(routing, 'navigateToHome').and.stub();

      component.loginObject = { username: 'janedoe', password: 'Password!1' };
      component.rememberMeChecked = true;

      component.onLogin();

      expect(usersDb.getAllUsersFromDatabase).toHaveBeenCalled();
      expect(usersService.convertRawUserToUser).toHaveBeenCalledWith(rawUser);
      expect(storage.getInformation('current-user')).toBeTruthy();
      expect(storage.getInformation('remember-me')).toBeTrue();
      expect(routing.navigateToHome).toHaveBeenCalled();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });
});
