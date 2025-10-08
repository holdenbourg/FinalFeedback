import { User } from "@supabase/supabase-js";
import { supabase } from "../core/supabase.client";
import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class UsersService {
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error fetching current user:', error.message);
      return null;
    }
    return data?.user ?? null;
  }

  async getCurrentUserId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.id ?? null;
  }
}