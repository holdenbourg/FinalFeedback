import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { UserModel } from '../models/database-models/user.model';


@Injectable({ providedIn: 'root' })
export class ProfileService {
  async getMyProfile(): Promise<UserModel | null> {
    const { data: { user }, error: uerr } = await supabase.auth.getUser();
    if (uerr || !user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, email, profile_picture_url')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data as UserModel | null;
  }

  async updateMyProfile(patch: Partial<UserModel>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');

    const { error } = await supabase.from('users').update(patch).eq('id', user.id);
    if (error) throw error;
  }
}