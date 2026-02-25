import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  async canActivate(_route: any, state: any): Promise<boolean | UrlTree> {
    const { data: { user } } = await supabase.auth.getUser();
    return user
      ? true
      : this.router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
}