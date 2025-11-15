import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChangeApprovalRequest, ConnexionInformation } from '../core/Models/user.model';

@Injectable({
  providedIn: 'root'
})
export class ConnexionInfoService {
  private apiUrl = 'http://localhost:8080/connexionInfo';

  constructor(private http: HttpClient) {}

  getAllCnxInfo(): Observable<ConnexionInformation[]> {
    return this.http.get<ConnexionInformation[]>(`${this.apiUrl}/getAll`);
  }

  getCnxInfoById(id: number): Observable<ConnexionInformation> {
    return this.http.get<ConnexionInformation>(`${this.apiUrl}/getById?id=${id}`);
  }

  deleteCnxInfo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/deleteById?id=${id}`);
  }

  changeApproval(changeApprovalRequest: ChangeApprovalRequest): Observable<any> {
    return this.http.patch(`${this.apiUrl}/changeApproval`, changeApprovalRequest);
  }

  approveLogin(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/approveLogIn?token=${token}`, {});
  }
}