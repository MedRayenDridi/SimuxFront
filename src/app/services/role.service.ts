import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Role, RoleRequest, UpdateRoleRequest } from '../core/Models/user.model';


@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private apiUrl = 'http://localhost:8080/role';

  constructor(private http: HttpClient) {}

  addRole(roleRequest: RoleRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/addRole`, roleRequest);
  }

  deleteRole(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/deleteRole/${id}`);
  }

  getAllRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/allRoles`);
  }

  getRole(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/getRole/${id}`);
  }

  updateRole(updateRoleRequest: UpdateRoleRequest): Observable<any> {
    return this.http.patch(`${this.apiUrl}/updateRole`, updateRoleRequest);
  }
}