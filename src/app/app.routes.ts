import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./pages/welcome/welcome.page').then(m => m.WelcomePage),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'tabs',
    loadChildren: () =>
      import('./pages/tabs/tabs.routes').then(m => m.routes),
    canActivate: [AuthGuard]
  },
];