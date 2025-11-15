import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  showDemoBanner = true; // Set based on your environment

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.registerForm = this.createForm();
  }

  createForm(): FormGroup {
    return this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', Validators.required],
      gender: ['', Validators.required],
      aiTonePreference: ['FORMAL', Validators.required],
      financialKnowledgeLevel: ['BEGINNER', Validators.required],
      profession: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      agreeToTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl) {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  getPasswordStrength(): string {
    const password = this.registerForm.get('password')?.value;
    if (!password) return 'weak';
    
    const strength = password.length;
    if (strength < 8) return 'weak';
    if (strength < 12) return 'medium';
    return 'strong';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    switch (strength) {
      case 'weak': return 'Weak password';
      case 'medium': return 'Medium strength';
      case 'strong': return 'Strong password';
      default: return '';
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading = true;
      const formValue = this.registerForm.value;

      const formattedDate = this.formatDateToBackend(formValue.dateOfBirth);
      const payload = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        password: formValue.password,
        gender: formValue.gender,
        aiTonePreference: formValue.aiTonePreference,
        financialKnowledgeLevel: formValue.financialKnowledgeLevel,
        profession: formValue.profession,
        dateOfBirth: formattedDate,
        phoneNumber: this.ensureTunisianPhone(formValue.phoneNumber)
      };

      this.userService.register(payload).subscribe({
        next: (res: string) => {
          this.isLoading = false;
          this.errorMessage = '';
          // Optionally show toast or banner using res (e.g., "Registered with success")
          // Navigate to login
          // In case you want to navigate: inject Router and navigate here
        },
        error: (err) => {
          this.isLoading = false;
          const raw = (typeof err?.error === 'string') ? err.error : (err?.error?.message || '');
          if (raw && raw.toLowerCase().includes('duplicate')) {
            this.errorMessage = 'This email is already registered. Please log in or use another email.';
          } else {
            this.errorMessage = raw || 'Registration failed';
          }
        }
      });
    }
  }

  onSocialLogin(provider: string): void {
    console.log('Social login with:', provider);
    // Implement social login logic
  }

  switchToLogin(): void {
    // Navigate to login page
  }

  onTermsClick(): void {
    // Open terms modal or navigate to terms page
  }

  onPrivacyClick(): void {
    // Open privacy modal or navigate to privacy page
  }

  private formatDateToBackend(dateInput: any): string {
    const d = new Date(dateInput);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  private ensureTunisianPhone(phone: string): string {
    const trimmed = (phone || '').replace(/\s|-/g, '');
    if (trimmed.startsWith('+216')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    return `+216${digits.slice(-8)}`;
  }
}