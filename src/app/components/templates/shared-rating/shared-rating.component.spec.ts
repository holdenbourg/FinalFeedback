import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedRatingComponent } from './shared-rating.component';

describe('SharedRatingComponent', () => {
  let component: SharedRatingComponent;
  let fixture: ComponentFixture<SharedRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedRatingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SharedRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
