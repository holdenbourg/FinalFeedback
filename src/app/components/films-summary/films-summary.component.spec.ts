import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilmsSummaryComponent } from './films-summary.component';

describe('FilmsSummaryComponent', () => {
  let component: FilmsSummaryComponent;
  let fixture: ComponentFixture<FilmsSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmsSummaryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FilmsSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
