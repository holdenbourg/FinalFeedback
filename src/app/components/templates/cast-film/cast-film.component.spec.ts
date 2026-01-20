import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CastFilmComponent } from './cast-film.component';

describe('CastFilmComponent', () => {
  let component: CastFilmComponent;
  let fixture: ComponentFixture<CastFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CastFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CastFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
