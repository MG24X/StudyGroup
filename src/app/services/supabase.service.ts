import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  supabase: SupabaseClient;
  signIn: any;
  private cachedSession: Session | null = null;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: {
          storageKey: 'studygroup_auth',
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      }
    );
  }

  private readFromStorage(): Session | null {
    try {
      const raw = localStorage.getItem('studygroup_auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.user && parsed?.access_token) return parsed as Session;
      return null;
    } catch { return null; }
  }

 async getSession(): Promise<Session | null> {
  if (this.cachedSession) return this.cachedSession;

  const stored = this.readFromStorage();
  if (stored) {
    this.cachedSession = stored;
    await this.supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token
    });
    return stored;
  }

  try {
    const { data } = await this.supabase.auth.getSession();
    this.cachedSession = data.session;
    return this.cachedSession;
  } catch { return null; }
}

  async getCurrentUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  async getUserProfile(userId: string) {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }

  async signOut() {
    this.cachedSession = null;
    await this.supabase.auth.signOut();
  }
}