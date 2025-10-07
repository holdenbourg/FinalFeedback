import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { LoginModel } from '../../models/login-register-models/login-model';
import { RegisterModel } from '../../models/login-register-models/register-model';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-register.component.html',
  styleUrls: ['./login-register.component.css']
})
export class LoginRegisterComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);

  public activePanel: 'login' | 'register' = 'login';

  public showLoginPassword: boolean = false;
  public showRegisterPassword: boolean = false;

  public termsChecked: boolean = false;
  public rememberMeChecked: boolean = false;
  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;  ///  when rememberMeChecked = false  \\\

  public showWarning: boolean = false;
  public warning: string = '';
  public warningType: 'error' | 'success' | '' = '';

  private redirectTo = `${window.location.origin}/auth/callback`;

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
    this.addRandomStartPointForRows();
    this.bindUnloadHandlerIfNeeded();
  }

  ngOnDestroy() {
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }
  }


  /// ---------------------------------------- Login/Register Logic ---------------------------------------- \\\
  async onRegister() {
    const warningMessage = this.validateRegister();

    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      return;
    }

    if (await this.authService.emailExists(this.registerObject.email)) {
      this.transitionWarning('Email is already registered', 'error'); 
      return;
    }

    if (await this.authService.usernameExists(this.registerObject.username)) {
      this.transitionWarning('Username is already taken', 'error'); 
      return;
    }

    const { firstName, lastName, email, username, password } = this.registerObject;

    try {
      await this.authService.signUp({ email, password, username, firstName, lastName });

      this.transitionWarning(`Your account was created ${firstName.trim()}, you may log in now`, 'success');
      this.activePanel = 'login';

    } catch (e: any) {
      this.transitionWarning(e?.message ?? 'Registration failed.', 'error');
    }
  }

  async onLogin() {
    const warningMessage = this.validateLogin();

    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      return;
    }

    try {
      await this.authService.signInWithUsernameOrEmail(
        this.loginObject.username,
        this.loginObject.password
      );

      this.transitionWarning('Welcome back!', 'success');
      this.router.navigateByUrl('/home');

    } catch (e: any) {
      this.transitionWarning(e?.message ?? 'That username or password does not exist', 'error');
    }
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

    if (!this.inputWithinRange(username, 6, 14)) return 'Username must be 6–14 characters';
    if (this.containsWhiteSpace(username)) return `Username cannot contain spaces`;
    if (!this.isUsernameValid(username)) return 'Username can only use letters and numbers';

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


  /// ---------------------------------------- OAuth Helpers ---------------------------------------- \\\
  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  async signInWithGitHub() {
    try {
      await this.authService.signInWithGitHub();
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  async signInWithFacebook() {
    try {
      await this.authService.signInWithFacebook();
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  private handleAuthError(error: any) {
    this.warning = error?.message ?? 'Sign-in failed. Please try again.';
    this.warningType = 'error';
    this.showWarning = true;
  }


  /// ---------------------------------------- Helper Methods ---------------------------------------- \\\
  toggleLoginRegister() {
    this.activePanel = this.activePanel === 'login' ? 'register' : 'login';
    this.clearWarning();
  }

  toggleRememberMe() {
    this.rememberMeChecked = !this.rememberMeChecked;
    this.bindUnloadHandlerIfNeeded();
  }

  private bindUnloadHandlerIfNeeded() {
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }

    if (!this.rememberMeChecked) {
      this.unloadHandler = () => {
        this.authService.signOut().catch(() => {});
      };

      window.addEventListener('beforeunload', this.unloadHandler);
    }
  }

  private clearWarning() {
    this.showWarning = false;
    this.warning = '';
    this.warningType = '';
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

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;

      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}
