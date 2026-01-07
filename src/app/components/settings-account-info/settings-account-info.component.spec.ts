import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsAccountInfoComponent } from './settings-account-info.component';

describe('SettingsAccountInfoComponent', () => {
  let component: SettingsAccountInfoComponent;
  let fixture: ComponentFixture<SettingsAccountInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsAccountInfoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SettingsAccountInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
