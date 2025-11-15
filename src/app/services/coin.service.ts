import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCapChange24h: number;
  marketCapChangePercentage24h: number;
  totalSupply: number;
  // Support snake_case from backend
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  total_supply?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CoinService {
  private baseUrl = 'http://localhost:8090/coins'; // Adjust to your Spring Boot port

  constructor(private http: HttpClient) { }

  getCoinList(page: number): Observable<any[]> {
    const params = new HttpParams().set('page', page.toString());
    return this.http.get<any[]>(this.baseUrl, { params });
  }

  getMarketChart(coinId: string, days: number): Observable<any> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get(`${this.baseUrl}/${coinId}/chart`, { params });
  }

  searchCoin(keyword: string): Observable<any> {
    const params = new HttpParams().set('q', keyword);
    return this.http.get(`${this.baseUrl}/search`, { params });
  }

  getTop50Coins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/top50`);
  }

  getTrendingCoins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trading`);
  }

  getCoinDetails(coinId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/details/${coinId}`);
  }
}
