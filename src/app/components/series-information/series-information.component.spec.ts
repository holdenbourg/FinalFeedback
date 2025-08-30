import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeriesInformationComponent } from './series-information.component';

describe('SeriesInformationComponent', () => {
  let component: SeriesInformationComponent;
  let fixture: ComponentFixture<SeriesInformationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeriesInformationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SeriesInformationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
