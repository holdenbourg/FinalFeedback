import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditFilmRatingComponent } from './edit-film-rating.component';

describe('EditFilmRatingComponent', () => {
  let component: EditFilmRatingComponent;
  let fixture: ComponentFixture<EditFilmRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditFilmRatingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EditFilmRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
