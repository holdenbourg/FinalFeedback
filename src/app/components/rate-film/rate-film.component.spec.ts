import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RateFilmComponent } from './rate-film.component';

describe('RateFilmComponent', () => {
  let component: RateFilmComponent;
  let fixture: ComponentFixture<RateFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RateFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RateFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
