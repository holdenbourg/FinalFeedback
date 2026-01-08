import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-policy-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy-content.component.html',
  styleUrl: './privacy-policy-content.component.css'
})
export class PrivacyPolicyContentComponent {
  @Input() showBackButton = true;
  
  lastUpdated = 'January 7, 2026';
  companyName = 'What2Watch';
  contactEmail = 'privacy@what2watch.org';
  websiteUrl = 'https://what2watch.org';
}