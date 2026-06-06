import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, chatbubblesOutline,
  cloudUploadOutline, arrowForwardOutline,
  chevronForwardOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon],
})
export class WelcomePage {

  constructor(private router: Router) {
    addIcons({
      peopleOutline, chatbubblesOutline,
      cloudUploadOutline, arrowForwardOutline,
      chevronForwardOutline
    });

    // redirect mobile users straight to login — welcome page is web only
    if (window.innerWidth < 768) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}