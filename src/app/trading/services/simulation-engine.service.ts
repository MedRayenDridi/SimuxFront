import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { MarketCandle } from '../../services/market-data.service';
import {
  SimulationConfig,
  SimulationStatus,
  SimulationTrade,
  SimulationTradeRequest,
  SimulationSpeedMultiplier
} from '../models/simulation.model';
import { SimulationDataService } from './simulation-data.service';
import { ChartTradeMarker } from '../chart-trading/chart-trading.component';
import { UTCTimestamp } from 'lightweight-charts';

const SPEED_LABEL: Record<SimulationSpeedMultiplier, string> = {
  1: 'x1',
  2: 'x2',
  5: 'x5',
  10: 'x10',
  30: 'x30',
  60: 'x60'
};

@Injectable({
  providedIn: 'root'
})
export class SimulationEngineService {
  private config?: SimulationConfig;
  private dataset: MarketCandle[] = [];
  private pointer = 0;
  private bootstrapCount = 300;
  private clockSub?: Subscription;
  private playing = false;
  private lastCandle?: MarketCandle;

  private readonly ticksSubject = new Subject<MarketCandle>();
  private readonly initialSubject = new BehaviorSubject<MarketCandle[] | null>(null);
  private readonly statusSubject = new BehaviorSubject<SimulationStatus>({
    ready: false,
    playing: false,
    speed: 1,
    progress: 0,
    broker: 'binance',
    dataMode: 'spot',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    totalPnL: 0,
    totalPnLPercent: 0
  });
  private readonly tradesSubject = new BehaviorSubject<SimulationTrade[]>([]);
  private readonly markersSubject = new BehaviorSubject<ChartTradeMarker[]>([]);

  readonly ticks$ = this.ticksSubject.asObservable();
  readonly initial$ = this.initialSubject.asObservable();
  readonly status$ = this.statusSubject.asObservable();
  readonly trades$ = this.tradesSubject.asObservable();
  readonly markers$ = this.markersSubject.asObservable();

  constructor(
    private readonly dataService: SimulationDataService,
    private readonly ngZone: NgZone
  ) {}

  async start(config: SimulationConfig): Promise<void> {
    this.stopClock();
    this.config = config;
    this.statusSubject.next({
      ready: false,
      playing: false,
      speed: config.speed,
      progress: 0,
      broker: config.broker,
      dataMode: config.dataMode,
      symbol: config.symbol,
      timeframe: config.timeframe,
      totalPnL: 0,
      totalPnLPercent: 0
    });

    const dataset = await this.dataService.loadDataSet(config);
    this.dataset = dataset.candles.slice();
    this.bootstrapCount = Math.min(400, Math.floor(this.dataset.length * 0.25));
    this.pointer = this.bootstrapCount;
    this.lastCandle = this.dataset[this.pointer - 1];
    this.tradesSubject.next([]);
    this.markersSubject.next([]);
    this.initialSubject.next(this.dataset.slice(0, this.pointer));
    this.playing = true;
    this.statusSubject.next({
      ...this.statusSubject.value,
      ready: true,
      playing: true,
      currentCandle: this.lastCandle
    });
    this.configureClock();
  }

  pause(): void {
    this.playing = false;
    this.statusSubject.next({ ...this.statusSubject.value, playing: false });
  }

  resume(): void {
    if (!this.dataset.length) {
      return;
    }
    this.playing = true;
    this.statusSubject.next({ ...this.statusSubject.value, playing: true });
  }

  reset(): void {
    this.stopClock();
    this.dataset = [];
    this.pointer = 0;
    this.tradesSubject.next([]);
    this.markersSubject.next([]);
    this.initialSubject.next(null);
    this.statusSubject.next({
      ready: false,
      playing: false,
      speed: this.config?.speed ?? 1,
      progress: 0,
      broker: this.config?.broker ?? 'binance',
      dataMode: this.config?.dataMode ?? 'spot',
      symbol: this.config?.symbol ?? 'BTCUSDT',
      timeframe: this.config?.timeframe ?? '1m',
      totalPnL: 0,
      totalPnLPercent: 0
    });
  }

  updateSpeed(speed: SimulationSpeedMultiplier): void {
    if (!this.config) {
      return;
    }
    this.config = { ...this.config, speed };
    this.statusSubject.next({ ...this.statusSubject.value, speed });
    this.configureClock();
  }

  jumpTo(timestampIso: string): void {
    if (!this.dataset.length) {
      return;
    }
    const targetTs = Math.floor(Date.parse(timestampIso) / 1000);
    const index = this.dataset.findIndex((candle) => candle.time >= targetTs);
    if (index <= 0) {
      return;
    }
    this.pointer = Math.min(index, this.dataset.length - 1);
    const bootstrapStart = Math.max(0, this.pointer - this.bootstrapCount);
    this.initialSubject.next(this.dataset.slice(bootstrapStart, this.pointer));
    this.lastCandle = this.dataset[this.pointer - 1];
  }

