import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrewFilmComponent } from './crew-film.component';

describe('CrewFilmComponent', () => {
  let component: CrewFilmComponent;
  let fixture: ComponentFixture<CrewFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrewFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CrewFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
