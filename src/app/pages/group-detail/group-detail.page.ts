import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonButton,
  IonTitle, IonContent, IonSpinner, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bookOutline, personOutline, enterOutline, timeOutline,
  chatbubblesOutline, folderOpenOutline, settingsOutline, peopleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, IonButtons, IonBackButton,
    IonHeader, IonToolbar, IonButton, IonSpinner,
    IonTitle, IonContent, IonIcon
  ],
})
export class GroupDetailPage implements OnInit {
  group: any = null;
  leaderName = '';
  memberStatus: 'none' | 'pending' | 'accepted' = 'none';
  isLeader = false;
  currentUserId = '';
  loading = false;
  members: any[] = [];
  groupId = '';  // ← store groupId

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sb: SupabaseService
  ) {
    addIcons({
      bookOutline, personOutline, enterOutline, timeOutline,
      chatbubblesOutline, folderOpenOutline, settingsOutline, peopleOutline
    });
  }

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') || '';
    const user = await this.sb.getCurrentUser();
    this.currentUserId = user?.id || '';
    await this.loadGroup(this.groupId);
    await this.checkMembership(this.groupId);
    await this.loadMembers(this.groupId);
  }

  async loadGroup(groupId: string) {
    this.loading = true;
    const { data } = await this.sb.supabase
      .from('groups').select('*, profiles(name)').eq('id', groupId).single();
    this.group = data;
    this.leaderName = data?.profiles?.name || 'Unknown';
    this.isLeader = data?.leader_id === this.currentUserId;
    this.loading = false;
  }

  async checkMembership(groupId: string) {
    if (this.isLeader) { this.memberStatus = 'accepted'; return; }
    const { data } = await this.sb.supabase
      .from('members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', this.currentUserId)
      .maybeSingle();
    this.memberStatus = !data ? 'none' : data.status === 'accepted' ? 'accepted' : 'pending';
  }

  // members list
  async loadMembers(groupId: string) {
    // Get all accepted members from the members table
    const { data: membersList } = await this.sb.supabase
      .from('members')
      .select('*, profiles(name, matricule, photo_url)')
      .eq('group_id', groupId)
      .eq('status', 'accepted');
    
    // Get the leader's profile
    const { data: leaderProfile } = await this.sb.supabase
      .from('profiles')
      .select('id, name, matricule, photo_url')
      .eq('id', this.group?.leader_id)
      .single();
    
    // Combine: add leader at the beginning with a member-like structure
    const leaderMember = leaderProfile ? {
      user_id: this.group?.leader_id,
      group_id: groupId,
      status: 'accepted',
      profiles: leaderProfile
    } : null;
    
    this.members = leaderMember 
      ? [leaderMember, ...(membersList || [])]
      : (membersList || []);
  }

  async joinGroup() {
    if (!this.group) return;
    const { error } = await this.sb.supabase.from('members').insert({
      group_id: this.group.id, user_id: this.currentUserId, status: 'pending'
    });
    if (!error) this.memberStatus = 'pending';
  }

  goToResources() {
    if (!this.group) return;
    this.router.navigate(['/tabs/resources', this.group.id]);
  }

  goToManage() {
    if (!this.group) return;
    this.router.navigate(['/tabs/manage-group', this.group.id]);
  }
}