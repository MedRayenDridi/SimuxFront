import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Wallet {
  id: number;
  balance: number;
  user?: any;
}

export interface WalletTransaction {
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private baseUrl = 'http://localhost:8090/api/wallet';

  constructor(private http: HttpClient) { }

  getUserWallet(): Observable<Wallet> {
    return this.http.get<Wallet>(this.baseUrl);
  }

  depositToWallet(orderId: number, paymentId: string): Observable<Wallet> {
    const params = new HttpParams()
      .set('order_id', orderId.toString())
      .set('payment_id', paymentId);
    return this.http.put<Wallet>(`${this.baseUrl}/order/deposit`, null, { params });
  }

  walletToWalletTransfer(walletId: number, amount: number): Observable<Wallet> {
    const transaction: WalletTransaction = { amount };
    return this.http.put<Wallet>(`${this.baseUrl}/${walletId}/transfer`, transaction);
  }

  payOrderPayment(orderId: number): Observable<Wallet> {
    return this.http.put<Wallet>(`${this.baseUrl}/order/${orderId}/pay`, null);
  }
}
