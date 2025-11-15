import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-activate-account',
  templateUrl: './activate-account.component.html',
  styleUrls: ['./activate-account.component.css']
})
export class ActivateAccountComponent implements OnInit, OnDestroy {
  activationForm: FormGroup;
  resendForm: FormGroup;
  isLoading: boolean = false;
  showResendForm: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  email: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService
  ) {
    this.activationForm = this.createActivationForm();
    this.resendForm = this.createResendForm();
  }

  ngOnInit(): void {
    this.initializeFormListeners();
    this.checkQueryParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Create the activation form with validation
   */
  private createActivationForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      activationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  /**
   * Create the resend form
   */
  private createResendForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  /**
   * Initialize form value change listeners
   */
  private initializeFormListeners(): void {
    // Clear error message when user starts typing
    this.activationForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
        }
        if (this.successMessage) {
          this.successMessage = '';
        }
      });

    this.resendForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
        }
        if (this.successMessage) {
          this.successMessage = '';
        }
      });
  }

  /**
   * Check for email in query params
   */
  private checkQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['email']) {
          this.email = params['email'];
          this.activationForm.patchValue({ email: this.email });
          this.resendForm.patchValue({ email: this.email });
        }
      });
  }

  /**
   * Handle activation form submission
   */
  onActivate(): void {
    this.markFormGroupTouched(this.activationForm);

    if (this.activationForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const activationData = {
        email: this.activationForm.value.email.trim().toLowerCase(),
        activationCode: this.activationForm.value.activationCode
      };

      this.activateAccount(activationData);
    } else {
      this.errorMessage = 'Please fill in all required fields correctly.';
    }
  }

  /**
   * Handle account activation
   */
  private activateAccount(activationData: { email: string; activationCode: string }): void {
    this.userService.activateAccount(activationData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Account activated successfully! You can now log in.';
          setTimeout(() => {
            this.router.navigate(['/auth/login'], {
              queryParams: { email: activationData.email }
            });
          }, 2000);
        },
        error: (error) => this.handleActivationError(error)
      });
  }

  /**
   * Handle activation errors
   */
  private handleActivationError(error: any): void {
    this.isLoading = false;

    const backendMsg = (typeof error?.error === 'string')
      ? error.error
      : (error?.error?.error || error?.error?.message || '');

    if (backendMsg) {
      this.errorMessage = backendMsg;
      return;
    }

    if (error.status === 400) {
      this.errorMessage = 'Invalid activation code. Please check and try again.';
    } else if (error.status === 0) {
      this.errorMessage = 'Network error. Please check your connection.';
    } else {
      this.errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    }

    console.error('Activation error:', error);
  }

  /**
   * Handle resend activation code
   */
  onResendCode(): void {
    this.markFormGroupTouched(this.resendForm);

    if (this.resendForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const email = this.resendForm.value.email.trim().toLowerCase();

      this.resendActivationCode(email);
    } else {
      this.errorMessage = 'Please enter a valid email address.';
    }
  }

  /**
   * Resend activation code
   */
  private resendActivationCode(email: string): void {
    this.userService.resendActivationCode({ email })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Activation code sent! Please check your email.';
          this.showResendForm = false;
        },
        error: (error) => this.handleResendError(error)
      });
  }

  /**
   * Handle resend errors
   */
  private handleResendError(error: any): void {
    this.isLoading = false;

    const backendMsg = (typeof error?.error === 'string')
      ? error.error
      : (error?.error?.error || error?.error?.message || '');

    if (backendMsg) {
      this.errorMessage = backendMsg;
      return;
    }

    if (error.status === 400) {
      this.errorMessage = 'Unable to resend activation code. Please try again later.';
    } else if (error.status === 0) {
      this.errorMessage = 'Network error. Please check your connection.';
    } else {
      this.errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    }

    console.error('Resend error:', error);
  }

  /**
   * Toggle between activation and resend forms
   */
  toggleResendForm(): void {
    this.showResendForm = !this.showResendForm;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.showResendForm) {
      this.resendForm.patchValue({ email: this.activationForm.value.email });
    }
  }

  /**
   * Navigate back to login
   */
  goToLogin(): void {
    this.router.navigate(['/auth/login']);
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
  getFieldValidationState(fieldName: string, form: FormGroup = this.activationForm): string {
    const field = form.get(fieldName);
    if (!field) return '';

    if (field.touched && field.invalid) {
      return 'error';
    } else if (field.touched && field.valid) {
      return 'success';
    }
    return '';
  }
}
