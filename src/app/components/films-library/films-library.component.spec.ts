import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilmsLibraryComponent } from './films-library.component';


describe('FilmsLibraryComponent', () => {
  let component: FilmsLibraryComponent;
  let fixture: ComponentFixture<FilmsLibraryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmsLibraryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FilmsLibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
