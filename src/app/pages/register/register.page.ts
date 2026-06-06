import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { IonContent, IonButton, IonInput, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  schoolOutline, personOutline, idCardOutline,
  mailOutline, lockClosedOutline, alertCircleOutline,
  informationCircleOutline, eyeOutline, eyeOffOutline
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    NgIf, FormsModule, RouterLink, IonSpinner,
    IonContent, IonButton, IonInput, IonIcon
  ],
})
export class RegisterPage {
 showPassword = false;
 
togglePassword() { this.showPassword = !this.showPassword; }
  name = '';
  matricule = '';
  email = '';
  password = '';
  loading = false;
  errorMsg = '';
  showMatriculeInfo = false;

  constructor(private sb: SupabaseService, private router: Router) {
    addIcons({
      schoolOutline, personOutline, idCardOutline,
      mailOutline, lockClosedOutline, alertCircleOutline,
      informationCircleOutline, eyeOutline, eyeOffOutline
    });
  }

  onMatriculeInput(event: any) {
    const raw = event.detail?.value ?? '';
    const digitsOnly = raw.replace(/\D/g, '');
    const capped = digitsOnly.slice(0, 8);
    this.matricule = capped;
    if (event.target) event.target.value = capped;
  }

  get matriculeValid(): boolean {
    return this.matricule.length === 8;
  }

  get matriculeError(): string {
    if (this.matricule.length === 0) return '';
    if (this.matricule.length < 8) return `${8 - this.matricule.length} digit(s) remaining`;
    return '';
  }

  async register() {
    this.errorMsg = '';

    if (!this.name.trim() || !this.matricule || !this.email.trim() || !this.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }
    if (this.matricule.length !== 8) {
      this.errorMsg = 'Matricule must be exactly 8 digits.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }

    this.loading = true;

    const { data: existingName } = await this.sb.supabase
      .from('profiles')
      .select('name')
      .eq('name', this.name.trim())
      .maybeSingle();

    if (existingName) {
      this.errorMsg = 'This name is already taken. Please choose a different name.';
      this.loading = false;
      return;
    }

    const { data, error: signUpError } = await this.sb.supabase.auth.signUp({
      email: this.email.trim(),
      password: this.password
    });

    if (signUpError) { this.errorMsg = signUpError.message; this.loading = false; return; }
    if (!data.user)  { this.errorMsg = 'Account creation failed.'; this.loading = false; return; }

    const { error: profileError } = await this.sb.supabase.from('profiles').insert({
      id: data.user.id,
      name: this.name.trim(),
      matricule: this.matricule,
      role: 'student'
    });

    this.loading = false;
    if (profileError) { this.errorMsg = profileError.message; return; }
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}