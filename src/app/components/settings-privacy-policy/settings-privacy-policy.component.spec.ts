import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsPrivacyPolicyComponent } from './settings-privacy-policy.component';

describe('SettingsPrivacyPolicyComponent', () => {
  let component: SettingsPrivacyPolicyComponent;
  let fixture: ComponentFixture<SettingsPrivacyPolicyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPrivacyPolicyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SettingsPrivacyPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
