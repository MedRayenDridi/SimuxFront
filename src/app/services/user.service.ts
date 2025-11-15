import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';


export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  profession: string;
  aiTonePreference: string;
  financialKnowledgeLevel: string;
  phoneNumber: string;
  role: any;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: string;
  profession: string;
  aiTonePreference: string;
  financialKnowledgeLevel: string;
  phoneNumber: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  role: string;
  email: string;
  id: number;
}

export interface ActivationRequest {
  email: string;
  activationCode: string;
}

export interface ResendActivationCodeRequest {
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8090/user';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  // Auth methods
  register(registerRequest: RegisterRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/register`, registerRequest, {
      responseType: 'text' as 'json'
    }) as unknown as Observable<string>;
  }

  login(loginRequest: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginRequest)
      .pipe(
        tap(response => {
          if (response && response.accessToken) {
            this.setTokens(response.accessToken, response.refreshToken);
            this.setSessionInfo({
              id: response.id,
              email: response.email,
              role: response.role
            });
          }
        })
      );
  }

  activateAccount(activationRequest: ActivationRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/activateAccount`, activationRequest, {
      responseType: 'text' as 'json'
    }) as unknown as Observable<string>;
  }

  resendActivationCode(resendRequest: ResendActivationCodeRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/resendActivationCode`, resendRequest, {
      responseType: 'text' as 'json'
    }) as unknown as Observable<string>;
  }

  logout(): void {
    this.removeAuthData();
    this.router.navigate(['/']);
  }

  // Utility methods
  private setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem('auth_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
  }

  private setSessionInfo(session: { id: number; email: string; role: string }): void {
    localStorage.setItem('session_user', JSON.stringify(session));
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private removeAuthData(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('session_user');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  // Add this method for demo purposes
  setCurrentUserForDemo(user: User): void {
    this.setTokens('demo-token-12345');
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }
}
