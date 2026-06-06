import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonButton, IonInput, IonTextarea, IonIcon, IonBadge,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline, timeOutline, peopleOutline,
  checkmarkOutline, closeOutline, personRemoveOutline, imageOutline, cameraOutline
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-manage-group',
  templateUrl: './manage-group.page.html',
  styleUrls: ['./manage-group.page.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule,IonContent, IonBackButton, 
    IonHeader, IonToolbar, IonButtons, IonTitle, IonBadge,
    IonButton, IonInput, IonTextarea, IonIcon
  ],
  providers: [ToastController, AlertController],
})
export class ManageGroupPage implements OnInit {
  groupId = '';
  groupName = '';
  groupSubject = '';
  groupDescription = '';
  groupPhotoUrl = ''; 
  @ViewChild('groupPhotoInput') groupPhotoInput!: ElementRef<HTMLInputElement>; 
  pendingMembers: any[] = [];
  acceptedMembers: any[] = [];
themeService: any;

  constructor(
    private route: ActivatedRoute,
    private sb: SupabaseService,
    private toast: ToastController,
    private alert: AlertController
  ) {
    addIcons({ createOutline, imageOutline, cameraOutline, timeOutline, checkmarkOutline, closeOutline, peopleOutline, personRemoveOutline });
  }

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') || '';
    await this.loadGroup();
    await this.loadMembers();
  }

  async loadGroup() {
    const { data } = await this.sb.supabase.from('groups').select('*').eq('id', this.groupId).single();
    if (data) {
      this.groupName        = data.name;
      this.groupSubject     = data.subject;
      this.groupDescription = data.description || '';
      this.groupPhotoUrl    = data.photo_url   || ''; 
    }
  }

  async loadMembers() {
    const { data } = await this.sb.supabase.from('members')
      .select('*, profiles(name, matricule, photo_url)').eq('group_id', this.groupId);
    if (data) {
      this.pendingMembers  = data.filter(m => m.status === 'pending');
      this.acceptedMembers = data.filter(m => m.status === 'accepted');
    }
  }

  async updateGroup() {
    const { error } = await this.sb.supabase.from('groups')
      .update({ name: this.groupName.trim(), subject: this.groupSubject.trim(), description: this.groupDescription.trim() || null })
      .eq('id', this.groupId);
    this.showToast(error ? error.message : 'Group infos updated!', error ? 'danger' : 'success');
  }

  // group photo 
  changeGroupPhoto() {
    this.groupPhotoInput.nativeElement.click();
  }

  async onGroupPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const path = `group_photos/${this.groupId}_${Date.now()}`;
    const { error } = await this.sb.supabase.storage
      .from('resources').upload(path, file, { upsert: true });
    if (error) { this.showToast('Photo upload failed', 'danger'); return; }

    const { data } = this.sb.supabase.storage.from('resources').getPublicUrl(path);
    await this.sb.supabase.from('groups').update({ photo_url: data.publicUrl }).eq('id', this.groupId);
    this.groupPhotoUrl = data.publicUrl;
    this.showToast('Group photo updated!', 'success');
    input.value = '';
  }

  async acceptMember(m: any) {
    await this.sb.supabase.from('members').update({ status: 'accepted' }).eq('id', m.id);
    this.showToast(`${m.profiles?.name} accepted!`, 'success');
    await this.loadMembers();
  }

  async rejectMember(m: any) {
    await this.sb.supabase.from('members').delete().eq('id', m.id);
    this.showToast('Request rejected.', 'warning');
    await this.loadMembers();
  }

  async removeMember(m: any) {
    const alert = await this.alert.create({
      header: 'Remove Member',
      message: `Remove ${m.profiles?.name} from the group?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: async () => {
          await this.sb.supabase.from('members').delete().eq('id', m.id);
          this.showToast('Member removed.', 'warning');
          await this.loadMembers();
        }}
      ]
    });
    await alert.present();
  }

  async showToast(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 3000, color, position: 'top' });
    await t.present();
  }
}