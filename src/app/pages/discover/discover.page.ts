import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, MenuController,
  IonContent, IonSearchbar, IonSpinner, IonIcon, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bookOutline, chevronForwardOutline,
  enterOutline, timeOutline, compassOutline, personCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonSearchbar, IonSpinner, IonIcon, IonLabel
  ],
})
export class DiscoverPage {

  groups: any[] = [];
  filteredGroups: any[] = [];
  searchTerm = '';
  loading = false;
  currentUserId = '';
  profilePhotoUrl: string = '';
  userName: string = '';

  constructor(
    private sb: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private menuCtrl: MenuController
  ) {
    addIcons({
      bookOutline, chevronForwardOutline,
      enterOutline, timeOutline, compassOutline, 
      personCircleOutline
    });
  }

  openMenu() { this.menuCtrl.open(); }

  async ionViewWillEnter() {
    await Promise.all([this.loadGroups(), this.loadProfile()]);
    this.cdr.detectChanges();
  }

  async loadProfile() {
    const user = await this.sb.getCurrentUser();
    if (!user) return;
    const profile = await this.sb.getUserProfile(user.id);
    this.profilePhotoUrl = profile?.photo_url || '';
    this.userName = profile?.name || '';
  }

  async loadGroups() {
    this.loading = true;
    const user = await this.sb.getCurrentUser();
    this.currentUserId = user?.id || '';

    const { data, error } = await this.sb.supabase
      .from('groups')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const { data: memberships } = await this.sb.supabase
      .from('members')
      .select('group_id, status')
      .eq('user_id', this.currentUserId);

    if (!error && data) {
      this.groups = data.map(g => ({
        ...g,
        memberStatus: g.leader_id === this.currentUserId
          ? 'accepted'
          : memberships?.find(m => m.group_id === g.id)?.status || 'none'
      }));
      this.applyFilters();
    }
    this.loading = false;
  }

  applyFilters() {
    let result = [...this.groups];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.subject.toLowerCase().includes(term)
      );
    }
    this.filteredGroups = result;
  }

  onCardClick(group: any) {
    if (group.memberStatus === 'accepted') {
      this.router.navigate(['/tabs/chat', group.id]);
    }
  }

  async requestJoin(event: Event, group: any) {
    event.stopPropagation();
    if (group.memberStatus !== 'none') return;

    const { error } = await this.sb.supabase.from('members').insert({
      group_id: group.id,
      user_id: this.currentUserId,
      status: 'pending'
    });

    if (!error) {
      group.memberStatus = 'pending';
      this.filteredGroups = [...this.filteredGroups];
    }
  }
}