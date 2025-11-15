import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  let component: LandingPageComponent;
  let fixture: ComponentFixture<LandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LandingPageComponent],
      imports: [RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.isLoggedIn).toBe(false);
    expect(component.currentUser).toBe(null);
  });

  it('should have feature data', () => {
    expect(component.features.length).toBe(6);
    expect(component.features[0].title).toBe('Smart Budgeting');
    expect(component.features[0].icon).toBe('💰');
  });

  it('should have testimonial data', () => {
    expect(component.testimonials.length).toBe(3);
    expect(component.testimonials[0].name).toBe('Sarah M.');
  });

  it('should have navigation methods', () => {
    expect(typeof component.navigateToLogin).toBe('function');
    expect(typeof component.navigateToRegister).toBe('function');
    expect(typeof component.navigateToDashboard).toBe('function');
  });

  it('should have greeting methods', () => {
    expect(typeof component.getGreeting).toBe('function');
    expect(typeof component.getUserGreeting).toBe('function');
    expect(typeof component.getUserInfo).toBe('function');
  });

  it('should return default greeting when not logged in', () => {
    component.currentUser = null;
    expect(component.getUserGreeting()).toBe('Take Control of Your Financial Future');
  });

  it('should return user info when logged in', () => {
    component.currentUser = { firstName: 'John' };
    expect(component.getUserInfo()).toBe('Ready to continue your financial journey?');
  });
});