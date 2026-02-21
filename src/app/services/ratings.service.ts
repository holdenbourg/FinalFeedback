import { inject, Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/database-models/notification.model';

// Import the actual models from your codebase
// These match your rating-model.ts exactly
export interface BaseCriteria {
  acting: number;
  visuals: number;
  story: number;
  pacing: number;
  ending: number;
}

export interface MovieCriteria extends BaseCriteria {
  climax: number;
  runtime: number;  // Runtime in minutes
}

export interface SeriesCriteria extends BaseCriteria {
  length: number;
  seasons: number;   // Total seasons
  episodes: number;  // Total episodes
}

// This matches your RatingModel exactly
export interface PostRating {
  id: string;
  user_id: string;
  media_type: 'movie' | 'series';
  media_id: string;
  title: string;
  release_date: string | null;
  rating: number;
  criteria: MovieCriteria | SeriesCriteria;
  date_rated: string;
  date_edited?: string | null;
  poster_url: string;
  rated?: string | null;
  genres: string[];
}

@Injectable({ providedIn: 'root' })
export class RatingsService {
  private notificationsService = inject(NotificationsService);

  ///  Get rating data for a specific post (via post.rating_id)  \\\
  async getRatingByPostId(postId: string): Promise<PostRating | null> {
    // First get the post to find its rating_id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('rating_id')
      .eq('id', postId)
      .single();

    if (postError || !post?.rating_id) {
      return null;
    }

    // Now get the actual rating
    const { data, error } = await supabase
      .from('ratings')
      .select('id, user_id, media_type, media_id, title, rating, criteria, poster_url, release_date, date_rated, date_edited, rated, genres')
      .eq('id', post.rating_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PostRating;
  }

  ///  Get rating directly by rating_id  \\\
  async getRatingById(ratingId: string): Promise<PostRating | null> {
    const { data, error } = await supabase
      .from('ratings')
      .select('id, user_id, media_type, media_id, title, rating, criteria, poster_url, release_date, date_rated, date_edited, rated, genres')
      .eq('id', ratingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PostRating;
  }

  ///  Get all ratings for a user  \\\
  async getUserRatings(userId: string): Promise<PostRating[]> {
    const { data, error } = await supabase
      .from('ratings')
      .select('id, user_id, media_type, media_id, title, rating, criteria, poster_url, release_date, date_rated, date_edited, rated, genres')
      .eq('user_id', userId)
      .order('date_rated', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PostRating[];
  }

  ///  Get only movies for a user  \\\
  async getUserMovies(userId: string): Promise<PostRating[]> {
    const { data, error } = await supabase
      .from('ratings')
      .select('id, user_id, media_type, media_id, title, rating, criteria, poster_url, release_date, date_rated, date_edited, rated, genres')
      .eq('user_id', userId)
      .eq('media_type', 'movie')
      .order('date_rated', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PostRating[];
  }

  ///  Get only series for a user  \\\
  async getUserSeries(userId: string): Promise<PostRating[]> {
    const { data, error } = await supabase
      .from('ratings')
      .select('id, user_id, media_type, media_id, title, rating, criteria, poster_url, release_date, date_rated, date_edited, rated, genres')
      .eq('user_id', userId)
      .eq('media_type', 'series')
      .order('date_rated', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PostRating[];
  }

  ///  Create a new rating (returns the rating ID to use when creating a post)  \\\
  async createRating(
    mediaType: 'movie' | 'series',
    mediaId: string,
    title: string,
    posterUrl: string,
    criteria: MovieCriteria | SeriesCriteria,
    releaseDate?: Date | null,
    rated?: string | null,
    genres?: string[]
  ): Promise<string> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    // Calculate overall rating from criteria
    const criteriaValues = [
      criteria.acting,
      criteria.visuals,
      criteria.story,
      criteria.pacing,
      criteria.ending
    ];

    // Add climax for movies or length for series
    if (mediaType === 'movie') {
      criteriaValues.push((criteria as MovieCriteria).climax);
    } else {
      criteriaValues.push((criteria as SeriesCriteria).length);
    }

    const overall = criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length;
    const overallRating = Math.round(overall * 10) / 10;

    const { data, error } = await supabase
      .from('ratings')
      .insert({
        user_id: user.id,
        media_type: mediaType,
        media_id: mediaId,
        title: title,
        release_date: releaseDate,
        rating: overallRating,
        criteria: criteria as any, // JSONB - includes runtime/seasons/episodes automatically
        poster_url: posterUrl,
        rated: rated,
        genres: genres || []
      })
      .select('id')
      .single();

    if (error) throw error;

    // Notify all followers
    this.notificationsService.createForFollowers({
      type: NotificationType.RATED_TITLE,
      ratingId: data.id,
      metadata: {
        rating_title: title,
        rating_value: overallRating,
        post_poster_url: posterUrl,
      },
    }).catch(() => {});

    return data.id;
  }

  ///  Update an existing rating's criteria  \\\
  async updateRating(ratingId: string, criteria: Partial<MovieCriteria | SeriesCriteria>): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    // Get current rating
    const current = await this.getRatingById(ratingId);
    if (!current) throw new Error('Rating not found');

    // Merge updated criteria
    const updatedCriteria = {
      ...current.criteria,
      ...criteria
    } as MovieCriteria | SeriesCriteria;

    // Recalculate overall rating
    const criteriaValues = [
      updatedCriteria.acting,
      updatedCriteria.visuals,
      updatedCriteria.story,
      updatedCriteria.pacing,
      updatedCriteria.ending
    ];

    if (current.media_type === 'movie') {
      criteriaValues.push((updatedCriteria as MovieCriteria).climax);
    } else {
      criteriaValues.push((updatedCriteria as SeriesCriteria).length);
    }

    const overall =
      criteriaValues.reduce((sum, val) => sum + val, 0) /
      criteriaValues.length;

    const overallRating = Math.round(overall * 10) / 10;

    const { error } = await supabase
      .from('ratings')
      .update({
        criteria: updatedCriteria as any,
        rating: overallRating,
        date_edited: new Date().toISOString()
      })
      .eq('id', ratingId)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  ///  Update rating with full data and timestamp (used by edit-film-rating)  \\\
  async updateRatingAndStamp(ratingId: string, updates: { title?: string; release_date?: string | null; rating?: number; criteria?: MovieCriteria | SeriesCriteria; }): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    const payload: any = {
      date_edited: new Date().toISOString()
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.release_date !== undefined) payload.release_date = updates.release_date;
    if (updates.rating !== undefined) payload.rating = updates.rating;
    if (updates.criteria !== undefined) payload.criteria = updates.criteria;

    const { error } = await supabase
      .from('ratings')
      .update(payload)
      .eq('id', ratingId)
      .eq('user_id', user.id);

    if (error) throw error;

    // Notify all followers about re-rating
    if (updates.rating !== undefined) {
      const rating = await this.getRatingById(ratingId);
      if (rating) {
        this.notificationsService.createForFollowers({
          type: NotificationType.RERATED_TITLE,
          ratingId,
          metadata: {
            rating_title: rating.title,
            rating_value: updates.rating,
            post_poster_url: rating.poster_url,
          },
        }).catch(() => {});
      }
    }
  }

  ///  Delete a rating (use delete_rating_cascade function instead for safety)  \\\
  async deleteRating(ratingId: string): Promise<void> {
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw uErr ?? new Error('Not signed in');

    // Use the database function for proper cascade deletion
    const { error } = await supabase.rpc('delete_rating_cascade', {
      p_rating_id: ratingId
    });

    if (error) throw error;
  }
}