import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSegment,
  IonSegmentButton, IonLabel, IonIcon, IonSpinner, IonButton,
  IonButtons, ToastController, AlertController, IonSelectOption,
  MenuController, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, peopleOutline, shieldCheckmarkOutline, ellipsisVertical,
  checkmarkOutline, closeOutline, trashOutline, banOutline,
  checkmarkCircleOutline, personOutline, bookOutline,
  chatbubblesOutline, calendarOutline, alertCircleOutline
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-superadmin',
  templateUrl: './superadmin.page.html',
  styleUrls: ['./superadmin.page.scss'],
  standalone: true,
  imports: [IonBadge, 
    NgIf, NgFor, FormsModule, DatePipe, IonButtons,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSegment,
    IonSegmentButton, IonLabel, IonIcon, IonSpinner, IonButton,
    IonSelectOption
  ],
})
export class SuperadminPage implements OnInit {

  activeTab = 'stats';
  loading = false;

  stats = {
    totalUsers:        0,
    totalGroups:       0,
    activeGroups:      0,
    totalMessages:     0,
    pendingGroups:     0,
    suspendedUsers:    0,
    newUsersThisMonth: 0,
  };

  allGroups: any[] = [];
  allUsers:  any[] = [];
profilePhotoUrl: any;
userName: any;

pendingGroups: any;

  constructor(
    private sb: SupabaseService,
    private toast: ToastController,
    public themeService: ThemeService,
    private alert: AlertController,
    private cdr: ChangeDetectorRef,
      private menuCtrl: MenuController
  ) {
    addIcons({
      statsChartOutline, peopleOutline, shieldCheckmarkOutline, ellipsisVertical,
      checkmarkOutline, closeOutline, trashOutline, banOutline,
      checkmarkCircleOutline, personOutline, bookOutline,
      chatbubblesOutline, calendarOutline, alertCircleOutline
    });
  }

  openMenu() {  this.menuCtrl.open(); }

  ionViewDidEnter() { this.cdr.detectChanges(); }

  async ngOnInit() { await this.loadStats(); }

  async onTabChange() {
    if (this.activeTab === 'stats')  await this.loadStats();
    if (this.activeTab === 'groups') await this.loadAllGroups();
    if (this.activeTab === 'users')  await this.loadAllUsers();
  }

  // -------- statistics --------

