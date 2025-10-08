import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostFilmComponent } from './post-film.component';

describe('PostFilmComponent', () => {
  let component: PostFilmComponent;
  let fixture: ComponentFixture<PostFilmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostFilmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PostFilmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
