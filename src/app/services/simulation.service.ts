import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private baseUrl = 'http://localhost:8090/api/simulation';

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  predictOneYear(): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/predict-year`, {});
  }

  getCurrentUserPrediction(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user`, { 
      headers: this.getHeaders() 
    });
  }

  getUserPrediction(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}`);
  }

  getSimulationSummary(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/summary`);
  }
}
