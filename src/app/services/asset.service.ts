import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Asset {
  id: number;
  coin: any;
  quantity: number;
  buyPrice: number;
  user?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private baseUrl = 'http://localhost:8090/api/asset';

  constructor(private http: HttpClient) { }

  getUserAssets(): Observable<Asset[]> {
    return this.http.get<Asset[]>(this.baseUrl);
  }

  getAssetById(assetId: number): Observable<Asset> {
    return this.http.get<Asset>(`${this.baseUrl}/${assetId}`);
  }

  getAssetByCoinId(coinId: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.baseUrl}/coin/${coinId}`);
  }
}
