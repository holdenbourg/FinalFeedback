import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchedPersonComponent } from './searched-person.component';

describe('SearchedPersonComponent', () => {
  let component: SearchedPersonComponent;
  let fixture: ComponentFixture<SearchedPersonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchedPersonComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SearchedPersonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
