import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoginModel } from '../../models/login-register-models/login.model';
import { RegisterModel } from '../../models/login-register-models/register.model';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../services/users.service';
import { supabase } from '../../core/supabase.client';

@Component({
    selector: 'app-login-register',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './login-register.component.html',
    styleUrls: ['./login-register.component.css']
})

export class LoginRegisterComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private activatedRoute = inject(ActivatedRoute);
  private usersService = inject(UsersService);

  public activePanel: 'login' | 'register' = 'login';

  public showLoginPassword = false;
  public showRegisterPassword = false;

  public termsChecked = false;
  public rememberMeChecked = false;

  public showWarning = false;
  public warning = '';
  public warningType: 'error' | 'success' | '' = '';

  registerObject: RegisterModel = {
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: ''
  };

  loginObject: LoginModel = {
    usernameOrEmail: '',
    password: ''
  };


  async ngOnInit() {
    this.addRandomStartPointForRows();
    
    ///==-  If already logged in, redirect to home  -==\\\
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[Login] Already logged in, redirecting to home');
      this.router.navigateByUrl('/');
      return;
    }

    ///==-  Restore checkbox preference   -==\\\
    const preferRemember = localStorage.getItem('ff-prefer-remember');
    if (preferRemember !== null) {
      this.rememberMeChecked = preferRemember === 'true';
    }
  }


  ///  -======================================-  Login/Register Logic  -======================================-  \\\
  ///==-  If given credentials are valid, create the account and route to login  -==\\\
  async onRegister() {
    const warningMessage = this.validateRegister();
    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      return;
    }

    const { firstName, lastName, email, username, password } = this.registerObject;

    if (await this.usersService.emailExistsCaseInsensitive(email)) {
      this.transitionWarning('Email is already registered', 'error');
      return;
    }

    if (await this.usersService.usernameExistsCaseInsensitive(username)) {
      this.transitionWarning('Username is already taken', 'error');
      return;
    }

    try {
      await this.authService.registerWithEmail({
        email,
        password,
        username,
        first_name: firstName,
        last_name: lastName
      });

      // If email confirmations are enabled, they may need to verify email before login
      this.transitionWarning(
        `Your account was created ${firstName.trim()}, you may log in now`,
        'success'
      );
      this.activePanel = 'login';
    } catch (e: any) {
      this.transitionWarning(e?.message ?? 'Registration failed.', 'error');
    }
  }

  ///==-  If given credentials are valid, create the account and route to login  -==\\\
  async onLogin() {
    const warningMessage = this.validateLogin();
    if (warningMessage) {
      this.transitionWarning(warningMessage, 'error');
      return;
    }

    try {
      await this.authService.signInWithIdentifier(
        this.loginObject.usernameOrEmail,
        this.loginObject.password,
        this.rememberMeChecked
      );

      this.transitionWarning('Welcome back!', 'success');
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.transitionWarning(
        e?.message ?? 'That username/email or password does not exist',
        'error'
      );
    }
  }


  ///  -======================================-  Forgot Password  -======================================-  \\\
  async onForgotPassword(event: Event) {
    event.preventDefault();
    const identifier = this.loginObject.usernameOrEmail?.trim();
    if (!identifier) {
      this.transitionWarning('Enter your username or email first', 'error');
      return;
    }
    try {
      await this.authService.sendPasswordReset(identifier);
      this.transitionWarning('Password reset email sent! Check your inbox.', 'success');
    } catch (e: any) {
      this.transitionWarning(e?.message ?? 'Could not send reset email', 'error');
    }
  }


  ///  -======================================-  Validators  -======================================-  \\\
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
    if (!this.containsAllowedSpecialCharacters(password))
      return 'Password must contain one of ! @ # $ % ^ & *';

    if (!this.termsChecked) return 'Must agree to terms & conditions';

    return null;
  }

  private validateLogin(): string | null {
    const id = this.loginObject.usernameOrEmail.trim();
    if (!this.inputWithinRange(id, 1, 64)) return 'Enter a username or email';
    if (this.containsWhiteSpace(this.loginObject.usernameOrEmail))
      return `Username/email cannot contain spaces`;

    if (!this.inputWithinRange(this.loginObject.password, 1, 128)) return 'Enter a password';
    if (this.containsWhiteSpace(this.loginObject.password)) return `Password cannot contain spaces`;

    return null;
  }

  ///  -======================================-  Validator Helper Methods  -======================================-  \\\
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

  ///  -======================================-  OAuth Helpers  -======================================-  \\\
  private buildRedirectUrl(): string {
    const redirect = this.activatedRoute.snapshot.queryParamMap.get('redirect');
    const targetPath = redirect && redirect !== '/' && redirect !== '/login' ? redirect : '/';
    return `${window.location.origin}${targetPath}`;
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle(this.buildRedirectUrl());
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  async signInWithGitHub() {
    try {
      await this.authService.signInWithGitHub(this.buildRedirectUrl());
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  private handleAuthError(error: any) {
    this.warning = error?.message ?? 'Sign-in failed. Please try again.';
    this.warningType = 'error';
    this.showWarning = true;
  }

  ///  -======================================-  Helper Methods  -======================================-  \\\
  toggleLoginRegister() {
    this.activePanel = this.activePanel === 'login' ? 'register' : 'login';
    this.clearWarning();
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
      setTimeout(() => {
        this.warning = '';
        this.warningType = '';
      }, 500);
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