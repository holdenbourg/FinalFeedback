import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatedFilmComponent } from './rated-film.component';

describe('RatedFilmComponent', () => {
  let component: RatedFilmComponent;
  let fixture: ComponentFixture<RatedFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatedFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RatedFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
