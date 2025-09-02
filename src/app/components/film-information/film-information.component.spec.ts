import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilmInformationComponent } from './film-information.component';

describe('FilmInformationComponent', () => {
  let component: FilmInformationComponent;
  let fixture: ComponentFixture<FilmInformationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmInformationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FilmInformationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
