import { MarketCandle } from '../../services/market-data.service';
import { UTCTimestamp } from 'lightweight-charts';

export type SimulationDataMode =
  | 'spot'
  | 'futures'
  | 'index'
  | 'multi-broker'
  | 'backtest'
  | 'synthetic';

export type SimulationBroker = 'binance' | 'bybit' | 'okx' | 'kraken' | 'coinbase';

export type SimulationSpeedMultiplier = 1 | 2 | 5 | 10 | 30 | 60;

export type SimulationTimeframe = '1m' | '5m' | '15m' | '1h' | '4h';

export type SimulationDataSpan = '1M' | '3M' | '6M' | '1Y';

export interface SimulationConfig {
  symbol: string;
  displayName: string;
  dataMode: SimulationDataMode;
  broker: SimulationBroker;
  timeframe: SimulationTimeframe;
  dataSpan: SimulationDataSpan;
  speed: SimulationSpeedMultiplier;
  leverage: number;
  slippagePct: number;
  quantity: number;
  syntheticSeed?: number;
  startDate?: string;
}

export interface SimulationStatus {
  ready: boolean;
  playing: boolean;
  speed: SimulationSpeedMultiplier;
  currentCandle?: MarketCandle;
  progress: number;
  broker: SimulationBroker;
  dataMode: SimulationDataMode;
  symbol: string;
  timeframe: SimulationTimeframe;
  totalPnL: number;
  totalPnLPercent: number;
}

export interface SimulationTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  leverage: number;
  slippagePct: number;
  entryTime: UTCTimestamp;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  status: 'OPEN' | 'CLOSED';
  exitTime?: UTCTimestamp;
  exitPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface SimulationDataSourceResult {
  symbol: string;
  timeframe: SimulationTimeframe;
  candles: MarketCandle[];
}

export interface SimulationTradeRequest {
  side: 'BUY' | 'SELL';
  quantity: number;
  leverage: number;
  slippagePct: number;
  takeProfit?: number;
  stopLoss?: number;
}

