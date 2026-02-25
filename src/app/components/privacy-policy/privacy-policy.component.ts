import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrivacyPolicyContentComponent } from '../privacy-policy-content/privacy-policy-content.component';
import { Router } from '@angular/router';

@Component({
    selector: 'app-privacy-policy',
    imports: [CommonModule, PrivacyPolicyContentComponent],
    templateUrl: './privacy-policy.component.html',
    styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent implements OnInit {
  public router = inject(Router);

  ngOnInit() {
    this.addRandomStartPointForRows();
  }

  addRandomStartPointForRows() {
    document.querySelectorAll<HTMLElement>('.poster-rows .row .inner').forEach(el => {
      const durStr = getComputedStyle(el).animationDuration;
      const dur = parseFloat(durStr.split(',')[0]) || 140;
      el.style.animationDelay = `${-(Math.random() * dur)}s`;
    });
  }
}