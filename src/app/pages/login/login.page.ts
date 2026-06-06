import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import {
  IonContent, IonButton, IonInput, IonSpinner, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bookOutline, mailOutline, lockClosedOutline, alertCircleOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    NgIf, FormsModule, RouterLink,  IonSpinner,
    IonContent, IonButton, IonInput, IonIcon
  ],
})
export class LoginPage implements OnInit {
  email = '';
  password = '';
  loading = false;
  errorMsg = '';
  showPassword = false;

  constructor(private sb: SupabaseService, private router: Router) {
    addIcons({ bookOutline, mailOutline, lockClosedOutline, alertCircleOutline, eyeOutline, eyeOffOutline });
  }

  async ngOnInit() {
    const session = await this.sb.getSession();
    if (session) this.router.navigate(['/tabs/groups'], { replaceUrl: true });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    this.errorMsg = '';

    if (!this.email.trim() || !this.password) {
      this.errorMsg = 'Please enter your email and password.';
      return;
    }

    this.loading = true;

    const { error } = await this.sb.supabase.auth.signInWithPassword({
      email: this.email.trim(),
      password: this.password
    });

    if (error) {
      this.errorMsg = 'Incorrect email or password.';
      this.loading = false;
      return;
    }

    // check if account is suspended
   const user = await this.sb.getCurrentUser();
if (user) {
  const profile = await this.sb.getUserProfile(user.id);

  // no profile = deleted account → block login
  if (!profile) {
    await this.sb.supabase.auth.signOut();
    this.errorMsg = 'This account no longer exists.';
    this.loading = false;
    return;
  }

  if (profile?.suspended) {
    await this.sb.supabase.auth.signOut();
    this.errorMsg = 'Your account has been suspended. Please contact the administrator.';
    this.loading = false;
    return;
  }

  //get system admin page for superadmin role
  if (profile?.role === 'superadmin') {
    this.router.navigate(['/tabs/superadmin'], { replaceUrl: true });
  } else {
    this.router.navigate(['/tabs/groups'], { replaceUrl: true });
  }
}

    this.loading = false;
  }
}