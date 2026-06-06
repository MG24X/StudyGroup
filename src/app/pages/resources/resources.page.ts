import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser'; 
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, Platform,
  IonContent, IonButton, IonSpinner, IonIcon, ToastController, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudUploadOutline, folderOpenOutline, downloadOutline, trashOutline,
  documentTextOutline, imageOutline, videocamOutline, musicalNoteOutline,
  archiveOutline, documentOutline, gridOutline, easelOutline, attachOutline,
  closeOutline, eyeOutline, timeOutline
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-resources',
  templateUrl: './resources.page.html',
  styleUrls: ['./resources.page.scss'],
  standalone: true,
  imports: [
    IonModal,
    NgIf, NgFor, DatePipe, IonTitle, IonBackButton,
    IonHeader, IonToolbar, IonButtons, IonIcon,
    IonContent, IonButton, IonSpinner
  ],
  providers: [ToastController],
})
export class ResourcesPage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  resources: any[] = [];
  pendingResources: any[] = [];
  loading = false;
  uploading = false;
  groupId = '';
  currentUserId = '';
  isLeader = false;

  viewerOpen = false;
  viewerUrl = '';
  viewerFileName = '';

  constructor(
    private route: ActivatedRoute,
    private sb: SupabaseService,
    private toast: ToastController,
    private sanitizer: DomSanitizer,
    private platform: Platform
  ) {
    addIcons({
      cloudUploadOutline, folderOpenOutline, downloadOutline, trashOutline,
      closeOutline, eyeOutline, documentTextOutline, imageOutline, videocamOutline,
      musicalNoteOutline, archiveOutline, documentOutline, gridOutline, easelOutline,
      attachOutline, timeOutline
    });
  }

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') || '';
    const user = await this.sb.getCurrentUser();
    this.currentUserId = user?.id || '';
    const { data: group } = await this.sb.supabase
      .from('groups').select('leader_id').eq('id', this.groupId).single();
    this.isLeader = group?.leader_id === this.currentUserId;
    await this.loadResources();
  }

  // ← reload every time user navigates back to this page
  ionViewWillEnter() {
    if (this.groupId && this.currentUserId) {
      this.loadResources();
    }
  }

  async loadResources() {
    this.loading = true;

    if (this.isLeader) {
      // leader sees all files
      const { data } = await this.sb.supabase
        .from('resources').select('*').eq('group_id', this.groupId)
        .order('created_at', { ascending: false });
      const all = data || [];
      this.resources = all.filter(r => r.status === 'approved');
      this.pendingResources = all.filter(r => r.status === 'pending');
    } else {
      // members only see approved files + their own pending
      const { data } = await this.sb.supabase
        .from('resources').select('*').eq('group_id', this.groupId)
        .or(`status.eq.approved,and(status.eq.pending,uploaded_by.eq.${this.currentUserId})`)
        .order('created_at', { ascending: false });
      this.resources = (data || []).filter(r => r.status === 'approved');
      this.pendingResources = (data || []).filter(
        r => r.status === 'pending' && r.uploaded_by === this.currentUserId
      );
    }

    this.loading = false;
  }

  triggerFilePicker() { this.fileInput.nativeElement.click(); }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = true;

    const path = `group_${this.groupId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await this.sb.supabase.storage
      .from('resources').upload(path, file);

    if (uploadError) {
      this.showToast('Upload failed: ' + uploadError.message, 'danger');
      this.uploading = false;
      return;
    }

    const { data: urlData } = this.sb.supabase.storage
      .from('resources').getPublicUrl(path);

    await this.sb.supabase.from('resources').insert({
      group_id: this.groupId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      uploaded_by: this.currentUserId,
      // leader uploads go straight to approved
      status: this.isLeader ? 'approved' : 'pending'
    });

    this.uploading = false;
    this.showToast(
      this.isLeader ? 'File uploaded!' : 'File submitted for approval.',
      'success'
    );
    await this.loadResources();
    input.value = '';
  }

  viewFile(res: any) {
    this.viewerUrl = res.file_url;
    this.viewerFileName = res.file_name;
    this.viewerOpen = true;
  }

  get safeViewerUrl(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.viewerUrl);
  }

  isViewable(fileName: string): boolean {
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }

  isImage(fileName: string): boolean {
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }


async downloadFile(url: string, fileName: string) {
  try {
    this.showToast('Starting download...', 'primary');
    
    // Fetch the raw blob data
    const response = await fetch(url);
    const blob = await response.blob();

    // 1. DESKTOP: Use standard browser download
    if (!this.platform.is('capacitor')) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }

    // 2. MOBILE: Use Capacitor Filesystem
    const base64Data = await this.blobToBase64(blob);
    
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data, // Now contains only the raw base64 string
      directory: Directory.Documents,
      recursive: true
    });

    this.showToast('Saved to Documents!', 'success');
  } catch (error) {
    console.error('Download failed', error);
    this.showToast('Download failed. Please check permissions.', 'danger');
  }
}

private blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

  async deleteFile(res: any) {
    await this.sb.supabase.from('resources').delete().eq('id', res.id);
    this.resources = this.resources.filter(r => r.id !== res.id);
    this.pendingResources = this.pendingResources.filter(r => r.id !== res.id);
    this.showToast('File deleted.', 'warning');
  }

  getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'document-text-outline';
    if (['jpg','jpeg','png','gif','webp'].includes(ext!)) return 'image-outline';
    if (['mp4','mov','avi'].includes(ext!)) return 'videocam-outline';
    if (['mp3','wav'].includes(ext!)) return 'musical-note-outline';
    if (['zip','rar','7z'].includes(ext!)) return 'archive-outline';
    if (['doc','docx'].includes(ext!)) return 'document-outline';
    if (['xls','xlsx','csv'].includes(ext!)) return 'grid-outline';
    if (['ppt','pptx'].includes(ext!)) return 'easel-outline';
    return 'attach-outline';
  }

  async showToast(message: string, color: string) {
    const t = await this.toast.create({
      message, duration: 3000, color, position: 'top'
    });
    await t.present();
  }
}