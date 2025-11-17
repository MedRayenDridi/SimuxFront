import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  filter,
  interval,
  map,
  of,
  retry,
  shareReplay,
  startWith,
  switchMap
} from 'rxjs';
import { environment } from '../../environments/environment';
import { UTCTimestamp } from 'lightweight-charts';

export interface MarketCandleDto {
  time?: number | string | Date;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string;
}

export interface MarketCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketChartResponse {
  symbol: string;
  interval: string;
  candles: MarketCandleDto[];
}

const defaultConfig = {
  baseUrl: 'http://localhost:8090',
  chartEndpoint: '/coins',
  defaultSymbol: 'btc',
  defaultInterval: '1h',
  candleLimit: 500,
  pollIntervalMs: 15000
};

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private readonly config = { ...defaultConfig, ...(environment as any).marketDataConfig };
  private readonly chartBaseUrl = `${(this.config.baseUrl || '').replace(/\/$/, '')}${
    (this.config.chartEndpoint || '').startsWith('/') ? this.config.chartEndpoint : `/${this.config.chartEndpoint || ''}`
  }`;

  constructor(private http: HttpClient) {}

  getHistoricalCandles(
    symbol: string = this.config.defaultSymbol,
    intervalParam: string = this.config.defaultInterval,
    limit: number = this.config.candleLimit
  ): Observable<MarketCandle[]> {
    const url = this.buildChartUrl(symbol);
    const params = new HttpParams({
      fromObject: {
        interval: intervalParam,
        limit: limit.toString()
      }
    });

    return this.http.get<MarketChartResponse>(url, { params }).pipe(
      map((response) =>
        (response?.candles || [])
          .map((dto) => this.normalizeCandle(dto))
          .sort((a, b) => a.time - b.time)
      ),
      retry({
        count: environment.retryAttempts ?? 0,
        delay: environment.retryDelay ?? 0
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  streamRealtimeCandles(
    symbol: string = this.config.defaultSymbol,
    intervalParam: string = this.config.defaultInterval
  ): Observable<MarketCandle> {
    const url = this.buildChartUrl(symbol);

    return interval(this.config.pollIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() => {
          const params = new HttpParams({ fromObject: { interval: intervalParam, limit: '2' } });
          return this.http.get<MarketChartResponse>(url, { params });
        }),
        map((response) => {
          const candles = response?.candles || [];
          const latest = candles[candles.length - 1];
          return latest ? this.normalizeCandle(latest) : null;
        }),
        catchError((error) => {
          console.error('[MarketDataService] Polling error', error);
          return of(null);
        }),
        filter((candle): candle is MarketCandle => candle !== null),
        shareReplay({ bufferSize: 1, refCount: true })
      );
  }

  private buildChartUrl(symbol: string): string {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    return `${this.chartBaseUrl}/${normalizedSymbol}/chart`;
  }

  private normalizeSymbol(symbol: string): string {
    if (!symbol) {
      return this.config.defaultSymbol;
    }
    return symbol.replace(/usdt$/i, '').toLowerCase();
  }

  private normalizeCandle(dto: MarketCandleDto): MarketCandle {
    const time = this.toUtcTimestamp(dto.time ?? Date.now());
    return {
      time,
      open: this.toNumber(dto.open),
      high: this.toNumber(dto.high),
      low: this.toNumber(dto.low),
      close: this.toNumber(dto.close),
      volume: this.toNumber(dto.volume ?? 0)
    };
  }

  private toNumber(value: number | string | undefined): number {
    if (value === undefined || value === null) {
      return 0;
    }
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toUtcTimestamp(value: number | string | Date): UTCTimestamp {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000) as UTCTimestamp;
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Math.floor(parsed / 1000) as UTCTimestamp;
    }

    if (value > 1_000_000_000_000) {
      return Math.floor(value / 1000) as UTCTimestamp;
    }

    return Math.floor(value) as UTCTimestamp;
  }
}
