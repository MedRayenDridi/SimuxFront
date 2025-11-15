import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { UserService } from '../services/user.service';

// Mock services
const mockUserService = {
  login: jasmine.createSpy('login').and.returnValue(of({
    token: 'mock-token',
    user: {
      userId: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com'
    }
  })),
  isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false)
};

const mockRouter = {
  navigate: jasmine.createSpy('navigate')
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let userService: UserService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    userService = TestBed.inject(UserService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Reset all spies
    mockUserService.login.calls.reset();
    mockRouter.navigate.calls.reset();
    mockUserService.isAuthenticated.calls.reset();
  });

  // Test 1: Component Creation
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Test 2: Form Initialization
  it('should initialize login form with empty values', () => {
    expect(component.loginForm).toBeDefined();
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  // Test 3: Form Validation - Required Fields
  it('should validate required fields', () => {
    const emailControl = component.loginForm.get('email');
    const passwordControl = component.loginForm.get('password');

    // Initially should be invalid
    expect(component.loginForm.valid).toBeFalse();

    // Test email validation
    emailControl?.setValue('');
    expect(emailControl?.hasError('required')).toBeTrue();

    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTrue();

    emailControl?.setValue('valid@example.com');
    expect(emailControl?.valid).toBeTrue();

    // Test password validation
    passwordControl?.setValue('');
    expect(passwordControl?.hasError('required')).toBeTrue();

    passwordControl?.setValue('password123');
    expect(passwordControl?.valid).toBeTrue();
  });

  // Test 4: Form Submission - Valid Form
  it('should call login service when form is valid', fakeAsync(() => {
    // Set valid form values
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123'
    });

    // Submit form
    component.onSubmit();
    tick();

    // Check if service was called
    expect(userService.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });

    // Check if navigation occurred
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  }));

  // Test 5: Form Submission - Invalid Form
  it('should not call login service when form is invalid', () => {
    // Set invalid form (empty)
    component.loginForm.setValue({
      email: '',
      password: ''
    });

    component.onSubmit();

    expect(userService.login).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // Test 6: Login Success
  it('should handle successful login', fakeAsync(() => {
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123'
    });

    component.onSubmit();
    tick();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  }));

  // Test 7: Login Failure
  it('should handle login error', fakeAsync(() => {
    const errorResponse = { error: { error: 'Invalid credentials' } };
    mockUserService.login.and.returnValue(throwError(() => errorResponse));

    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'wrongpassword'
    });

    component.onSubmit();
    tick();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('Invalid credentials');
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  // Test 8: Loading State
  it('should set loading state during login', fakeAsync(() => {
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(component.isLoading).toBeFalse();

    component.onSubmit();
    expect(component.isLoading).toBeTrue();

    tick();
    expect(component.isLoading).toBeFalse();
  }));

  // Test 9: Error Message Clearing
  it('should clear error message on new submission', fakeAsync(() => {
    // First, cause an error
    const errorResponse = { error: { error: 'Invalid credentials' } };
    mockUserService.login.and.returnValue(throwError(() => errorResponse));

    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'wrongpassword'
    });

    component.onSubmit();
    tick();

    expect(component.errorMessage).toBe('Invalid credentials');

    // Now try successful login
    mockUserService.login.and.returnValue(of({
      token: 'mock-token',
      user: { userId: 1, firstName: 'John' }
    }));

    component.onSubmit();
    tick();

    expect(component.errorMessage).toBe('');
  }));

  // Test 10: Form Controls Accessibility
  it('should have accessible form controls', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const emailInput = compiled.querySelector('input[formControlName="email"]');
    const passwordInput = compiled.querySelector('input[formControlName="password"]');
    const submitButton = compiled.querySelector('button[type="submit"]');

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
  });

  // Test 11: Button Disabled State
  it('should disable submit button when form is invalid', () => {
    component.loginForm.setValue({
      email: '',
      password: ''
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitButton.disabled).toBeTrue();
  });

  // Test 12: Button Enabled State
  it('should enable submit button when form is valid', () => {
    component.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123'
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitButton.disabled).toBeFalse();
  });

  // Test 13: Redirect if Already Authenticated
  it('should redirect to home if user is already authenticated', () => {
    mockUserService.isAuthenticated.and.returnValue(true);
    
    // Recreate component to trigger ngOnInit
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});