  executeTrade(request: SimulationTradeRequest): void {
    if (!this.lastCandle || !this.config) {
      return;
    }
    const trade: SimulationTrade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: this.config.symbol,
      side: request.side,
      quantity: request.quantity,
      leverage: request.leverage,
      slippagePct: request.slippagePct,
      entryTime: this.lastCandle.time,
      entryPrice: this.lastCandle.close,
      currentPrice: this.lastCandle.close,
      pnl: 0,
      pnlPercent: 0,
      margin: (this.lastCandle.close * request.quantity) / Math.max(1, request.leverage),
      status: 'OPEN',
      takeProfit: request.takeProfit,
      stopLoss: request.stopLoss
    };

    const trades = [...this.tradesSubject.value, trade];
    this.tradesSubject.next(trades);
    this.markersSubject.next([
      ...this.markersSubject.value,
      this.toMarker(trade)
    ]);
  }

  private configureClock(): void {
    this.stopClock();
    if (!this.dataset.length || !this.config) {
      return;
    }

    const intervalMs = this.resolveIntervalPerCandle();
    this.clockSub = interval(intervalMs)
      .pipe(map(() => null))
      .subscribe(() => {
        if (!this.playing) {
          return;
        }
        this.emitNextCandle();
      });
  }

  private emitNextCandle(): void {
    if (this.pointer >= this.dataset.length) {
      this.playing = false;
      this.statusSubject.next({ ...this.statusSubject.value, playing: false, progress: 100 });
      this.stopClock();
      return;
    }

    const candle = this.dataset[this.pointer];
    this.pointer += 1;
    this.lastCandle = candle;
    this.updateTradesWithPrice(candle.close, candle.time);
    const progress = Math.min(100, (this.pointer / this.dataset.length) * 100);
    this.statusSubject.next({
      ...this.statusSubject.value,
      currentCandle: candle,
      progress
    });
    this.ngZone.run(() => this.ticksSubject.next(candle));
  }

  private updateTradesWithPrice(price: number, time: UTCTimestamp): void {
    const trades = this.tradesSubject.value.map((trade) => {
      if (trade.status === 'CLOSED') {
        return trade;
      }
      const direction = trade.side === 'BUY' ? 1 : -1;
      const priceDiff = (price - trade.entryPrice) * direction;
      const pnlRaw = priceDiff * trade.quantity * trade.leverage;
      const slippageFee = trade.entryPrice * trade.quantity * (trade.slippagePct / 100);
      const pnl = pnlRaw - slippageFee;
      const pnlPercent = (priceDiff / trade.entryPrice) * 100 * trade.leverage;
      const nextTrade: SimulationTrade = {
        ...trade,
        currentPrice: price,
        pnl,
        pnlPercent
      };

      if (trade.takeProfit && direction === 1 && price >= trade.takeProfit) {
        return this.closeTrade(nextTrade, price, time);
      }
      if (trade.takeProfit && direction === -1 && price <= trade.takeProfit) {
        return this.closeTrade(nextTrade, price, time);
      }
      if (trade.stopLoss && direction === 1 && price <= trade.stopLoss) {
        return this.closeTrade(nextTrade, price, time);
      }
      if (trade.stopLoss && direction === -1 && price >= trade.stopLoss) {
        return this.closeTrade(nextTrade, price, time);
      }

      return nextTrade;
    });

    this.tradesSubject.next(trades);

    const totalPnL = trades.reduce((acc, trade) => acc + trade.pnl, 0);
    const totalMargin = trades.reduce((acc, trade) => acc + trade.margin, 0) || 1;
    this.statusSubject.next({
      ...this.statusSubject.value,
      totalPnL,
      totalPnLPercent: (totalPnL / totalMargin) * 100
    });
  }

  private closeTrade(trade: SimulationTrade, price: number, time: UTCTimestamp): SimulationTrade {
    const closed: SimulationTrade = {
      ...trade,
      status: 'CLOSED',
      exitPrice: price,
      exitTime: time
    };
    this.markersSubject.next([
      ...this.markersSubject.value,
      this.toMarker({
        ...closed,
        side: trade.side === 'BUY' ? 'SELL' : 'BUY',
        entryPrice: price,
        entryTime: time,
        id: `${closed.id}-exit`
      })
    ]);
    return closed;
  }

  private toMarker(trade: SimulationTrade): ChartTradeMarker {
    return {
      id: trade.id,
      symbol: trade.symbol,
      type: trade.side,
      price: trade.entryPrice,
      quantity: trade.quantity,
      timestamp: new Date(trade.entryTime * 1000).toISOString(),
      status: trade.status,
      time: trade.entryTime
    };
  }

  private resolveIntervalPerCandle(): number {
    if (!this.config || this.dataset.length <= this.bootstrapCount) {
      return 250;
    }
    const remaining = this.dataset.length - this.bootstrapCount;
    const baseDuration = 60_000; // 1 minute for full replay
    const msPerCandle = baseDuration / remaining;
    return Math.max(16, msPerCandle / this.config.speed);
  }

  private stopClock(): void {
    this.clockSub?.unsubscribe();
    this.clockSub = undefined;
  }
}

