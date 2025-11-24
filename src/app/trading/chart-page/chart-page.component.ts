import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable, Subject, Subscription, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { MarketConnectorProvider, MarketConnectorStream } from '../services/market-connector.service';
import { MarketCandle, MarketDataService } from '../../services/market-data.service';
import { ChartTradeMarker } from '../chart-trading/chart-trading.component';
import { TradeMarkerResponse } from '../models/trade.model';
import { UTCTimestamp } from 'lightweight-charts';
import { SimulationDataService } from '../services/simulation-data.service';
import { SimulationConfig, SimulationTimeframe } from '../models/simulation.model';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-chart-page',
  templateUrl: './chart-page.component.html',
  styleUrls: ['./chart-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartPageComponent implements OnInit, OnDestroy {
  readonly providers: { value: MarketConnectorProvider; label: string }[] = [
    { value: 'binance', label: 'Binance' },
    { value: 'coingecko', label: 'CoinGecko' }
  ];

  readonly streams: { value: MarketConnectorStream; label: string }[] = [
    { value: 'spot', label: 'Spot' },
    { value: 'futures', label: 'Futures' },
    { value: 'index', label: 'Index' },
    { value: 'backtest', label: 'Backtest' },
    { value: 'simulated', label: 'Simulé' }
  ];

  readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  readonly defaultSymbol = 'BTCUSDT';

  readonly chartForm: FormGroup = this.fb.group({
    symbol: [this.defaultSymbol],
    provider: ['binance'],
    stream: ['spot'],
    interval: ['1h'],
    pollInterval: [8000]
  });

  chartInitialData: MarketCandle[] | null = null;
  chartMarkers: ChartTradeMarker[] = [];
  readonly chartTicks$ = new Subject<MarketCandle>();

  loading = false;
  error?: string;
  lastUpdated?: Date;
  fallbackActive = false;
  fallbackInfo?: string;

  private pollSub?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly marketDataService: MarketDataService,
    private readonly orderService: OrderService,
    private readonly simulationData: SimulationDataService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadChart();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.chartTicks$.complete();
  }

  get selectedSymbol(): string {
    return (this.chartForm.value['symbol'] as string)?.toUpperCase() || this.defaultSymbol;
  }

  get selectedProvider(): MarketConnectorProvider {
    return this.chartForm.value['provider'] as MarketConnectorProvider;
  }

  get selectedStream(): MarketConnectorStream {
    return this.chartForm.value['stream'] as MarketConnectorStream;
  }

  get selectedInterval(): string {
    return this.chartForm.value['interval'] as string;
  }

  get pollInterval(): number {
    return Number(this.chartForm.value['pollInterval']) || 8000;
  }

  onSelectTimeframe(tf: string): void {
    this.chartForm.patchValue({ interval: tf });
    this.loadChart();
  }

  onApplySettings(): void {
    this.loadChart();
  }

  private loadChart(): void {
    this.loading = true;
    this.error = undefined;
    this.fallbackActive = false;
    this.fallbackInfo = undefined;
    this.pollSub?.unsubscribe();

    this.marketDataService
      .getHistoricalCandles(this.selectedSymbol, this.selectedInterval, 500)
      .pipe(
        catchError((err) => {
          console.error('[ChartPage] candles error', err);
          this.useFallbackDataset('Impossible de charger les données du marché.');
          return [];
        })
      )
      .subscribe({
        next: (candles) => {
          this.chartInitialData = candles;
          this.lastUpdated = new Date();
          this.loading = false;
          this.fetchMarkers();
          this.cdr.markForCheck();
          this.beginPolling();
        }
      });
  }

  private beginPolling(): void {
    this.pollSub?.unsubscribe();
    if (this.fallbackActive) {
      return;
    }
    this.pollSub = timer(this.pollInterval, this.pollInterval)
      .pipe(
        switchMap(() =>
          this.marketDataService
            .streamRealtimeCandles(this.selectedSymbol, this.selectedInterval)
            .pipe(
              catchError((err) => {
                console.error('[ChartPage] polling error', err);
                return [];
              })
            )
        )
      )
      .subscribe((candle) => {
        if (!candle) {
          return;
        }
        this.chartTicks$.next(candle);
        this.lastUpdated = new Date();
        this.cdr.markForCheck();
        this.fetchMarkers();
      });
  }

  private fetchMarkers(): void {
    this.orderService
      .getTradeMarkersForSymbol(this.selectedSymbol, { limit: 300 })
      .pipe(
        catchError((err) => {
          console.error('[ChartPage] markers error', err);
          return [];
        })
      )
      .subscribe((trades) => {
        this.renderTradeMarkers(trades);
        this.cdr.markForCheck();
      });
  }

  renderTradeMarkers(trades: TradeMarkerResponse[] | null): void {
    if (!trades || !trades.length) {
      this.chartMarkers = [];
      return;
    }
    const mapped: ChartTradeMarker[] = trades
      .filter((trade) => !!trade && !!trade.timestamp)
      .map((trade) => ({
        id: trade.id != null ? trade.id.toString() : `${trade.symbol}-${trade.timestamp}`,
        symbol: (trade.symbol || this.selectedSymbol).toUpperCase(),
        type: (trade.type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
        price: Number(trade.price) || 0,
        quantity: Number(trade.quantity) || 0,
        timestamp: trade.timestamp,
        status: trade.status,
        time: this.toTimestamp(trade.timestamp)
      }));
    this.chartMarkers = mapped.sort((a, b) => a.time - b.time);
  }

  private toTimestamp(value: string | number | Date): UTCTimestamp {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000) as UTCTimestamp;
    }
    if (typeof value === 'string') {
      return Math.floor(Date.parse(value) / 1000) as UTCTimestamp;
    }
    const normalized = value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
    return normalized as UTCTimestamp;
  }

  private async useFallbackDataset(message: string): Promise<void> {
    try {
      const config = this.buildFallbackConfig();
      const fallback = await this.simulationData.loadDataSet(config);
      this.chartInitialData = fallback.candles;
      this.chartMarkers = [];
      this.fallbackActive = true;
      this.fallbackInfo = `${message} · affichage en mode démo`;
      this.loading = false;
      this.error = undefined;
      this.lastUpdated = new Date();
      this.cdr.markForCheck();
    } catch (fallbackErr) {
      console.error('[ChartPage] fallback error', fallbackErr);
      this.error = message;
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private buildFallbackConfig(): SimulationConfig {
    const tfMap: Record<string, SimulationTimeframe> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1h',
      '1w': '4h'
    };
    const interval = tfMap[this.selectedInterval] ?? '1h';
    return {
      symbol: this.selectedSymbol,
      displayName: `${this.selectedSymbol} · DEMO`,
      dataMode: 'synthetic',
      broker: 'binance',
      timeframe: interval,
      dataSpan: '1Y',
      speed: 60,
      leverage: 1,
      slippagePct: 0,
      quantity: 1,
      syntheticSeed: Math.random() * 1000
    };
  }

}

