import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Currency = 'USD' | 'TND';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly USD_TO_TND_RATE = 3.1; // 1 USD = 3.1 TND

  private currentCurrencySubject = new BehaviorSubject<Currency>('USD');
  public currentCurrency$ = this.currentCurrencySubject.asObservable();

  constructor() {
    // Load saved currency preference from localStorage
    const savedCurrency = localStorage.getItem('preferredCurrency') as Currency;
    if (savedCurrency && (savedCurrency === 'USD' || savedCurrency === 'TND')) {
      this.currentCurrencySubject.next(savedCurrency);
    }
  }

  get currentCurrency(): Currency {
    return this.currentCurrencySubject.value;
  }

  setCurrency(currency: Currency): void {
    this.currentCurrencySubject.next(currency);
    localStorage.setItem('preferredCurrency', currency);
  }

  toggleCurrency(): void {
    const newCurrency = this.currentCurrency === 'USD' ? 'TND' : 'USD';
    this.setCurrency(newCurrency);
  }

  convertToCurrent(amount: number): number {
    if (this.currentCurrency === 'TND') {
      return amount * this.USD_TO_TND_RATE;
    }
    return amount;
  }

  formatPrice(amount: number): string {
    const convertedAmount = this.convertToCurrent(amount);
    return convertedAmount.toFixed(2);
  }

  getCurrencySymbol(): string {
    return this.currentCurrency === 'USD' ? '$' : 'TND';
  }

  getCurrencyLabel(): string {
    return this.currentCurrency === 'USD' ? 'USD' : 'TND';
  }
}
