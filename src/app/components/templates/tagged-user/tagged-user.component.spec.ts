import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaggedUserComponent } from './tagged-user.component';

describe('TaggedUserComponent', () => {
  let component: TaggedUserComponent;
  let fixture: ComponentFixture<TaggedUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaggedUserComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TaggedUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
