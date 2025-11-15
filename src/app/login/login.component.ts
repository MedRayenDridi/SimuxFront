import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
  import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from '../services/user.service';

// Enums (from your entity)
enum Gender {
  FEMALE = 'FEMALE',
  MALE = 'MALE'
}

enum Tone {
  FORMAL = 'FORMAL',
  INFORMAL = 'INFORMAL',
  FRIENDLY = 'FRIENDLY'
}

enum FinancialKnowledgeLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT'
}

enum TypeAccount {
  Premium = 'Premium',
  Fremium = 'Fremium'
}

// Interfaces (from your entity)
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  dateOfBirth: Date;
  gender: Gender;
  profession: string;
  aiTonePreference: Tone;
  financialKnowledgeLevel: FinancialKnowledgeLevel;
  accountLocked: boolean;
  failedAttempts: number;
  accountEnabled: boolean;
  accountType: TypeAccount;
  activationCode?: string;
  activationCodeExpiry?: Date;
  createdDate: Date;
  lastModifiedDate: Date;
  deletionRequested: boolean;
  phoneNumber: string;
  updateRequested: boolean;
  firstNameUpdate?: string;
  lastNameUpdate?: string;
  dateOfBirthUpdate?: Date;
  role: Role;
  connexionInformationList: ConnexionInformation[];
}

interface Role {
  id: number;
  name: string;
  users: User[];
  createdDate: Date;
  lastModifiedDate: Date;
}

interface ConnexionInformation {
  id: number;
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  internetProvider: string;
  timeZone: string;
  ipAdress: string;
  isVpn: boolean;
  deviceBrand: string;
  deviceName: string;
  deviceType: string;
  operatingSystemVersion: string;
  operatingSystemName: string;
  isApproved: boolean;
  createdDate: Date;
  user: User;
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  isLoading: boolean = false;
  showPassword: boolean = false;
  errorMessage: string = '';
  showDemoBanner: boolean = true; // Set to false in production

