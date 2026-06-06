import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonFooter, IonSpinner, IonInput, IonIcon,
  IonModal, IonButton, IonTextarea, Platform, ToastController
} from '@ionic/angular/standalone';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline, send, attachOutline, micOutline, stopCircleOutline,
  documentOutline, downloadOutline, eyeOutline, closeOutline,
  videocamOutline, callOutline, micCircleOutline, play, pause, settingsOutline, ellipsisVertical } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule, DatePipe, IonBackButton,
    IonHeader, IonToolbar, IonButtons, IonTitle,
    IonContent, IonFooter, IonSpinner, IonInput,
    IonModal, IonButton, IonIcon, IonTextarea
  ],
})
export class ChatPage implements OnInit, OnDestroy {

  @ViewChild('chatContent')     chatContent!: IonContent;
  @ViewChild('fileAttachInput') fileAttachInput!: ElementRef<HTMLInputElement>;

  messages: any[] = [];
  newMessage = '';
  loading = false;
  groupId = '';
  currentUserId = '';
  currentUserName = '';
  groupName: '' = "";

  pendingFile: File | null = null;

  isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  viewerOpen = false;
  viewerUrl = '';
  viewerFileName = '';

  activeCall: any = null;
  private isCallCaller = false;

  private msgChannel: any;
  private callChannel: any;
  toast: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sb: SupabaseService,
    private sanitizer: DomSanitizer,
    private platform: Platform,
    private toastController: ToastController
  ) {
    addIcons({ellipsisVertical,videocamOutline,chatbubblesOutline,documentOutline,eyeOutline,downloadOutline,micOutline,closeOutline,attachOutline,send,settingsOutline,callOutline,stopCircleOutline,micCircleOutline,play,pause});
  }
  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') || '';
    const { data } = await this.sb.supabase
      .from('groups').select('name').eq('id', this.groupId).single();
    this.groupName = data?.name || 'Chat';

    const user = await this.sb.getCurrentUser();
    this.currentUserId = user?.id || '';
    const profile = await this.sb.getUserProfile(this.currentUserId);
    this.currentUserName = profile?.name || 'Unknown';
    await this.loadMessages();
    this.subscribeToMessages();
  }

  goToDetail() {
    this.router.navigate(['/tabs/group-detail', this.groupId]);
  }

  async loadMessages() {
    this.loading = true;
    const { data } = await this.sb.supabase
      .from('messages').select('*, profiles(photo_url)')
      .eq('group_id', this.groupId)
      .order('created_at', { ascending: true });
    this.messages = (data || []).map(m => ({
      ...m,
      sender_photo: m.profiles?.photo_url || null
    }));
    this.loading = false;
    this.messages
    .filter(m => m.message_type === 'voice' && m.voice_url)
    .forEach(m => {
      const audio = new Audio(m.voice_url);
      audio.addEventListener('loadedmetadata', () => {
        m.voiceDuration = this.formatVoiceTime(audio.duration);
        audio.src = ''; 
      });
    });
  }

  subscribeToMessages() {
    this.msgChannel = this.sb.supabase
      .channel(`chat-${this.groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${this.groupId}`
      }, async (payload: any) => {
        const exists = this.messages.find(m => m.id === payload.new.id);
        if (!exists) {
          const msg = payload.new;
          const { data: profile } = await this.sb.supabase
            .from('profiles').select('photo_url').eq('id', msg.sender_id).single();
          msg.sender_photo = profile?.photo_url || null;
           if (msg.message_type === 'voice' && msg.voice_url) {
     //message time default is voice message time
            const audio = new Audio(msg.voice_url);
      audio.addEventListener('loadedmetadata', () => {
        msg.voiceDuration = this.formatVoiceTime(audio.duration);
        audio.src = '';
      });
    }
          this.messages.push(msg);
        }
        setTimeout(() => this.chatContent?.scrollToBottom(200), 100);
      })
      .subscribe();
  }

  async sendMessage() {
    const text = this.newMessage.trim();
    if (!text) return;
    this.newMessage = '';
    await this.sb.supabase.from('messages').insert({
      group_id: this.groupId, sender_id: this.currentUserId,
      sender_name: this.currentUserName, text, message_type: 'text'
    });
  }

  triggerFileAttach() { this.fileAttachInput.nativeElement.click(); }

  onFileAttached(event: Event) {
    const input = event.target as HTMLInputElement;
    this.pendingFile = input.files?.[0] || null;
    input.value = '';
  }

  async sendFile() {
    if (!this.pendingFile) return;
    const file = this.pendingFile;
    this.pendingFile = null;

    const path = `chat_files/${this.groupId}/${Date.now()}_${file.name}`;
    const { error } = await this.sb.supabase.storage
      .from('resources').upload(path, file);
    if (error) return;

    const { data: urlData } = this.sb.supabase.storage
      .from('resources').getPublicUrl(path);

    await this.sb.supabase.from('messages').insert({
      group_id: this.groupId, sender_id: this.currentUserId,
      sender_name: this.currentUserName,
      text: '', message_type: 'file',
      file_url: urlData.publicUrl, file_name: file.name
    });
  }

  waveformBars = [6,14,22,10,18,26,14,22,10,16,26,14,6,18,22,10,14,26,18,14,6,22,18,14,10,26,18,14];
  private activeAudio: HTMLAudioElement | null = null;
  private activeMsg: any = null;

  toggleVoice(msg: any) {
    if (this.activeMsg === msg && this.activeAudio) {
      if (msg.isPlaying) {
        this.activeAudio.pause();
        msg.isPlaying = false;
      } else {
        this.activeAudio.play();
        msg.isPlaying = true;
      }
      return;
    }
    if (this.activeAudio) {
      this.activeAudio.pause();
      if (this.activeMsg) this.activeMsg.isPlaying = false;
    }
    this.activeAudio = new Audio(msg.voice_url);
    this.activeMsg = msg;
    this.activeAudio.addEventListener('loadedmetadata', () => {
      msg.voiceDuration = this.formatVoiceTime(this.activeAudio!.duration);
    });
    this.activeAudio.addEventListener('play', () => {
      const update = () => {
        if (!this.activeAudio || this.activeAudio.paused) return;
        msg.voiceProgress = this.formatVoiceTime(this.activeAudio.currentTime);
        msg.voiceProgressPercent = (this.activeAudio.currentTime / this.activeAudio.duration) * 100 || 0;
        requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    });
    this.activeAudio.addEventListener('ended', () => {
      msg.isPlaying = false;
      msg.voiceProgress = null;
    });
    this.activeAudio.play();
    msg.isPlaying = true;
  }

  formatVoiceTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  async toggleRecording() {
    if (this.isRecording) this.stopRecording();
    else await this.startRecording();
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch {
      alert('Microphone access denied. Please enable it in your browser settings.');
    }
  }

  stopRecording() {
    if (!this.mediaRecorder) return;
    this.mediaRecorder.onstop = async () => {
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });
      const path = `voice_messages/${this.groupId}/${Date.now()}.${ext}`;

      const { error } = await this.sb.supabase.storage
        .from('resources').upload(path, audioBlob);
      if (!error) {
        const { data: urlData } = this.sb.supabase.storage
          .from('resources').getPublicUrl(path);
        await this.sb.supabase.from('messages').insert({
          group_id: this.groupId, sender_id: this.currentUserId,
          sender_name: this.currentUserName,
          text: '', message_type: 'voice', voice_url: urlData.publicUrl
        });
      }
      this.mediaRecorder?.stream?.getTracks().forEach(t => t.stop());
      this.isRecording = false;
    };
    this.mediaRecorder.stop();
  }

  getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

 
  // ----- file viewer -----

  viewFile(msg: any) {
    this.viewerUrl = msg.file_url;
    this.viewerFileName = msg.file_name;
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
      const response = await fetch(url);
      const blob = await response.blob();

      // 1. DESKTOP: standard browser download
      if (!this.platform.is('capacitor')) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }

      // 2. MOBILE: use Capacitor Filesystem
      const base64Data = await this.blobToBase64(blob);

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
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
        resolve(dataUrl.split(',')[1]); // Remove the data:url header
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async showToast(message: string, color: string) {
    const t = await this.toastController.create({
      message, duration: 3000, color, position: 'top'
    });
    await t.present();
  }

  ngOnDestroy() {
    if (this.msgChannel)  this.sb.supabase.removeChannel(this.msgChannel);
    if (this.callChannel) this.sb.supabase.removeChannel(this.callChannel);
    if (this.isRecording) this.stopRecording();
  }

 // hide tab bar when entering chat
ionViewWillEnter() {
  const tabBar = document.querySelector('ion-tab-bar');
  if (tabBar) (tabBar as HTMLElement).style.display = 'none';
}

// show tab bar when leaving chat
ionViewWillLeave() {
  const tabBar = document.querySelector('ion-tab-bar');
  if (tabBar) (tabBar as HTMLElement).style.display = 'flex';
} }