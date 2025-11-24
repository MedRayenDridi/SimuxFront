import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MarketCandle, MarketDataService } from '../../services/market-data.service';
import {
  SimulationConfig,
  SimulationDataSourceResult,
  SimulationDataSpan,
  SimulationDataMode,
  SimulationTimeframe
} from '../models/simulation.model';
import { UTCTimestamp } from 'lightweight-charts';

const DEFAULT_SPAN_MAP: Record<SimulationDataSpan, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365
};

const TIMEFRAME_TO_MINUTES: Record<SimulationTimeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240
};

@Injectable({
  providedIn: 'root'
})
export class SimulationDataService {
  constructor(private readonly marketDataService: MarketDataService) {}

  async loadDataSet(config: SimulationConfig): Promise<SimulationDataSourceResult> {
    switch (config.dataMode) {
      case 'spot':
      case 'futures':
      case 'index':
      case 'multi-broker':
      case 'backtest':
        return this.loadMarketDataset(config);
      case 'synthetic':
      default:
        return this.loadSyntheticDataset(config);
    }
  }

  private async loadMarketDataset(config: SimulationConfig): Promise<SimulationDataSourceResult> {
    const limit = this.estimateBarCount(config);
    const symbol = config.symbol || 'BTCUSDT';
    const candles = await firstValueFrom(
      this.marketDataService.getHistoricalCandles(symbol, config.timeframe, limit)
    );
    return {
      symbol,
      timeframe: config.timeframe,
      candles
    };
  }

  private loadSyntheticDataset(config: SimulationConfig): SimulationDataSourceResult {
    const bars = this.estimateBarCount(config);
    const candles: MarketCandle[] = [];
    let price = this.seedPrice(config);
    let timestamp = Number(this.seedTimestamp(config));

    for (let i = 0; i < bars; i++) {
      const drift = 0.0002;
      const volatility = 0.02;
      const randomShock = this.gaussianRandom() * volatility;
      const pctChange = drift + randomShock;
      const close = Math.max(0.0001, price * (1 + pctChange));
      const high = Math.max(close, price) * (1 + Math.abs(randomShock) * 0.5);
      const low = Math.min(close, price) * (1 - Math.abs(randomShock) * 0.5);
      const open = price;
      const volume = Math.abs(randomShock) * 1500 + 500;

      candles.push({
        time: Math.floor(timestamp) as UTCTimestamp,
        open,
        high,
        low,
        close,
        volume
      });

      price = close;
      timestamp += TIMEFRAME_TO_MINUTES[config.timeframe] * 60;
    }

    return {
      symbol: config.symbol,
      timeframe: config.timeframe,
      candles
    };
  }

  private estimateBarCount(config: SimulationConfig): number {
    const days = DEFAULT_SPAN_MAP[config.dataSpan] ?? 30;
    const minutesPerDay = 24 * 60;
    const timeframeMinutes = TIMEFRAME_TO_MINUTES[config.timeframe] ?? 1;
    return Math.max(300, Math.floor((days * minutesPerDay) / timeframeMinutes));
  }

  private seedPrice(config: SimulationConfig): number {
    const base = config.symbol.toUpperCase().startsWith('ETH') ? 2000 : 30000;
    return base + (config.syntheticSeed ?? 0);
  }

  private seedTimestamp(config: SimulationConfig): UTCTimestamp {
    if (config.startDate) {
      return Math.floor(Date.parse(config.startDate) / 1000) as UTCTimestamp;
    }
    const now = Date.now();
    const offsetDays = DEFAULT_SPAN_MAP[config.dataSpan] ?? 30;
    return Math.floor((now - offsetDays * 24 * 60 * 60 * 1000) / 1000) as UTCTimestamp;
  }

  private gaussianRandom(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