  // For template access
  gender = Gender;
  tone = Tone;
  financialKnowledgeLevel = FinancialKnowledgeLevel;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private userService: UserService
  ) {
    this.loginForm = this.createLoginForm();
  }

  ngOnInit(): void {
    this.initializeFormListeners();
    this.checkRememberedUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Create the login form with validation
   */
  private createLoginForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      rememberMe: [false]
    });
  }

  /**
   * Initialize form value change listeners
   */
  private initializeFormListeners(): void {
    // Clear error message when user starts typing
    this.loginForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
        }
      });

    // Auto-fill demo credentials in development
    if (this.showDemoBanner) {
      this.loginForm.patchValue({
        email: 'demo@simux.com',
        password: 'demopassword123'
      });
    }
  }

  /**
   * Check if there's a remembered user
   */
  private checkRememberedUser(): void {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.loginForm.patchValue({
        email: rememberedEmail,
        rememberMe: true
      });
    }
  }

  /**
   * Handle login form submission
   */
  onLogin(): void {
    // Mark all fields as touched to trigger validation messages
    this.markFormGroupTouched(this.loginForm);

    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const loginData: LoginRequest = {
        email: this.loginForm.value.email.trim().toLowerCase(),
        password: this.loginForm.value.password,
        rememberMe: this.loginForm.value.rememberMe
      };

      // Handle remember me functionality
      //this.handleRememberMe(loginData.rememberMe, loginData.email);

      // Call authentication service
      this.authenticateUser(loginData);
    } else {
      this.errorMessage = 'Please fill in all required fields correctly.';
    }
  }

  /**
   * Handle user authentication
   */
  private authenticateUser(loginData: LoginRequest): void {
    this.userService.login({ email: loginData.email, password: loginData.password })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => this.handleLoginError(error)
      });
  }

  /**
   * Simulate login for demo purposes
   */
  private simulateLogin(loginData: LoginRequest): void {}

  /**
   * Handle successful login
   */
  private handleLoginSuccess(): void {}

  /**
   * Handle login errors
   */
  private handleLoginError(error: any): void {
    this.isLoading = false;

    // Prefer backend-provided message when available
    const backendMsg = (typeof error?.error === 'string')
      ? error.error
      : (error?.error?.error || error?.error?.message || '');

    if (backendMsg) {
      // Check if the error indicates account not activated
      if (backendMsg.toLowerCase().includes('account not activated') ||
          backendMsg.toLowerCase().includes('account is disabled') ||
          backendMsg.toLowerCase().includes('account not enabled')) {
        this.router.navigate(['/auth/activate-account'], {
          queryParams: { email: this.loginForm.value.email.trim().toLowerCase() }
        });
        return;
      }
      this.errorMessage = backendMsg;
      return;
    }

    if (error.status === 401) {
      this.errorMessage = 'Invalid email or password. Please try again.';
    } else if (error.status === 423) {
      this.errorMessage = 'Account is locked. Please contact support.';
    } else if (error.status === 403) {
      this.errorMessage = 'Account is disabled. Please contact support.';
    } else if (error.status === 400) {
      this.errorMessage = 'Invalid credentials or validation failed.';
    } else if (error.status === 0) {
      this.errorMessage = 'Network error. Please check your connection.';
    } else {
      this.errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    }

    console.error('Login error:', error);
  }

  /**
   * Handle remember me functionality
   */
  private handleRememberMe(rememberMe: boolean, email: string): void {
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
  }

  /**
   * Update connection information (from ConnexionInformation entity)
   */
  private updateConnectionInformation(): void {
    // This would typically be handled by your backend
    // Here's a mock implementation
    const connectionInfo: Partial<ConnexionInformation> = {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      latitude: 0,
      longitude: 0,
      internetProvider: 'Unknown',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ipAdress: '127.0.0.1', // This should come from your backend
      isVpn: false,
      deviceBrand: 'Unknown',
      deviceName: 'Unknown',
      deviceType: 'Desktop',
      operatingSystemVersion: 'Unknown',
      operatingSystemName: navigator.platform,
      isApproved: true
    };

    console.log('Connection information:', connectionInfo);
    // Send this to your backend to store the connection information
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Handle forgot password flow
   */
  onForgotPassword(): void {
    const email = this.loginForm.get('email')?.value;

    if (email && this.loginForm.get('email')?.valid) {
      // Navigate to forgot password page with email pre-filled
      this.router.navigate(['/forgot-password'], {
        queryParams: { email: email }
      });
    } else {
      // Navigate to forgot password page without email
      this.router.navigate(['/forgot-password']);
    }

    // Alternatively, show a modal:
    // this.openForgotPasswordModal();
  }

  /**
   * Switch to registration view
   */
  switchToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  /**
   * Handle social login
   */
  onSocialLogin(provider: string): void {
    this.isLoading = true;

    // Implement social login logic based on your provider
    switch (provider) {
      case 'google':
        this.loginWithGoogle();
        break;
      case 'apple':
        this.loginWithApple();
        break;
      default:
        console.warn('Unknown social provider:', provider);
        this.isLoading = false;
    }
  }

  /**
   * Google OAuth login
   */
  private loginWithGoogle(): void {
    console.log('Initiating Google login...');
    // Implement Google OAuth
    // this.authService.loginWithGoogle().subscribe(...);

    // Simulate social login
    setTimeout(() => {
      this.isLoading = false;
      // this.notificationService.showInfo('Google login would be implemented here', 'Info');
    }, 1000);
  }

  /**
   * Apple OAuth login
   */
  private loginWithApple(): void {
    console.log('Initiating Apple login...');
    // Implement Apple OAuth
    // this.authService.loginWithApple().subscribe(...);

    // Simulate social login
    setTimeout(() => {
      this.isLoading = false;
      // this.notificationService.showInfo('Apple login would be implemented here', 'Info');
    }, 1000);
  }

  /**
   * Utility function to mark all form fields as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Get form field validation state
   */
  getFieldValidationState(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field) return '';

    if (field.touched && field.invalid) {
      return 'error';
    } else if (field.touched && field.valid) {
      return 'success';
    }
    return '';
  }

  /**
   * Demo function to simulate different login scenarios
   */
  simulateDifferentScenarios(scenario: string): void {
    switch (scenario) {
      case 'success':
        this.loginForm.patchValue({
          email: 'success@demo.com',
          password: 'validpassword'
        });
        break;
      case 'invalid':
        this.loginForm.patchValue({
          email: 'invalid@demo.com',
          password: 'wrongpassword'
        });
        break;
      case 'locked':
        this.loginForm.patchValue({
          email: 'locked@demo.com',
          password: 'anypassword'
        });
        break;
    }
  }
}
