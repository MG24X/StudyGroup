import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'app_theme';
  isDark = signal(false);

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'dark') {
      this.enableDark();
    } else if (saved === 'light') {
      this.enableLight();
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? this.enableDark() : this.enableLight();
    }
  }

  toggle() {
    this.isDark() ? this.enableLight() : this.enableDark();
  }

  private enableDark() {
    document.body.classList.add('dark');
    localStorage.setItem(this.STORAGE_KEY, 'dark');
    this.isDark.set(true);
  }

  private enableLight() {
    document.body.classList.remove('dark');
    localStorage.setItem(this.STORAGE_KEY, 'light');
    this.isDark.set(false);
  }
}