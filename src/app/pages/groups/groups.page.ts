import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeService } from '../../services/theme.service';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, MenuController,
  IonContent, IonSearchbar, IonSpinner, IonIcon, IonChip, IonLabel, IonMenuButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  logOutOutline, peopleOutline, bookOutline,
  personOutline, chevronForwardOutline,
  moonOutline, sunnyOutline, enterOutline, timeOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-groups',
  templateUrl: './groups.page.html',
  styleUrls: ['./groups.page.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule, IonMenuButton, IonButton,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonChip,
    IonContent, IonSearchbar, IonSpinner, IonIcon, IonLabel
  ],
})
export class GroupsPage implements OnInit {
  groups: any[] = [];
  loading = false;
  currentUserId = '';
  profilePhotoUrl = '';
  userName = '';

  constructor(
    private sb: SupabaseService,
    private router: Router,
    public themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    private menuCtrl: MenuController
  ) {
    addIcons({
      logOutOutline, peopleOutline, bookOutline,
      personOutline, chevronForwardOutline,
      moonOutline, sunnyOutline, enterOutline, timeOutline
    });
  }

  async openMenu() {
  await this.menuCtrl.open();
}

  ionViewDidEnter() { this.cdr.detectChanges(); }
  async ngOnInit() { await this.loadGroups(); 
                     await this.loadProfile(); }
  
async loadProfile() {
  const user = await this.sb.getCurrentUser();
  if (!user) return;
  const profile = await this.sb.getUserProfile(user.id);
  this.profilePhotoUrl = profile?.photo_url || '';
  this.userName = profile?.name || '';
}

  ionViewWillEnter() { this.loadGroups(); }

 async loadGroups() {
  this.loading = true;
  const user = await this.sb.getCurrentUser();
  this.currentUserId = user?.id || '';

  const { data: memberships } = await this.sb.supabase
    .from('members')
    .select('group_id')
    .eq('user_id', this.currentUserId)
    .eq('status', 'accepted');

  const joinedGroupIds = memberships?.map(m => m.group_id) || [];

  let query = this.sb.supabase
    .from('groups')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (joinedGroupIds.length > 0) {
    query = query.or(`id.in.(${joinedGroupIds.join(',')}),leader_id.eq.${this.currentUserId}`);
  } else {
    query = query.eq('leader_id', this.currentUserId);
  }

  const { data, error } = await query;
  this.groups = error ? [] : (data || []);
  this.loading = false;
}
  
    onCardClick(group: any) {
    this.router.navigate(['/tabs/chat', group.id]);
   }

  async logout() {
    await this.sb.signOut();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}