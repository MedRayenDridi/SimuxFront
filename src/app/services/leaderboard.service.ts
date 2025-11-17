import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private baseUrl = 'http://localhost:8090/api/leaderboard';

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getGlobalLeaderboard(limit: number = 0): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/global?limit=${limit}`);
  }

  getCurrentUserStats(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user`, { 
      headers: this.getHeaders() 
    });
  }

  getCategoryLeaderboards(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/categories`);
  }

  getUserDetailedStats(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user/${userId}/detailed`);
  }
}
