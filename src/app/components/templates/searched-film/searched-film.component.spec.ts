import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchedFilmComponent } from './searched-film.component';

describe('SearchedFilmComponent', () => {
  let component: SearchedFilmComponent;
  let fixture: ComponentFixture<SearchedFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchedFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SearchedFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