  async loadStats() {
    this.loading = true;

    const [users, groups, msgs, pendingGroups, suspendedUsers, newUsers] =
      await Promise.all([
        this.sb.supabase.from('profiles').select('*', { count: 'exact', head: true }),
        this.sb.supabase.from('groups').select('*', { count: 'exact', head: true }),
        this.sb.supabase.from('messages').select('*', { count: 'exact', head: true }),
        this.sb.supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        this.sb.supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('suspended', true),
        this.sb.supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMsgs } = await this.sb.supabase
      .from('messages').select('group_id').gte('created_at', thirtyDaysAgo);
    const activeGroupIds = new Set((recentMsgs || []).map((m: any) => m.group_id));

    this.stats = {
      totalUsers:        users.count         || 0,
      totalGroups:       groups.count        || 0,
      totalMessages:     msgs.count          || 0,
      pendingGroups:     pendingGroups.count  || 0,
      suspendedUsers:    suspendedUsers.count || 0,
      newUsersThisMonth: newUsers.count       || 0,
      activeGroups:      activeGroupIds.size,
    };

    this.loading = false;
  }

//sidebar profile
   async ionViewWillEnter() { await this.loadProfile(); }

async loadProfile() {
  const user = await this.sb.getCurrentUser();
  if (!user) return;
  const profile = await this.sb.getUserProfile(user.id);
  this.profilePhotoUrl = profile?.photo_url || '';
  this.userName = profile?.name || ''; }


  // -------- groups --------

  async loadAllGroups() {
    this.loading = true;
    const { data, error } = await this.sb.supabase
      .from('groups')
      .select('*, profiles!groups_leader_id_fkey(name, matricule)')
      .order('created_at', { ascending: false });
    if (error) console.error('loadAllGroups error:', error);
    this.allGroups = data || [];
    this.loading = false;
  }

  async approveGroup(group: any) {
  await this.sb.supabase
    .from('groups')
    .update({ status: 'approved' })
    .eq('id', group.id);
  group.status = 'approved';

  // only promote to admin if they are a regular student
  // never downgrade a superadmin
  const { data: leaderProfile } = await this.sb.supabase
    .from('profiles')
    .select('role')
    .eq('id', group.leader_id)
    .single();

  if (leaderProfile?.role === 'student') {
    await this.sb.supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', group.leader_id);

    const leaderInList = this.allUsers.find(u => u.id === group.leader_id);
    if (leaderInList) leaderInList.role = 'admin';
  }

  this.showToast(`"${group.name}" approved.`, 'success');
}
  async rejectGroup(group: any) {
    const alert = await this.alert.create({
      header: 'Reject Group',
      message: `Reject and delete "${group.name}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: async () => {
            await this.sb.supabase.from('groups').delete().eq('id', group.id);
            this.allGroups = this.allGroups.filter(g => g.id !== group.id);
            this.showToast('Group deleted.', 'warning');
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteGroup(group: any) {
    const alert = await this.alert.create({
      header: 'Delete Group',
      message: `Are you sure you want to permanently delete "${group.name}"`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: async () => {
            await this.sb.supabase.from('groups').delete().eq('id', group.id);
            this.allGroups = this.allGroups.filter(g => g.id !== group.id);
            this.showToast('Group deleted.', 'warning');
          }
        }
      ]
    });
    await alert.present();
  }

  // -------- users --------

  async loadAllUsers() {
  const { data } = await this.sb.supabase
    .from('profiles').select('*').order('name');
  
  const users = data || [];
  this.allUsers = [
    ...users.filter(u => u.role === 'superadmin'),
    ...users.filter(u => u.role !== 'superadmin')
  ];
}


  async showUserOptions(u: any) {
   
    if (u.role === 'superadmin') return;

const alert = await this.alert.create({
    header: u.name,
    buttons: [

      {
        text: u.suspended ? 'Reactivate Account' : 'Suspend Account',  
        handler: () => {
          setTimeout(() => this.toggleSuspend(u), 200);
        }
      },
      {
        text: 'Delete Account',
        role: 'destructive',
        handler: () => {
          setTimeout(() => this.showDeleteUser(u), 200);
        }
      },
      {
        text: 'Cancel',
        role: 'cancel'
      }
    ]
  });
  await alert.present(); }


  //deleting users 
async showDeleteUser(u: any) {
  const alert = await this.alert.create({
    header: 'Delete Account',
    message: `Are you sure you want to delete ${u.name}'s account? The user's data will be permanently deleted.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          try {
            // 1. Perform the delete
            const { error } = await this.sb.supabase
              .from('profiles')
              .delete()
              .eq('id', u.id);

            // 2. Check for actual errors
            if (error) {
              console.error('Delete failed:', error.message);
              this.showToast('Delete failed: ' + error.message, 'danger');
              return;
            }

            // 3. Verify deletion by trying to select the row
            const { data: stillExists } = await this.sb.supabase
              .from('profiles')
              .select('id')
              .eq('id', u.id)
              .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 error

            if (stillExists) {
              console.error('Delete failed - user still in database!');
              this.showToast('Delete failed - user still exists (check RLS policies)', 'danger');
              return;
            }

            // 4. Only remove from UI after confirmed deletion
            this.allUsers = this.allUsers.filter(x => x.id !== u.id);
            this.cdr.detectChanges();
            this.showToast('Account deleted successfully.', 'success');

          } catch (err: any) {
            console.error('Exception during delete:', err);
            this.showToast('Error: ' + err.message, 'danger');
          }
        }
      }
    ]
  });
  await alert.present();
}

//suspend and activate accounts
async toggleSuspend(user: any) {
  const suspending = user.suspended !== true;  
  const alert = await this.alert.create({
    header: suspending ? 'Suspend Account' : 'Reactivate Account',
    message: suspending
      ? `Are you sure you want to suspend ${user.name}'s account? 
        The user will not be able to log in.`
      : `Are you sure you want to reactivate ${user.name}'s account?`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: suspending ? 'Suspend' : 'Reactivate',
        handler: async () => {
          const { error } = await this.sb.supabase
            .from('profiles')
            .update({ suspended: suspending })
            .eq('id', user.id);
          
          console.log('suspend error:', error);     
          console.log('suspended value:', suspending); 
          
          user.suspended = suspending;
          this.showToast(
            suspending ? `${user.name}'s account is suspended.` : `${user.name}'s account is reactivated.`,
            suspending ? 'warning' : 'success'
          );
        }
      }
    ]
  });
  await alert.present();
}

  groupStatusColor(status: string): string {
    if (status === 'approved') return 'success';
    if (status === 'pending')  return 'warning';
    return 'danger';
  }

  private async showToast(msg: string, color: string) {
    const t = await this.toast.create({
      message: msg, duration: 2000, color, position: 'top'
    });
    t.present();
  }
}