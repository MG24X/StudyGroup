import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,MenuController,
  IonButton, IonInput, IonTextarea, IonSpinner, IonIcon, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, addCircleOutline, alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { ChangeDetectorRef } from '@angular/core';
@Component({
  selector: 'app-create-group',
  templateUrl: './create-group.page.html',
  styleUrls: ['./create-group.page.scss'],
  standalone: true,
  imports: [IonButtons, 
    NgIf, FormsModule, IonTextarea, IonSpinner,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonInput, IonIcon
  ],
})
export class CreateGroupPage {
  groupName = '';
  subject = '';
  description = '';
  loading = false;
  errorMsg = '';
  successMsg = '';
profilePhotoUrl: any;
userName: any;

  constructor(
    private sb: SupabaseService, 
    private cdr: ChangeDetectorRef,
    private menuCtrl: MenuController
  ) {
    addIcons({ peopleOutline, addCircleOutline, alertCircleOutline, checkmarkCircleOutline });
  }


  //sidebar profile
   async ionViewWillEnter() {
  await this.loadProfile();
}

async loadProfile() {
  const user = await this.sb.getCurrentUser();
  if (!user) return;
  const profile = await this.sb.getUserProfile(user.id);
  this.profilePhotoUrl = profile?.photo_url || '';
  this.userName = profile?.name || ''; }

  openMenu() { this.menuCtrl.open(); }
  ionViewDidEnter() { this.cdr.detectChanges(); }

  async createGroup() {
    this.errorMsg = '';
    this.successMsg = '';
    if (!this.groupName.trim() || !this.subject.trim()) {
      this.errorMsg = 'Group name and subject are required.';
      return;
    }
    this.loading = true;
    const user = await this.sb.getCurrentUser();
    if (!user) { this.errorMsg = 'Not logged in.'; this.loading = false; return; }

    const { error } = await this.sb.supabase.from('groups').insert({
      name: this.groupName.trim(), subject: this.subject.trim(),
      description: this.description.trim() || null, leader_id: user.id, status: 'pending'
    });

    this.loading = false;
    if (error) { this.errorMsg = error.message; return; }
    this.groupName = '';
    this.subject = '';
    this.description = '';
    this.successMsg = 'Group submitted! Please wait for the admin approval.';
  }
}