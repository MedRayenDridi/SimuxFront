import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Order {
  id?: number;
  user?: any;
  orderItem: OrderItem;
  orderType: string;
  price: number;
  timestamp?: string;
  status: string;
}

export interface OrderItem {
  id?: number;
  coin: any;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
}

export interface CreateOrderRequest {
  coinId: string;
  quantity: number;
  orderType: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private baseUrl = 'http://localhost:8090/order';

  constructor(private http: HttpClient) { }

  processOrder(coinId: string, quantity: number, orderType: string): Observable<Order> {
    const request: CreateOrderRequest = {
      coinId,
      quantity,
      orderType
    };
    
    console.log('📤 Processing order:', request);
    
    return this.http.post<Order>(`${this.baseUrl}/pay`, request).pipe(
      catchError(this.handleError)
    );
  }

  buyAsset(coinId: string, quantity: number): Observable<Order> {
    return this.processOrder(coinId, quantity, 'BUY');
  }

  sellAsset(coinId: string, quantity: number): Observable<Order> {
    return this.processOrder(coinId, quantity, 'SELL');
  }

  getOrderById(orderId: number): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${orderId}`).pipe(
      catchError(this.handleError)
    );
  }

  getAllUserOrders(orderType?: string, assetSymbol?: string): Observable<Order[]> {
    let params = new HttpParams();
    if (orderType) {
      params = params.set('order_type', orderType);
    }
    if (assetSymbol) {
      params = params.set('asset_symbol', assetSymbol);
    }
    return this.http.get<Order[]>(this.baseUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error Code: ${error.status}`;
      }
    }
    
    console.error('❌ Order Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
