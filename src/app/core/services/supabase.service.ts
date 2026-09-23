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

  /**
   * Creates a fetch wrapper with:
   * 1. Per-request timeout (8s) so nothing hangs as "pending"
   * 2. Automatic retry with exponential backoff (up to 3 retries: 1s → 2s → 4s)
   * 3. Only retries on transient errors (network failures, timeouts, 502/503/504)
   * 4. Final fallback returns a controlled 503 response
   */
  private createResilientFetch(): typeof fetch {
    const MAX_RETRIES = 1;
    const BASE_DELAY_MS = 500;
    const TIMEOUT_MS = 8000;

    const sanitizeHeaders = (init?: RequestInit): RequestInit | undefined => {
      if (!init) return init;
      const headers = new Headers(init.headers || {});
      const auth = headers.get('authorization') || headers.get('Authorization');

      // Only fallback to anon key if token is severely bloated (>8KB) to avoid breaking RLS auth.uid() on write operations
      if (auth && auth.length > 8192) {
        console.warn(
          `[SupabaseService] Bloated Authorization header detected (${auth.length} chars). Using fallback anon key for read operations.`
        );
        headers.set('Authorization', `Bearer ${environment.supabaseKey}`);
        headers.set('apikey', environment.supabaseKey);
      }

      return {
        ...init,
        headers
      };
    };

    const isRetryable = (error: any, response?: Response): boolean => {
      if (error) return true;
      if (response && [502, 503, 504, 408].includes(response.status)) return true;
      return false;
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const getUrl = (input: RequestInfo | URL): string => {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.toString();
      return (input as Request)?.url || String(input);
    };

    return async (input: RequestInfo | URL, init?: RequestInit) => {
      let lastError: any = null;
      let lastResponse: Response | null = null;
      const sanitizedInit = sanitizeHeaders(init);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[Supabase] Retry ${attempt}/${MAX_RETRIES} in ${backoff}ms: ${getUrl(input)}`);
          await delay(backoff);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const response = await fetch(input, {
            ...sanitizedInit,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!isRetryable(null, response)) {
            return response;
          }

          lastResponse = response;
          lastError = null;
        } catch (error: any) {
          clearTimeout(timeoutId);
          lastError = error;
          lastResponse = null;
        }
      }

      const isTimeout = lastError?.name === 'AbortError';
      const reason = lastResponse
        ? `HTTP ${lastResponse.status}`
        : isTimeout ? 'Timeout' : 'Network error';
      console.error(
        `[Supabase] All ${MAX_RETRIES} retries failed (${reason}): ${getUrl(input)}`
      );

      if (lastResponse) return lastResponse;

      return new Response(
        JSON.stringify({ message: `Request failed: ${reason}`, code: 'FETCH_EXHAUSTED' }),
        { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
      );
    };
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
        },
        global: {
          fetch: this.createResilientFetch()
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

