// src/app/services/ratings.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import {
  RatingModel,
  MovieCriteria,
  SeriesCriteria,
} from '../models/database-models/rating-model';

type Criteria = MovieCriteria | SeriesCriteria;

@Injectable({ providedIn: 'root' })
export class RatingsService {
  ///  Insert rating into ratings table  \\\
  async insertRating(model: RatingModel): Promise<RatingModel> {
    const payload = { ...model, date_edited: model.date_edited ?? null };

    const { data, error } = await supabase
      .from('ratings')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return data as RatingModel;
  }

  ///  Get rating by id  \\\
  async getRatingById(id: string): Promise<RatingModel | null> {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (String(error.message).toLowerCase().includes('row not found')) return null;
      throw error;
    }

    return data as RatingModel;
  }

  ///  Get all current users ratings  \\\
  async getUserRatings(userId: string): Promise<RatingModel[]> {
    const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .order('date_edited', { ascending: false, nullsFirst: false })
    .order('date_rated', { ascending: false });

    if (error) throw error;
    
    return (data ?? []) as RatingModel[];
  }

  ///  Get a rating by the ratings imdbId  \\\
  async getUserMediaRating(userId: string, mediaId: string): Promise<RatingModel | null> {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('media_id', mediaId)
      .limit(1)
      .single();

    if (error) {
      if (String(error.message).toLowerCase().includes('row not found')) return null;
      throw error;
    }

    return data as RatingModel;
  }

  ///  update a users rating that is already in the ratings table  \\\
  async updateRating(id: string, patch: Partial<Omit<RatingModel, 'id' | 'user_id'> & { criteria: Criteria }>): Promise<RatingModel> {
    const payload = { ...patch, date_edited: patch.date_edited ?? null };

    const { data, error } = await supabase
      .from('ratings')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data as RatingModel;
  }

  ///  Update and auto-stamp date_edited  \\\
  async updateRatingAndStamp(id: string, patch: Partial<Omit<RatingModel, 'id' | 'user_id'>> & { criteria?: Criteria }): Promise<RatingModel> {
    const todayISO = new Date().toISOString().slice(0, 10);

    return this.updateRating(id, { ...patch, date_edited: todayISO });
  }

  ///  Get all movies rated by a user  \\\
  async getUserMovies(userId: string): Promise<RatingModel[]> {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('media_type', 'movie')
      .order('date_edited', { ascending: false, nullsFirst: false })
      .order('date_rated', { ascending: false });

    if (error) throw error;

    return (data ?? []) as RatingModel[];
  }

  ///  Get all series rated by a user  \\\
  async getUserSeries(userId: string): Promise<RatingModel[]> {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('media_type', 'series')
      .order('date_edited', { ascending: false, nullsFirst: false })
      .order('date_rated', { ascending: false });

    if (error) throw error;

    return (data ?? []) as RatingModel[];
  }

  ///  Delete rating by id  \\\
  async deleteRating(id: string): Promise<void> {
    const { error } = await supabase.from('ratings').delete().eq('id', id);
    
    if (error) throw error;
  }
}
