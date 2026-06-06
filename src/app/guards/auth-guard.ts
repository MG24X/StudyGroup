import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const AuthGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  try {
    const session = await sb.getSession();
    if (session) return true;
  } catch {
    // session check failed,turn as unauthenticated
  }

  router.navigate(['/login']);
  return false;
};