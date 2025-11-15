import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResidencesDetailsComponent } from './residences-details.component';

describe('ResidencesDetailsComponent', () => {
  let component: ResidencesDetailsComponent;
  let fixture: ComponentFixture<ResidencesDetailsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ResidencesDetailsComponent]
    });
    fixture = TestBed.createComponent(ResidencesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
