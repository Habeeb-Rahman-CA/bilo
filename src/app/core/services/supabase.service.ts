import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client!: SupabaseClient;

  constructor() {
    this.initClient();
  }

  private initClient() {
    try {
      const isPlaceholder = !environment.supabaseUrl || environment.supabaseUrl.includes('YOUR_SUPABASE');
      const validUrl = isPlaceholder ? 'https://placeholder.supabase.co' : environment.supabaseUrl;
      const validKey = isPlaceholder ? 'placeholder-key' : environment.supabaseKey;

      this.client = createClient(validUrl, validKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      console.warn('Supabase client initialized in fallback mode', e);
      this.client = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    }
  }

  get supabase(): SupabaseClient {
    return this.client;
  }
}
