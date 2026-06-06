import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel,
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonInput, IonMenuToggle, MenuController, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, addCircleOutline, shieldCheckmarkOutline,
  createOutline, logOutOutline, cameraOutline,
  checkmarkOutline, closeOutline,
  moonOutline, sunnyOutline, globeOutline, ribbonOutline, compassOutline, pencilOutline, schoolOutline, idCardOutline, mailOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeService } from 'src/app/services/theme.service';


@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [  NgIf, FormsModule, RouterLink,
    RouterLinkActive,  IonMenuToggle, IonButtons,
    IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel,
    IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonInput
  ],
})
export class TabsPage implements OnInit {
  isAdmin = false;
  isSuperAdmin = false;
  userMatricule = '';
  userEmail = '';
  profilePhotoUrl = '';
  editingName = false;
  newName = '';
  userId = '';
  userName = '';

  constructor(
    private sb: SupabaseService,
    private router: Router,
    private menuCtrl: MenuController,
    public themeService: ThemeService
  ) {
    addIcons({peopleOutline,compassOutline,addCircleOutline,shieldCheckmarkOutline,ribbonOutline,cameraOutline,pencilOutline,checkmarkOutline,closeOutline,idCardOutline,mailOutline,logOutOutline,schoolOutline,createOutline,globeOutline,moonOutline,sunnyOutline});
  }

  async ngOnInit() {
    await this.loadProfile();
  }

  async loadProfile() {
    const user = await this.sb.getCurrentUser();
    if (!user) return;
    this.userId = user.id;
    this.userEmail = user.email || '';
    const profile = await this.sb.getUserProfile(user.id);
    this.userName = profile?.name || '';
    this.userMatricule = profile?.matricule || '';
    this.profilePhotoUrl = profile?.photo_url || '';
    this.isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';  
    // (|| profile?.role === 'superadmin';) delete so le system admin
    // can't see les requests for joining groups
    this.isSuperAdmin = profile?.role === 'superadmin';
  }

  startEditName() {
    this.newName = this.userName;
    this.editingName = true;
  }

  async saveName() {
    if (!this.newName.trim()) return;
    await this.sb.supabase
      .from('profiles')
      .update({ name: this.newName.trim() })
      .eq('id', this.userId);
    this.userName = this.newName.trim();
    this.editingName = false;
  }

  async changeProfilePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const path = `profiles/${this.userId}_${Date.now()}`;
      const { error } = await this.sb.supabase.storage
        .from('resources').upload(path, file, { upsert: true });
      if (error) return;
      const { data } = this.sb.supabase.storage
        .from('resources').getPublicUrl(path);
      await this.sb.supabase
        .from('profiles')
        .update({ photo_url: data.publicUrl })
        .eq('id', this.userId);
      this.profilePhotoUrl = data.publicUrl;
    };
    input.click();
  }

  async logout() {
    await this.menuCtrl.close();
    await this.sb.signOut();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  async openMenu() {
  await this.menuCtrl.open();
}
}