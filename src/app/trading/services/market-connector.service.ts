import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MarketCandle } from '../../services/market-data.service';
import { UTCTimestamp } from 'lightweight-charts';
import { TradeMarkerResponse } from '../models/trade.model';

export type MarketConnectorProvider = 'binance' | 'coingecko';
export type MarketConnectorStream = 'spot' | 'futures' | 'index' | 'backtest' | 'simulated';

interface ConnectorCandleDto {
  timestamp: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ConnectorMarkerDto extends TradeMarkerResponse {
  provider?: string;
  stream?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarketConnectorService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient) {}

  fetchCandles(
    provider: MarketConnectorProvider,
    stream: MarketConnectorStream,
    symbol: string,
    interval: string,
    limit: number
  ): Observable<MarketCandle[]> {
    const url = `${this.baseUrl}/connectors/${provider}/${stream}/ohlc`;
    const params = new HttpParams({
      fromObject: {
        symbol,
        interval,
        limit: limit.toString()
      }
    });
    return this.http.get<ConnectorCandleDto[]>(url, { params }).pipe(map((rows) => rows.map((row) => this.toMarketCandle(row))));
  }

  fetchLatestCandle(
    provider: MarketConnectorProvider,
    stream: MarketConnectorStream,
    symbol: string,
    interval: string
  ): Observable<MarketCandle | null> {
    return this.fetchCandles(provider, stream, symbol, interval, 1).pipe(map((candles) => (candles.length ? candles[0] : null)));
  }

  fetchTradeMarkers(
    provider: MarketConnectorProvider,
    stream: MarketConnectorStream,
    symbol: string,
    interval: string
  ): Observable<ConnectorMarkerDto[]> {
    const url = `${this.baseUrl}/connectors/${provider}/${stream}/orders`;
    const params = new HttpParams({
      fromObject: {
        symbol,
        interval
      }
    });
    return this.http.get<ConnectorMarkerDto[]>(url, { params });
  }

  private toMarketCandle(dto: ConnectorCandleDto): MarketCandle {
    return {
      time: this.toTimestamp(dto.timestamp),
      open: Number(dto.open) || 0,
      high: Number(dto.high) || 0,
      low: Number(dto.low) || 0,
      close: Number(dto.close) || 0,
      volume: Number(dto.volume) || 0
    };
  }

  private toTimestamp(value: number | string): UTCTimestamp {
    if (typeof value === 'number') {
      return (value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)) as UTCTimestamp;
    }
    const parsed = Date.parse(value);
    return Math.floor(parsed / 1000) as UTCTimestamp;
  }
}

