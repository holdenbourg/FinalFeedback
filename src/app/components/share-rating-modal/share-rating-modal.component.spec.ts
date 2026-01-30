import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedRatingModalComponent } from './share-rating-modal.component';

describe('SharedRatingModalComponent', () => {
  let component: SharedRatingModalComponent;
  let fixture: ComponentFixture<SharedRatingModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedRatingModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SharedRatingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
