import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonLabel, IonIcon, IonModal, IonSegment, IonSegmentButton,
  IonBadge, ToastController, AlertController,
  IonButton, IonButtons, MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, personOutline, timeOutline,
  checkmarkCircleOutline, trashOutline,
  personAddOutline, checkmarkOutline, closeOutline,
  documentOutline, eyeOutline
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [
    IonModal, IonButtons, IonButton,
    IonSegment, IonSegmentButton,
    NgIf, NgFor, FormsModule, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonLabel, IonIcon, IonBadge
  ],
  providers: [ToastController, AlertController],
})
export class AdminPage implements OnInit {
getFileIcon(arg0: any) {
throw new Error('Method not implemented.');
}

  activeTab = 'requests';  // ← active tab
  allPendingRequests: any[] = [];
  currentUserId = '';
  pendingResources: any[] = [];
  myGroupIds: string[] = [];

  viewerOpen = false;
  viewerUrl = '';
  viewerFileName = '';
profilePhotoUrl: any;
userName: any;

  constructor(
    private sb: SupabaseService,
    private toast: ToastController,
    public themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private menuCtrl: MenuController
  ) {
    addIcons({
      peopleOutline, personOutline, timeOutline,
      checkmarkCircleOutline, trashOutline, documentOutline,
      personAddOutline, checkmarkOutline, closeOutline, eyeOutline
    });
  }

  //sidebar
  openMenu() { this.menuCtrl.open(); }
  async ionViewWillEnter() {
  this.loadPendingRequests();
  this.loadPendingResources();
  await this.loadProfile();
}

async loadProfile() {
  const user = await this.sb.getCurrentUser();
  if (!user) return;
  const profile = await this.sb.getUserProfile(user.id);
  this.profilePhotoUrl = profile?.photo_url || '';
  this.userName = profile?.name || '';
}
  ionViewDidEnter() { this.cdr.detectChanges(); }

  async ngOnInit() {
    const user = await this.sb.getCurrentUser();
    this.currentUserId = user?.id || '';

    const { data: myGroups } = await this.sb.supabase
      .from('groups')
      .select('id')
      .eq('leader_id', this.currentUserId)
      .eq('status', 'approved');

    this.myGroupIds = myGroups?.map(g => g.id) || [];

    await this.loadPendingRequests();
    await this.loadPendingResources();
  }

  // switching tabs
  onTabChange() {
    if (this.activeTab === 'requests') this.loadPendingRequests();
    if (this.activeTab === 'resources') this.loadPendingResources();
  }

  async loadPendingRequests() {
    if (!this.currentUserId) return;

    // get only groups where current user is the leader
    const { data: myGroups } = await this.sb.supabase
      .from('groups')
      .select('id')
      .eq('leader_id', this.currentUserId)
      .eq('status', 'approved');

    const myGroupIds = myGroups?.map(g => g.id) || [];

    if (myGroupIds.length === 0) {
      this.allPendingRequests = [];
      return;
    }

    // get pending requests only for those groups
    const { data } = await this.sb.supabase
      .from('members')
      .select('*, profiles(name, matricule, photo_url), groups(name)')
      .eq('status', 'pending')
      .in('group_id', myGroupIds)
      .order('joined_at', { ascending: false });

    this.allPendingRequests = data || [];
  }

  // accepting join requests
  async approveRequest(req: any) {
    await this.sb.supabase
      .from('members').update({ status: 'accepted' }).eq('id', req.id);
    this.showToast(`${req.profiles?.name} approved!`, 'success');
    await this.loadPendingRequests();
  }

  // rejecting join requests
  async rejectRequest(req: any) {
    await this.sb.supabase.from('members').delete().eq('id', req.id);
    this.showToast('Request rejected.', 'warning');
    await this.loadPendingRequests();
  }

  // pending resources to validate
  async loadPendingResources() {
    if (this.myGroupIds.length === 0) {
      this.pendingResources = [];
      return;
    }
    const { data } = await this.sb.supabase
      .from('resources')
      .select('*')
      .eq('status', 'pending')
      .in('group_id', this.myGroupIds)
      .order('created_at', { ascending: false });
    this.pendingResources = data || [];
  }

  // viewing resources before approving
  viewResource(res: any) {
    this.viewerUrl = res.file_url;
    this.viewerFileName = res.file_name;
    this.viewerOpen = true;
  }

  get safeViewerUrl(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.viewerUrl);
  }

  isImage(fileName: string): boolean {
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }

  // approving resources
  async approveResource(res: any) {
    await this.sb.supabase
      .from('resources')
      .update({ status: 'approved' })
      .eq('id', res.id);
    this.pendingResources = this.pendingResources.filter(r => r.id !== res.id);
    this.showToast('Resource approved!', 'success');
  }

  // rejecting resources
  async rejectResource(res: any) {
    await this.sb.supabase
      .from('resources').delete().eq('id', res.id);
    this.pendingResources = this.pendingResources.filter(r => r.id !== res.id);
    this.showToast('Resource rejected.', 'warning');
  }

  // toasts: in-app notifications
  async showToast(message: string, color: string) {
    const t = await this.toast.create({
      message, duration: 3000, color, position: 'top'
    });
    await t.present();
  }
}