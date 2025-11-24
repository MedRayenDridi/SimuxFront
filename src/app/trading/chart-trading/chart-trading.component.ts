import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CandlestickData,
  CandlestickSeries,
  CrosshairMode,
  HistogramData,
  HistogramSeries,
  IChartApi,
  IPriceLine,
  IRange,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LineSeries,
  LineStyle,
  LineWidth,
  MouseEventParams,
  SeriesMarker,
  Time,
  UTCTimestamp,
  createChart,
  createSeriesMarkers
} from 'lightweight-charts';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { Observable, fromEvent, Subject, Subscription } from 'rxjs';
import { MarketCandle, MarketDataService } from '../../services/market-data.service';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { Order, OrderService } from '../../services/order.service';
import { TradeMarkerResponse } from '../models/trade.model';

const defaults = environment.marketDataConfig ?? {
  defaultSymbol: 'btc',
  defaultInterval: '1h',
  candleLimit: 500
};
const TRADE_MARKER_POLL_MS = 15000;

export interface ChartTradeMarker {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: string;
  status?: string;
  time: UTCTimestamp;
}

type IndicatorType =
  | 'SMA'
  | 'EMA'
  | 'BOLLINGER'
  | 'RSI'
  | 'MACD'
  | 'VOLUME'
  | 'VWAP'
  | 'ATR'
  | 'SUPER_TREND';

type IndicatorSeriesKind = 'line' | 'histogram';

type IndicatorParams = Record<string, string | number | boolean>;

interface IndicatorControl {
  key: string;
  label: string;
  type: 'number' | 'color' | 'text';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface IndicatorMeta {
  type: IndicatorType;
  label: string;
  description: string;
  overlay: boolean;
  defaults: IndicatorParams;
  controls: IndicatorControl[];
}

interface IndicatorSeriesHandle {
  role: string;
  kind: IndicatorSeriesKind;
  series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;
}

interface IndicatorPayload {
  role: string;
  kind: IndicatorSeriesKind;
  data: LineData<Time>[] | HistogramData<Time>[];
}

interface IndicatorPriceLineRef {
  series: ISeriesApi<'Line'>;
  line: IPriceLine;
}

interface IndicatorPaneRef {
  id: string;
  label: string;
  container: HTMLDivElement;
  chartHost: HTMLDivElement;
  chart: IChartApi;
  dispose: () => void;
}

interface IndicatorInstance {
  id: string;
  type: IndicatorType;
  label: string;
  overlay: boolean;
  params: IndicatorParams;
  series: IndicatorSeriesHandle[];
  priceLines: IndicatorPriceLineRef[];
  paneRef?: IndicatorPaneRef;
  chart?: IChartApi;
}

@Component({
  selector: 'app-chart-trading',
  templateUrl: './chart-trading.component.html',
  styleUrls: ['./chart-trading.component.css']
})
export class ChartTradingComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() symbol: string = defaults.defaultSymbol;
  @Input() displayName?: string;
  @Input() height = 520;
  @Input() mode: 'live' | 'simulation' | 'external' = 'live';

  @Input() set simulationInitialData(data: MarketCandle[] | null) {
    if (!this.isSimulation || !data || !data.length) {
      return;
    }
    if (!this.candleSeries) {
      this.pendingSimulationData = data;
      return;
    }
    this.initializeSimulationData(data);
  }

  @Input() set simulationTicks(source: Observable<MarketCandle> | null) {
    if (!this.isSimulation) {
      this.simulationTickSub?.unsubscribe();
      this.simulationTickSub = undefined;
      return;
    }
    this.simulationTickSub?.unsubscribe();
    if (source) {
      this.simulationTickSub = source.subscribe((candle) => this.handleSimulationTick(candle));
    }
  }

  @Input() set simulationMarkers(markers: ChartTradeMarker[] | null) {
    if (!this.isSimulation) {
      return;
    }
    if (!this.seriesMarkersPlugin) {
      this.pendingSimulationMarkers = markers ? [...markers] : [];
      return;
    }
    this.tradeMarkers = markers ? [...markers] : [];
    this.applyTradeMarkers();
  }

  @ViewChild('chartWrapper', { static: true }) chartWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chartTooltip', { static: true }) chartTooltip!: ElementRef<HTMLDivElement>;
  @ViewChild('tradeMarkerTooltip', { static: true }) tradeMarkerTooltip!: ElementRef<HTMLDivElement>;
  @ViewChild('indicatorPanesHost', { static: true }) indicatorPanesHost!: ElementRef<HTMLDivElement>;

  loading = true;
  error?: string;
  lastCandle?: MarketCandle;
  tradeMarkersEnabled = true;
  tradeMarkersLoading = false;
  tradeMarkersError?: string;

  readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  selectedTimeframe: string = defaults.defaultInterval;

  private chart?: IChartApi;
  private candleSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private crosshairHandler?: (param: MouseEventParams<Time>) => void;
  private seriesMarkersPlugin?: ISeriesMarkersPluginApi<Time>;

  private historicalSub?: Subscription;
  private realtimeSub?: Subscription;

  private readonly destroy$ = new Subject<void>();
  chartReady = false;
  private tradeMarkers: ChartTradeMarker[] = [];
  private candleTimeline: UTCTimestamp[] = [];
  private markerPollHandle?: number;
  private tradeMarkersSub?: Subscription;
  private readonly markerHoverThresholdPx = 22;
  private candles: MarketCandle[] = [];
  private indicatorPaneRefs = new Map<string, IndicatorPaneRef>();
  private simulationTickSub?: Subscription;
  private simulationBootstrapped = false;
  private pendingSimulationData?: MarketCandle[];
  private pendingSimulationMarkers?: ChartTradeMarker[] | null;
  indicatorStates: IndicatorInstance[] = [];
  readonly indicatorCatalog: IndicatorMeta[] = [
    {
      type: 'SMA',
      label: 'SMA',
      description: 'Moyenne mobile simple multi-périodes',
      overlay: true,
      defaults: {
        shortPeriod: 20,
        longPeriod: 50,
        colorA: '#22d3ee',
        colorB: '#0ea5e9',
        lineWidth: 2
      },
      controls: [
        { key: 'shortPeriod', label: 'Période courte', type: 'number', min: 2, max: 500 },
        { key: 'longPeriod', label: 'Période longue', type: 'number', min: 2, max: 500 },
        { key: 'colorA', label: 'Couleur courte', type: 'color' },
        { key: 'colorB', label: 'Couleur longue', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 5 }
      ]
    },
    {
      type: 'EMA',
      label: 'EMA',
      description: 'Moyenne mobile exponentielle',
      overlay: true,
      defaults: {
        shortPeriod: 12,
        longPeriod: 26,
        colorA: '#34d399',
        colorB: '#0ea5e9',
        lineWidth: 2
      },
      controls: [
        { key: 'shortPeriod', label: 'Période courte', type: 'number', min: 2, max: 500 },
        { key: 'longPeriod', label: 'Période longue', type: 'number', min: 2, max: 500 },
        { key: 'colorA', label: 'Couleur courte', type: 'color' },
        { key: 'colorB', label: 'Couleur longue', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 5 }
      ]
    },
    {
      type: 'BOLLINGER',
      label: 'Bandes de Bollinger',
      description: 'Canal de volatilité (SMA + écarts types)',
      overlay: true,
      defaults: {
        period: 20,
        stdDev: 2,
        basisColor: '#fbbf24',
        upperColor: '#f97316',
        lowerColor: '#818cf8',
        lineWidth: 1.5
      },
      controls: [
        { key: 'period', label: 'Période', type: 'number', min: 5, max: 500 },
        { key: 'stdDev', label: 'Écart-type', type: 'number', min: 1, max: 4, step: 0.1 },
        { key: 'basisColor', label: 'Couleur moyenne', type: 'color' },
        { key: 'upperColor', label: 'Couleur bande sup.', type: 'color' },
        { key: 'lowerColor', label: 'Couleur bande inf.', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 4 }
      ]
    },
    {
      type: 'SUPER_TREND',
      label: 'SuperTrend',
      description: 'Tendance suivant ATR avec alertes directionnelles',
      overlay: true,
      defaults: {
        period: 10,
        multiplier: 3,
        upColor: '#22c55e',
        downColor: '#ef4444',
        lineWidth: 2
      },
      controls: [
        { key: 'period', label: 'Période ATR', type: 'number', min: 5, max: 100 },
        { key: 'multiplier', label: 'Multiplicateur', type: 'number', min: 1, max: 10, step: 0.1 },
        { key: 'upColor', label: 'Couleur haussière', type: 'color' },
        { key: 'downColor', label: 'Couleur baissière', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 5 }
      ]
    },
    {
      type: 'RSI',
      label: 'RSI',
      description: 'Relative Strength Index (zones 70/30)',
      overlay: false,
      defaults: {
        period: 14,
        overbought: 70,
        oversold: 30,
        color: '#a855f7',
        lineWidth: 2
      },
      controls: [
        { key: 'period', label: 'Période', type: 'number', min: 2, max: 100 },
        { key: 'overbought', label: 'Zone haute', type: 'number', min: 50, max: 90 },
        { key: 'oversold', label: 'Zone basse', type: 'number', min: 10, max: 50 },
        { key: 'color', label: 'Couleur ligne', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 4 }
      ]
    },
    {
      type: 'MACD',
      label: 'MACD',
      description: 'MACD + signal + histogramme',
      overlay: false,
      defaults: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        macdColor: '#22d3ee',
        signalColor: '#facc15',
        histUpColor: '#22c55e',
        histDownColor: '#ef4444'
      },
      controls: [
        { key: 'fastPeriod', label: 'Rapide', type: 'number', min: 2, max: 50 },
        { key: 'slowPeriod', label: 'Lente', type: 'number', min: 5, max: 200 },
        { key: 'signalPeriod', label: 'Signal', type: 'number', min: 2, max: 50 },
        { key: 'macdColor', label: 'Couleur MACD', type: 'color' },
        { key: 'signalColor', label: 'Couleur signal', type: 'color' },
        { key: 'histUpColor', label: 'Hist haussier', type: 'color' },
        { key: 'histDownColor', label: 'Hist baissier', type: 'color' }
      ]
    },
    {
      type: 'VOLUME',
      label: 'Volumes',
      description: 'Histogramme coloré en sous-graphe',
      overlay: false,
      defaults: {
        upColor: '#22c55e',
        downColor: '#ef4444'
      },
      controls: [
        { key: 'upColor', label: 'Couleur haussière', type: 'color' },
        { key: 'downColor', label: 'Couleur baissière', type: 'color' }
      ]
    },
    {
      type: 'VWAP',
      label: 'VWAP',
      description: 'Volume Weighted Average Price',
      overlay: true,
      defaults: {
        color: '#f472b6',
        lineWidth: 2
      },
      controls: [
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 5 },
        { key: 'color', label: 'Couleur', type: 'color' }
      ]
    },
    {
      type: 'ATR',
      label: 'ATR',
      description: 'Average True Range',
      overlay: false,
      defaults: {
        period: 14,
        color: '#fb7185',
        lineWidth: 2
      },
      controls: [
        { key: 'period', label: 'Période', type: 'number', min: 2, max: 100 },
        { key: 'color', label: 'Couleur', type: 'color' },
        { key: 'lineWidth', label: 'Épaisseur', type: 'number', min: 1, max: 4 }
      ]
    }
  ];
  private readonly indicatorCatalogMap = new Map<IndicatorType, IndicatorMeta>(
    this.indicatorCatalog.map((meta) => [meta.type, meta])
  );
  indicatorForms: Record<IndicatorType, IndicatorParams> = this.buildIndicatorForms();
  private timeScaleSyncDisposer?: () => void;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly orderService: OrderService,
    private readonly ngZone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  private get isSimulation(): boolean {
    return this.mode === 'simulation' || this.mode === 'external';
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.createChart();
      this.observeResize();
      this.chartReady = true;
      if (this.isSimulation) {
        this.loading = false;
        return;
      }
      this.loadHistoricalData();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chartReady) {
      return;
    }

    if (changes['symbol'] && !changes['symbol'].firstChange) {
      this.reloadChart();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.historicalSub?.unsubscribe();
    this.realtimeSub?.unsubscribe();
    this.simulationTickSub?.unsubscribe();
    this.cleanupTradeMarkers();
    this.indicatorStates.forEach((indicator) => this.detachIndicator(indicator));
    this.indicatorStates = [];
    this.indicatorPaneRefs.forEach((pane) => pane.dispose());
    this.indicatorPaneRefs.clear();
    this.timeScaleSyncDisposer?.();

    if (this.chart && this.crosshairHandler) {
      this.chart.unsubscribeCrosshairMove(this.crosshairHandler);
    }

    this.seriesMarkersPlugin?.detach();
    this.seriesMarkersPlugin = undefined;
    this.chart?.remove();
  }

  onSelectTimeframe(timeframe: string): void {
    if (timeframe === this.selectedTimeframe) {
      return;
    }
    this.selectedTimeframe = timeframe;
    if (this.chartReady) {
      this.reloadChart();
    }
  }

  private loadHistoricalData(): void {
    if (this.isSimulation) {
      return;
    }
    this.loading = true;
    this.error = undefined;
    this.historicalSub?.unsubscribe();
    this.historicalSub = this.marketDataService
      .getHistoricalCandles(this.normalizedSymbol, this.selectedTimeframe, defaults.candleLimit)
      .subscribe({
        next: (candles) => {
          this.lastCandle = candles[candles.length - 1];
          this.setSeriesData(candles);
          this.prepareTradeMarkers(candles);
          this.loading = false;
          this.subscribeToRealtime();
        },
        error: (err) => {
          console.error('[ChartTradingComponent] historical data error', err);
          this.error = 'Impossible de charger les données du marché.';
          this.loading = false;
        }
      });
  }

  private subscribeToRealtime(): void {
    if (this.isSimulation) {
      return;
    }
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = this.marketDataService
      .streamRealtimeCandles(this.normalizedSymbol, this.selectedTimeframe)
      .subscribe({
        next: (candle) => this.updateRealtimeCandle(candle),
        error: (err) => console.error('[ChartTradingComponent] live update error', err)
      });
  }

  private setSeriesData(candles: MarketCandle[]): void {
    if (!this.candleSeries || !this.volumeSeries) {
      return;
    }

    this.candles = candles.map((candle) => ({ ...candle }));
    const candleData: CandlestickData[] = candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));

    const volumeData: HistogramData[] = candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#22c55e' : '#ef4444'
    }));

    this.candleSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);
    this.chart?.timeScale().fitContent();

    this.candleTimeline = candles.map((candle) => candle.time);
    this.recomputeAllIndicators();
  }

  private updateRealtimeCandle(candle: MarketCandle): void {
    if (!this.candleSeries || !this.volumeSeries) {
      return;
    }

    this.lastCandle = candle;
    this.candleSeries.update({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    });

    this.volumeSeries.update({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#22c55e' : '#ef4444'
    });

    if (this.candleTimeline.length === 0 || this.candleTimeline[this.candleTimeline.length - 1] !== candle.time) {
      this.candleTimeline.push(candle.time);
      if (this.candleTimeline.length > (defaults.candleLimit ?? 500)) {
        this.candleTimeline.shift();
      }
    }
    this.upsertRealtimeCandle(candle);
    this.recomputeAllIndicators();
  }

  private initializeSimulationData(candles: MarketCandle[]): void {
    if (!candles.length) {
      return;
    }
    this.simulationBootstrapped = true;
    this.loading = false;
    this.error = undefined;
    this.setSeriesData(candles);
  }

  private flushSimulationBuffers(): void {
    if (this.pendingSimulationData && this.candleSeries) {
      this.initializeSimulationData(this.pendingSimulationData);
      this.pendingSimulationData = undefined;
    }
    if (this.pendingSimulationMarkers && this.seriesMarkersPlugin) {
      this.tradeMarkers = [...this.pendingSimulationMarkers];
      this.pendingSimulationMarkers = null;
      this.applyTradeMarkers();
    }
  }

  private handleSimulationTick(candle: MarketCandle): void {
    if (!this.isSimulation) {
      return;
    }
    this.ngZone.run(() => this.updateRealtimeCandle(candle));
  }

  private computeIndicator(instance: IndicatorInstance): void {
    if (!this.candles.length || !instance.series.length) {
      return;
    }

    const payloads = this.buildIndicatorPayload(instance);

    instance.series.forEach((handle) => {
      const payload = payloads.find((entry) => entry.role === handle.role);
      const data = payload?.data ?? [];
      if (handle.kind === 'line') {
        (handle.series as ISeriesApi<'Line'>).setData(data as LineData<Time>[]);
      } else {
        (handle.series as ISeriesApi<'Histogram'>).setData(data as HistogramData<Time>[]);
      }
    });

    this.decorateIndicator(instance);
  }

  private decorateIndicator(instance: IndicatorInstance): void {
    if (instance.type === 'RSI') {
      this.applyRsiPriceLines(instance);
    }
  }

  private applyRsiPriceLines(instance: IndicatorInstance): void {
    instance.priceLines.forEach((ref) => ref.series.removePriceLine(ref.line));
    instance.priceLines = [];

    const rsiSeries = instance.series.find((handle) => handle.role === 'rsi');
    if (!rsiSeries || rsiSeries.kind !== 'line') {
      return;
    }

    const series = rsiSeries.series as ISeriesApi<'Line'>;
    const overbought = this.toNumberParam(instance.params['overbought'], 70);
    const oversold = this.toNumberParam(instance.params['oversold'], 30);

    const upperLine = series.createPriceLine({
      price: overbought,
      color: '#fbbf24',
      lineWidth: this.asLineWidth(1),
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: overbought.toString()
    });

    const lowerLine = series.createPriceLine({
      price: oversold,
      color: '#38bdf8',
      lineWidth: this.asLineWidth(1),
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: oversold.toString()
    });

    instance.priceLines = [
      { series, line: upperLine },
      { series, line: lowerLine }
    ];
  }

  private buildIndicatorPayload(instance: IndicatorInstance): IndicatorPayload[] {
    switch (instance.type) {
      case 'SMA':
        return this.buildSmaPayload(instance.params);
      case 'EMA':
        return this.buildEmaPayload(instance.params);
      case 'BOLLINGER':
        return this.buildBollingerPayload(instance.params);
      case 'VWAP':
        return this.buildVwapPayload();
      case 'SUPER_TREND':
        return this.buildSuperTrendPayload(instance.params);
      case 'RSI':
        return this.buildRsiPayload(instance.params);
      case 'MACD':
        return this.buildMacdPayload(instance.params);
      case 'VOLUME':
        return this.buildVolumePayload(instance.params);
      case 'ATR':
        return this.buildAtrPayload(instance.params);
      default:
        return [];
    }
  }

  private buildSmaPayload(params: IndicatorParams): IndicatorPayload[] {
    const shortPeriod = Math.max(1, this.toNumberParam(params['shortPeriod'], 20));
    const longPeriod = Math.max(0, this.toNumberParam(params['longPeriod'], 50));
    return [
      { role: 'sma-short', kind: 'line', data: this.calculateSma(shortPeriod) },
      { role: 'sma-long', kind: 'line', data: longPeriod ? this.calculateSma(longPeriod) : [] }
    ];
  }

  private buildEmaPayload(params: IndicatorParams): IndicatorPayload[] {
    const shortPeriod = Math.max(1, this.toNumberParam(params['shortPeriod'], 12));
    const longPeriod = Math.max(0, this.toNumberParam(params['longPeriod'], 26));
    return [
      { role: 'ema-short', kind: 'line', data: this.calculateEma(shortPeriod) },
      { role: 'ema-long', kind: 'line', data: longPeriod ? this.calculateEma(longPeriod) : [] }
    ];
  }

  private buildBollingerPayload(params: IndicatorParams): IndicatorPayload[] {
    const period = Math.max(2, this.toNumberParam(params['period'], 20));
    const stdDev = Math.max(0.1, this.toNumberParam(params['stdDev'], 2));
    const bands = this.calculateBollinger(period, stdDev);
    return [
      { role: 'bollinger-mid', kind: 'line', data: bands.middle },
      { role: 'bollinger-upper', kind: 'line', data: bands.upper },
      { role: 'bollinger-lower', kind: 'line', data: bands.lower }
    ];
  }

  private buildVwapPayload(): IndicatorPayload[] {
    return [{ role: 'vwap', kind: 'line', data: this.calculateVwap() }];
  }

  private buildSuperTrendPayload(params: IndicatorParams): IndicatorPayload[] {
    const period = Math.max(2, this.toNumberParam(params['period'], 10));
    const multiplier = Math.max(0.1, this.toNumberParam(params['multiplier'], 3));
    const trend = this.calculateSuperTrend(period, multiplier);
    return [
      { role: 'supertrend-up', kind: 'line', data: trend.up },
      { role: 'supertrend-down', kind: 'line', data: trend.down }
    ];
  }

  private buildRsiPayload(params: IndicatorParams): IndicatorPayload[] {
    const period = Math.max(2, this.toNumberParam(params['period'], 14));
    return [{ role: 'rsi', kind: 'line', data: this.calculateRsi(period) }];
  }

  private buildMacdPayload(params: IndicatorParams): IndicatorPayload[] {
    const fast = Math.max(2, this.toNumberParam(params['fastPeriod'], 12));
    const slow = Math.max(fast + 1, this.toNumberParam(params['slowPeriod'], 26));
    const signal = Math.max(2, this.toNumberParam(params['signalPeriod'], 9));
    const histUpColor = this.toColorParam(params['histUpColor'], '#22c55e');
    const histDownColor = this.toColorParam(params['histDownColor'], '#ef4444');
    const macd = this.calculateMacd(fast, slow, signal);
    const histogram: HistogramData<Time>[] = macd.histogram.map((point) => ({
      time: point.time,
      value: point.value,
      color: point.value >= 0 ? histUpColor : histDownColor
    }));

    return [
      { role: 'macd-line', kind: 'line', data: macd.macd },
      { role: 'macd-signal', kind: 'line', data: macd.signal },
      { role: 'macd-hist', kind: 'histogram', data: histogram }
    ];
  }

  private buildVolumePayload(params: IndicatorParams): IndicatorPayload[] {
    const upColor = this.toColorParam(params['upColor'], '#22c55e');
    const downColor = this.toColorParam(params['downColor'], '#ef4444');
    return [{ role: 'volume', kind: 'histogram', data: this.calculateVolume(upColor, downColor) }];
  }

  private buildAtrPayload(params: IndicatorParams): IndicatorPayload[] {
    const period = Math.max(2, this.toNumberParam(params['period'], 14));
    return [{ role: 'atr', kind: 'line', data: this.calculateAtr(period) }];
  }

  private calculateSma(period: number): LineData<Time>[] {
    if (period <= 0 || this.candles.length < period) {
      return [];
    }
    const result: LineData<Time>[] = [];
    let sum = 0;
    for (let i = 0; i < this.candles.length; i++) {
      sum += this.candles[i].close;
      if (i >= period) {
        sum -= this.candles[i - period].close;
      }
      if (i >= period - 1) {
        result.push({ time: this.candles[i].time, value: sum / period });
      }
    }
    return result;
  }

  private calculateEma(period: number): LineData<Time>[] {
    if (period <= 0 || this.candles.length < period) {
      return [];
    }
    const multiplier = 2 / (period + 1);
    const result: LineData<Time>[] = [];
    let ema: number | undefined;
    let sum = 0;

    for (let i = 0; i < this.candles.length; i++) {
      const close = this.candles[i].close;
      if (i < period) {
        sum += close;
        if (i === period - 1) {
          ema = sum / period;
          result.push({ time: this.candles[i].time, value: ema });
        }
        continue;
      }

      ema = (close - (ema ?? close)) * multiplier + (ema ?? close);
      result.push({ time: this.candles[i].time, value: ema });
    }

    return result;
  }

  private calculateBollinger(
    period: number,
    stdDevFactor: number
  ): { middle: LineData<Time>[]; upper: LineData<Time>[]; lower: LineData<Time>[] } {
    const middle: LineData<Time>[] = [];
    const upper: LineData<Time>[] = [];
    const lower: LineData<Time>[] = [];

    if (this.candles.length < period) {
      return { middle, upper, lower };
    }

    for (let i = period - 1; i < this.candles.length; i++) {
      const window = this.candles.slice(i - period + 1, i + 1);
      const closes = window.map((candle) => candle.close);
      const mean = closes.reduce((acc, value) => acc + value, 0) / period;
      const variance = closes.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / period;
      const deviation = Math.sqrt(variance);
      const time = this.candles[i].time;

      middle.push({ time, value: mean });
      upper.push({ time, value: mean + stdDevFactor * deviation });
      lower.push({ time, value: mean - stdDevFactor * deviation });
    }

    return { middle, upper, lower };
  }

  private calculateVwap(): LineData<Time>[] {
    const data: LineData<Time>[] = [];
    let cumulativePV = 0;
    let cumulativeVolume = 0;

    this.candles.forEach((candle) => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativePV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      if (cumulativeVolume === 0) {
        return;
      }
      data.push({
        time: candle.time,
        value: cumulativePV / cumulativeVolume
      });
    });

    return data;
  }

  private calculateRsi(period: number): LineData<Time>[] {
    if (period <= 0 || this.candles.length <= period) {
      return [];
    }

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < this.candles.length; i++) {
      const change = this.candles[i].close - this.candles[i - 1].close;
      gains.push(Math.max(change, 0));
      losses.push(Math.max(-change, 0));
    }

    let avgGain = gains.slice(0, period).reduce((acc, value) => acc + value, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((acc, value) => acc + value, 0) / period;

    const data: LineData<Time>[] = [];

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / (avgLoss || 1);
      const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

      data.push({
        time: this.candles[i + 1].time,
        value: rsi
      });
    }

    return data;
  }

  private calculateMacd(
    fast: number,
    slow: number,
    signal: number
  ): { macd: LineData<Time>[]; signal: LineData<Time>[]; histogram: LineData<Time>[] } {
    const fastValues = this.computeEmaValues(fast);
    const slowValues = this.computeEmaValues(slow);
    const macd: LineData<Time>[] = [];

    for (let i = 0; i < this.candles.length; i++) {
      const fastValue = fastValues[i];
      const slowValue = slowValues[i];
      if (fastValue === undefined || slowValue === undefined) {
        continue;
      }
      macd.push({
        time: this.candles[i].time,
        value: fastValue - slowValue
      });
    }

    const signalLine = this.computeEmaFromLineData(macd, signal);
    const signalMap = new Map<UTCTimestamp, number>(
      signalLine.map((point) => [point.time as UTCTimestamp, point.value])
    );

    const histogram: LineData<Time>[] = macd.map((point) => {
      const signalValue = signalMap.get(point.time as UTCTimestamp) ?? 0;
      return {
        time: point.time,
        value: point.value - signalValue
      };
    });

    return { macd, signal: signalLine, histogram };
  }

  private calculateVolume(upColor: string, downColor: string): HistogramData<Time>[] {
    return this.candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? upColor : downColor
    }));
  }

  private calculateAtr(period: number): LineData<Time>[] {
    const atrSeries = this.calculateAtrSeries(period);
    const data: LineData<Time>[] = [];

    atrSeries.forEach((value, index) => {
      if (value === undefined) {
        return;
      }
      data.push({
        time: this.candles[index].time,
        value
      });
    });

    return data;
  }

  private calculateSuperTrend(
    period: number,
    multiplier: number
  ): { up: LineData<Time>[]; down: LineData<Time>[] } {
    const atrSeries = this.calculateAtrSeries(period);
    const upperBand: number[] = [];
    const lowerBand: number[] = [];

    for (let i = 0; i < this.candles.length; i++) {
      const atr = atrSeries[i];
      if (atr === undefined) {
        upperBand.push(NaN);
        lowerBand.push(NaN);
        continue;
      }
      const hl2 = (this.candles[i].high + this.candles[i].low) / 2;
      upperBand.push(hl2 + multiplier * atr);
      lowerBand.push(hl2 - multiplier * atr);
    }

    const finalUpper: number[] = [];
    const finalLower: number[] = [];

    for (let i = 0; i < this.candles.length; i++) {
      if (i === 0 || Number.isNaN(upperBand[i])) {
        finalUpper[i] = upperBand[i];
        finalLower[i] = lowerBand[i];
        continue;
      }

      finalUpper[i] =
        upperBand[i] < finalUpper[i - 1] || this.candles[i - 1].close > finalUpper[i - 1]
          ? upperBand[i]
          : finalUpper[i - 1];

      finalLower[i] =
        lowerBand[i] > finalLower[i - 1] || this.candles[i - 1].close < finalLower[i - 1]
          ? lowerBand[i]
          : finalLower[i - 1];
    }

    const up: LineData<Time>[] = [];
    const down: LineData<Time>[] = [];
    let superTrend = 0;
    let isUptrend = true;

    for (let i = 0; i < this.candles.length; i++) {
      if (Number.isNaN(finalUpper[i]) || Number.isNaN(finalLower[i])) {
        continue;
      }

      if (i === 0) {
        superTrend = finalUpper[i];
        isUptrend = false;
        continue;
      }

      if (superTrend === finalUpper[i - 1]) {
        if (this.candles[i].close <= finalUpper[i]) {
          superTrend = finalUpper[i];
          isUptrend = false;
        } else {
          superTrend = finalLower[i];
          isUptrend = true;
        }
      } else {
        if (this.candles[i].close >= finalLower[i]) {
          superTrend = finalLower[i];
          isUptrend = true;
        } else {
          superTrend = finalUpper[i];
          isUptrend = false;
        }
      }

      if (isUptrend) {
        up.push({ time: this.candles[i].time, value: superTrend });
        down.push({ time: this.candles[i].time, value: NaN });
      } else {
        down.push({ time: this.candles[i].time, value: superTrend });
        up.push({ time: this.candles[i].time, value: NaN });
      }
    }

    return { up, down };
  }

  private computeEmaValues(period: number): Array<number | undefined> {
    const values: Array<number | undefined> = new Array(this.candles.length).fill(undefined);
    if (period <= 0 || this.candles.length < period) {
      return values;
    }
    const multiplier = 2 / (period + 1);
    let ema: number | undefined;
    let sum = 0;

    for (let i = 0; i < this.candles.length; i++) {
      const close = this.candles[i].close;
      if (i < period) {
        sum += close;
        if (i === period - 1) {
          ema = sum / period;
          values[i] = ema;
        }
        continue;
      }
      ema = (close - (ema ?? close)) * multiplier + (ema ?? close);
      values[i] = ema;
    }

    return values;
  }

  private computeEmaFromLineData(data: LineData<Time>[], period: number): LineData<Time>[] {
    if (period <= 0 || data.length < period) {
      return [];
    }

    const multiplier = 2 / (period + 1);
    const result: LineData<Time>[] = [];
    let ema: number | undefined;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const value = data[i].value;
      if (i < period) {
        sum += value;
        if (i === period - 1) {
          ema = sum / period;
          result.push({ time: data[i].time, value: ema });
        }
        continue;
      }
      ema = (value - (ema ?? value)) * multiplier + (ema ?? value);
      result.push({ time: data[i].time, value: ema });
    }

    return result;
  }

  private calculateAtrSeries(period: number): Array<number | undefined> {
    const atr: Array<number | undefined> = new Array(this.candles.length).fill(undefined);
    if (period <= 0 || this.candles.length === 0) {
      return atr;
    }

    const trueRanges: number[] = [];
    for (let i = 0; i < this.candles.length; i++) {
      const candle = this.candles[i];
      if (i === 0) {
        trueRanges.push(candle.high - candle.low);
        continue;
      }
      const prevClose = this.candles[i - 1].close;
      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose)
      );
      trueRanges.push(tr);
    }

    let sum = 0;
    for (let i = 0; i < trueRanges.length; i++) {
      const tr = trueRanges[i];
      if (i < period) {
        sum += tr;
        if (i === period - 1) {
          atr[i] = sum / period;
        }
        continue;
      }
      const prevAtr = atr[i - 1] ?? sum / period;
      atr[i] = (prevAtr * (period - 1) + tr) / period;
    }

    return atr;
  }

  private createIndicatorPane(instance: IndicatorInstance): IndicatorPaneRef {
    if (!this.indicatorPanesHost) {
      throw new Error('Indicator host not initialized');
    }

    const host = this.indicatorPanesHost.nativeElement;
    const wrapper = document.createElement('div');
    wrapper.classList.add('indicator-pane');
    wrapper.setAttribute('data-indicator', instance.type);

    const header = document.createElement('div');
    header.classList.add('indicator-pane-header');
    const title = document.createElement('span');
    title.textContent = instance.label;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.classList.add('indicator-pane-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.ngZone.run(() => this.onRemoveIndicator(instance.type)));
    header.appendChild(title);
    header.appendChild(closeBtn);

    const chartHost = document.createElement('div');
    chartHost.classList.add('indicator-pane-chart');
    chartHost.style.minHeight = '170px';

    wrapper.appendChild(header);
    wrapper.appendChild(chartHost);
    host.appendChild(wrapper);

    const chart = this.ngZone.runOutsideAngular(() =>
      createChart(chartHost, {
        width: chartHost.clientWidth || host.clientWidth,
        height: chartHost.clientHeight || 170,
        layout: {
          background: { color: 'rgba(5, 12, 27, 0.85)' },
          textColor: '#cbd5f5'
        },
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.3)' }
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: 'rgba(197, 203, 206, 0.4)',
            width: 1,
            style: LineStyle.Solid,
            labelBackgroundColor: '#0f172a'
          },
          horzLine: {
            color: 'rgba(197, 203, 206, 0.4)',
            width: 1,
            style: LineStyle.Solid,
            labelBackgroundColor: '#0f172a'
          }
        },
        rightPriceScale: {
          borderColor: '#1f2937',
          scaleMargins: { top: 0.1, bottom: 0.1 }
        },
        timeScale: {
          borderColor: '#1f2937',
          timeVisible: true,
          secondsVisible: false
        },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: false,
          horzTouchDrag: false,
          vertTouchDrag: false
        },
        handleScale: {
          axisPressedMouseMove: false,
          mouseWheel: false,
          pinch: false
        }
      })
    );

    const ref: IndicatorPaneRef = {
      id: instance.id,
      label: instance.label,
      container: wrapper,
      chartHost,
      chart,
      dispose: () => {
        chart.remove();
        wrapper.remove();
      }
    };

    this.indicatorPaneRefs.set(ref.id, ref);
    this.syncPaneTimeScale(chart);
    this.resizeIndicatorPanes();

    return ref;
  }

  private destroyIndicatorPane(id: string): void {
    const pane = this.indicatorPaneRefs.get(id);
    if (!pane) {
      return;
    }
    pane.dispose();
    this.indicatorPaneRefs.delete(id);
  }

  private resizeIndicatorPanes(): void {
    this.indicatorPaneRefs.forEach((pane) => {
      const width = pane.chartHost.clientWidth || this.chartWrapper.nativeElement.clientWidth;
      const height = pane.chartHost.clientHeight || 170;
      pane.chart.resize(width, height);
    });
  }

  private registerTimeScaleSync(): void {
    if (!this.chart) {
      return;
    }

    this.timeScaleSyncDisposer?.();

    const handler = (range: IRange<Time> | null) => {
      if (!range) {
        return;
      }
      this.indicatorPaneRefs.forEach((pane) => {
        pane.chart.timeScale().setVisibleRange(range);
      });
    };

    this.chart.timeScale().subscribeVisibleTimeRangeChange(handler);
    this.timeScaleSyncDisposer = () => this.chart?.timeScale().unsubscribeVisibleTimeRangeChange(handler);
  }

  private syncPaneTimeScale(targetChart: IChartApi): void {
    const range = this.chart?.timeScale().getVisibleRange();
    if (range) {
      targetChart.timeScale().setVisibleRange(range);
    }
  }

  private recomputeAllIndicators(): void {
    if (!this.candles.length) {
      return;
    }
    this.indicatorStates.forEach((indicator) => this.computeIndicator(indicator));
  }

  private upsertRealtimeCandle(candle: MarketCandle): void {
    if (!this.candles.length) {
      this.candles = [{ ...candle }];
      return;
    }

    const lastIndex = this.candles.length - 1;
    if (this.candles[lastIndex].time === candle.time) {
      this.candles[lastIndex] = { ...candle };
      return;
    }

    this.candles.push({ ...candle });
    const limit = defaults.candleLimit ?? 500;
    if (this.candles.length > limit) {
      this.candles.shift();
    }
  }
  private toNumberParam(value: string | number | boolean | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  private toColorParam(value: string | number | boolean | undefined, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  private toLineWidthParam(value: string | number | boolean | undefined, fallback: number): LineWidth {
    return this.asLineWidth(this.toNumberParam(value, fallback));
  }

  private asLineWidth(value: number): LineWidth {
    const normalized = Math.round(Number.isFinite(value) ? value : 1);
    const clamped = Math.min(4, Math.max(1, normalized));
    return clamped as LineWidth;
  }

  private buildIndicatorForms(): Record<IndicatorType, IndicatorParams> {
    return this.indicatorCatalog.reduce((acc, meta) => {
      acc[meta.type] = { ...meta.defaults };
      return acc;
    }, {} as Record<IndicatorType, IndicatorParams>);
  }

  private reloadChart(): void {
    if (this.isSimulation) {
      this.tradeMarkers = [];
      this.applyTradeMarkers();
      return;
    }
    this.realtimeSub?.unsubscribe();
    this.lastCandle = undefined;
    this.candles = [];
    this.resetTradeMarkers();
    if (this.candleSeries && this.volumeSeries) {
      this.candleSeries.setData([]);
      this.volumeSeries.setData([]);
    }
    this.loadHistoricalData();
  }

  private createChart(): void {
    const element = this.chartContainer.nativeElement;
    const optimalHeight = element.offsetHeight || this.height;

    this.chart = createChart(element, {
      width: element.clientWidth,
      height: optimalHeight,
      layout: {
        background: { color: '#050c1b' },
        textColor: '#d1d4dc'
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.6)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.6)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(197, 203, 206, 0.6)',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#1f2937'
        },
        horzLine: {
          color: 'rgba(197, 203, 206, 0.6)',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#1f2937'
        }
      },
      timeScale: {
        borderColor: '#2b3a52',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12
      },
      rightPriceScale: {
        borderColor: '#2b3a52',
        scaleMargins: {
          top: 0.1,
          bottom: 0.3
        }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      borderUpColor: '#22c55e',
      wickUpColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      wickDownColor: '#ef4444'
    });
    this.seriesMarkersPlugin?.detach();
    this.seriesMarkersPlugin = createSeriesMarkers(this.candleSeries, []);

    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume'
    });

    this.volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });

    this.chart.timeScale().fitContent();
    this.initTooltip();
    this.applyTradeMarkers();
    this.registerTimeScaleSync();
    if (this.isSimulation) {
      this.flushSimulationBuffers();
    }
  }

  private initTooltip(): void {
    if (!this.chart) {
      return;
    }
    this.chartTooltip.nativeElement.style.opacity = '0';

    this.crosshairHandler = (param: MouseEventParams<Time>) => {
      this.updateTooltip(param);
      this.handleMarkerHover(param);
    };
    this.chart.subscribeCrosshairMove(this.crosshairHandler);
  }

  private updateTooltip(param: MouseEventParams<Time>): void {
    const tooltip = this.chartTooltip.nativeElement;

    if (
      !param.point ||
      !param.time ||
      !param.seriesData ||
      param.point.x < 0 ||
      param.point.y < 0
    ) {
      tooltip.style.opacity = '0';
      return;
    }

    if (!this.candleSeries) {
      tooltip.style.opacity = '0';
      return;
    }

    const seriesData = param.seriesData.get(this.candleSeries);

    if (!seriesData) {
      tooltip.style.opacity = '0';
      return;
    }

    const candle = seriesData as CandlestickData;
    const header = this.displayName ?? this.normalizedSymbol;
    const formattedDate = this.formatTooltipTime(param.time);

    tooltip.innerHTML = `
      <div class="tooltip-title">${header}</div>
      <div class="tooltip-values">
        <span>O: ${candle.open.toFixed(2)}</span>
        <span>H: ${candle.high.toFixed(2)}</span>
        <span>L: ${candle.low.toFixed(2)}</span>
        <span>C: ${candle.close.toFixed(2)}</span>
      </div>
      <div class="tooltip-date">${formattedDate}</div>
    `;

    tooltip.style.opacity = '1';
    tooltip.style.left = `${param.point.x + 20}px`;
    tooltip.style.top = `${param.point.y + 20}px`;
  }

  private observeResize(): void {
    if (!this.chart) {
      return;
    }
    fromEvent(window, 'resize')
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => {
        this.resizeChart();
        this.resizeIndicatorPanes();
      });
  }

  private resizeChart(): void {
    const element = this.chartWrapper.nativeElement;
    this.chart?.resize(element.clientWidth, element.offsetHeight || this.height);
  }

  private formatTooltipTime(time: Time): string {
    const timestamp = typeof time === 'string' ? Date.parse(time) : (time as number) * 1000;
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  }

  get instrumentLabel(): string {
    return this.displayName ?? this.normalizedSymbol;
  }

  private get normalizedSymbol(): string {
    return (this.symbol || defaults.defaultSymbol).toUpperCase();
  }

  private get markerSymbol(): string {
    const base = this.normalizedSymbol;
    const quotePattern = /(USDT|USD|EUR)$/i;
    const stripped = base.replace(quotePattern, '');
    return stripped.length ? stripped : base;
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  toggleTradeMarkers(): void {
    this.tradeMarkersEnabled = !this.tradeMarkersEnabled;
    if (this.isSimulation) {
      if (!this.tradeMarkersEnabled) {
        this.hideTradeMarkerTooltip();
      }
      this.applyTradeMarkers();
      return;
    }
    if (this.tradeMarkersEnabled) {
      this.tradeMarkersError = undefined;
      this.applyTradeMarkers();
      this.fetchTradeMarkers(true);
      this.startMarkerPolling();
    } else {
      this.stopMarkerPolling();
      this.hideTradeMarkerTooltip();
      this.applyTradeMarkers();
    }
  }

  applyIndicator(type: IndicatorType): void {
    if (!this.chartReady || !this.chart) {
      return;
    }
    const params = { ...(this.indicatorForms[type] ?? {}) };
    this.upsertIndicatorInstance(type, params);
  }

  onRemoveIndicator(type: IndicatorType): void {
    const target = this.indicatorStates.find((indicator) => indicator.type === type);
    if (!target) {
      return;
    }
    this.detachIndicator(target);
    this.indicatorStates = this.indicatorStates.filter((indicator) => indicator.type !== type);
  }

  isIndicatorActive(type: IndicatorType): boolean {
    return this.indicatorStates.some((indicator) => indicator.type === type);
  }

  private upsertIndicatorInstance(type: IndicatorType, params: IndicatorParams): void {
    if (!this.chart) {
      return;
    }
    const meta = this.indicatorCatalogMap.get(type);
    if (!meta) {
      return;
    }

    const mergedParams = { ...meta.defaults, ...params };
    const existing = this.indicatorStates.find((indicator) => indicator.type === type);

    if (existing) {
      existing.params = mergedParams;
      this.updateIndicatorSeriesStyles(existing);
      this.computeIndicator(existing);
      return;
    }

    const instance: IndicatorInstance = {
      id: type,
      type,
      label: meta.label,
      overlay: meta.overlay,
      params: mergedParams,
      series: [],
      priceLines: []
    };

    this.attachIndicator(instance);
    this.indicatorStates = [...this.indicatorStates, instance];
    this.computeIndicator(instance);
  }

  private attachIndicator(instance: IndicatorInstance): void {
    if (!this.chart) {
      return;
    }

    if (instance.overlay) {
      instance.chart = this.chart;
    } else {
      instance.paneRef = this.createIndicatorPane(instance);
      instance.chart = instance.paneRef.chart;
    }

    instance.series = this.instantiateIndicatorSeries(instance);
    this.updateIndicatorSeriesStyles(instance);
  }

  private detachIndicator(instance: IndicatorInstance): void {
    instance.series.forEach((handle) => {
      instance.chart?.removeSeries(handle.series as ISeriesApi<any>);
    });
    instance.series = [];
    instance.priceLines.forEach((ref) => ref.series.removePriceLine(ref.line));
    instance.priceLines = [];

    if (!instance.overlay && instance.paneRef) {
      this.destroyIndicatorPane(instance.paneRef.id);
      instance.paneRef = undefined;
    }
  }

  private instantiateIndicatorSeries(instance: IndicatorInstance): IndicatorSeriesHandle[] {
    if (!instance.chart) {
      return [];
    }

    const chart = instance.chart;
    const handles: IndicatorSeriesHandle[] = [];

    switch (instance.type) {
      case 'SMA':
        handles.push({
          role: 'sma-short',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'sma-long',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'EMA':
        handles.push({
          role: 'ema-short',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'ema-long',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'BOLLINGER':
        handles.push({
          role: 'bollinger-mid',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'bollinger-upper',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'bollinger-lower',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'VWAP':
        handles.push({
          role: 'vwap',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'SUPER_TREND':
        handles.push({
          role: 'supertrend-up',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'supertrend-down',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'RSI':
        handles.push({
          role: 'rsi',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
      case 'MACD':
        handles.push({
          role: 'macd-line',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'macd-signal',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        handles.push({
          role: 'macd-hist',
          kind: 'histogram',
          series: chart.addSeries(HistogramSeries, { priceScaleId: 'right', base: 0 })
        });
        break;
      case 'VOLUME':
        handles.push({
          role: 'volume',
          kind: 'histogram',
          series: chart.addSeries(HistogramSeries, { priceScaleId: 'right', priceFormat: { type: 'volume' } })
        });
        break;
      case 'ATR':
        handles.push({
          role: 'atr',
          kind: 'line',
          series: chart.addSeries(LineSeries, { priceLineVisible: false, crosshairMarkerVisible: false })
        });
        break;
    }

    return handles;
  }

  private updateIndicatorSeriesStyles(instance: IndicatorInstance): void {
    if (!instance.series.length) {
      return;
    }

    switch (instance.type) {
      case 'SMA': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const colorA = this.toColorParam(instance.params['colorA'], '#22d3ee');
        const colorB = this.toColorParam(instance.params['colorB'], '#0ea5e9');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          const series = handle.series as ISeriesApi<'Line'>;
          const color = handle.role === 'sma-short' ? colorA : colorB;
          series.applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'EMA': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const colorA = this.toColorParam(instance.params['colorA'], '#34d399');
        const colorB = this.toColorParam(instance.params['colorB'], '#0ea5e9');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          const series = handle.series as ISeriesApi<'Line'>;
          const color = handle.role === 'ema-short' ? colorA : colorB;
          series.applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'BOLLINGER': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const basisColor = this.toColorParam(instance.params['basisColor'], '#fbbf24');
        const upperColor = this.toColorParam(instance.params['upperColor'], '#f97316');
        const lowerColor = this.toColorParam(instance.params['lowerColor'], '#818cf8');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          const series = handle.series as ISeriesApi<'Line'>;
          const color =
            handle.role === 'bollinger-mid'
              ? basisColor
              : handle.role === 'bollinger-upper'
              ? upperColor
              : lowerColor;
          series.applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'VWAP': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const color = this.toColorParam(instance.params['color'], '#f472b6');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          (handle.series as ISeriesApi<'Line'>).applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'SUPER_TREND': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const upColor = this.toColorParam(instance.params['upColor'], '#22c55e');
        const downColor = this.toColorParam(instance.params['downColor'], '#ef4444');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          const series = handle.series as ISeriesApi<'Line'>;
          const color = handle.role === 'supertrend-up' ? upColor : downColor;
          series.applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'RSI': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const color = this.toColorParam(instance.params['color'], '#a855f7');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          (handle.series as ISeriesApi<'Line'>).applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
      case 'MACD': {
        const macdColor = this.toColorParam(instance.params['macdColor'], '#22d3ee');
        const signalColor = this.toColorParam(instance.params['signalColor'], '#facc15');
        instance.series.forEach((handle) => {
          if (handle.kind === 'line') {
            const series = handle.series as ISeriesApi<'Line'>;
            const color = handle.role === 'macd-line' ? macdColor : signalColor;
            series.applyOptions({
              color,
              lineWidth: 2,
              priceLineVisible: false,
              crosshairMarkerVisible: false
            });
          } else if (handle.kind === 'histogram') {
            const histogram = handle.series as ISeriesApi<'Histogram'>;
            histogram.applyOptions({
              base: 0,
              priceScaleId: 'right'
            });
          }
        });
        break;
      }
      case 'VOLUME': {
        instance.series.forEach((handle) => {
          if (handle.kind !== 'histogram') {
            return;
          }
          (handle.series as ISeriesApi<'Histogram'>).applyOptions({
            priceScaleId: 'right',
            priceFormat: { type: 'volume' },
            base: 0
          });
        });
        break;
      }
      case 'ATR': {
        const lineWidth = this.toLineWidthParam(instance.params['lineWidth'], 2);
        const color = this.toColorParam(instance.params['color'], '#fb7185');
        instance.series.forEach((handle) => {
          if (handle.kind !== 'line') {
            return;
          }
          (handle.series as ISeriesApi<'Line'>).applyOptions({
            color,
            lineWidth,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
        });
        break;
      }
    }
  }

  private prepareTradeMarkers(candles: MarketCandle[]): void {
    if (this.isSimulation) {
      return;
    }
    this.candleTimeline = candles.map((c) => c.time);
    if (!candles.length) {
      this.resetTradeMarkers();
      return;
    }
    if (this.tradeMarkersEnabled) {
      this.fetchTradeMarkers(true);
      this.startMarkerPolling();
    }
  }

  private fetchTradeMarkers(force = false): void {
    if (this.isSimulation) {
      return;
    }
    if (!this.tradeMarkersEnabled || !this.candleTimeline.length) {
      return;
    }

    if (force) {
      this.tradeMarkersLoading = true;
    }
    this.tradeMarkersError = undefined;
    this.tradeMarkersSub?.unsubscribe();

    const from = this.toIsoTimestamp(this.candleTimeline[0]);
    const to = new Date().toISOString();
    const limit = Math.max(200, defaults.candleLimit ?? 500);

    const candidates = this.markerSymbolCandidates();
    this.tryFetchMarkersForSymbol(candidates, { from, to, limit }, 0);
  }

  private tryFetchMarkersForSymbol(
    symbols: string[],
    params: { from: string; to: string; limit: number },
    index: number
  ): void {
    if (index >= symbols.length) {
      this.fetchMarkersFromAllOrders(symbols, params);
      return;
    }

    const currentSymbol = symbols[index];

    this.tradeMarkersSub = this.orderService
      .getTradeMarkersForSymbol(currentSymbol, params)
      .subscribe({
        next: (payload) => {
          if ((payload?.length ?? 0) === 0 && index < symbols.length - 1) {
            this.tryFetchMarkersForSymbol(symbols, params, index + 1);
            return;
          }

          this.tradeMarkers = this.mapTradeMarkers(payload);
          this.tradeMarkersLoading = false;
          console.info('[ChartTradingComponent] markers fetched', {
            symbol: currentSymbol,
            count: this.tradeMarkers.length,
            timeframe: this.selectedTimeframe
          });
          this.applyTradeMarkers();
          this.hideTradeMarkerTooltip();
        },
        error: (err) => {
          console.error('[ChartTradingComponent] markers fetch error', err);
          this.tradeMarkersError = "Impossible d'afficher les trades.";
          this.tradeMarkers = [];
          this.tradeMarkersLoading = false;
          this.applyTradeMarkers();
          this.hideTradeMarkerTooltip();
        }
      });
  }

  private fetchMarkersFromAllOrders(symbols: string[], params: { from: string; to: string; limit: number }): void {
    this.orderService.getAllUserOrders().subscribe({
      next: (orders) => {
        const filtered = (orders || [])
          .filter((order) => this.matchesAnySymbol(order?.orderItem?.coin?.symbol, symbols))
          .filter((order) => this.isWithinRange(order?.timestamp, params))
          .sort((a, b) => Date.parse(a.timestamp ?? '') - Date.parse(b.timestamp ?? ''))
          .slice(-params.limit);

        const markers: TradeMarkerResponse[] = filtered.map((order) => ({
          id: this.createFallbackMarkerId(order),
          symbol: order.orderItem?.coin?.symbol ?? this.markerSymbol,
          type: (order.orderType ?? 'BUY').toUpperCase(),
          price: Number(order.price ?? order.orderItem?.buyPrice ?? order.orderItem?.sellPrice ?? 0),
          quantity: Number(order.orderItem?.quantity ?? 0),
          timestamp: order.timestamp ?? new Date().toISOString(),
          status: order.status
        }));

        this.tradeMarkers = this.mapTradeMarkers(markers);
        this.tradeMarkersLoading = false;
        console.info('[ChartTradingComponent] markers fetched (fallback)', {
          symbol: symbols.join(','),
          count: this.tradeMarkers.length,
          timeframe: this.selectedTimeframe
        });
        this.applyTradeMarkers();
        this.hideTradeMarkerTooltip();
      },
      error: (err) => {
        console.error('[ChartTradingComponent] fallback markers fetch error', err);
        this.tradeMarkersError = "Impossible d'afficher les trades.";
        this.tradeMarkers = [];
        this.tradeMarkersLoading = false;
        this.applyTradeMarkers();
        this.hideTradeMarkerTooltip();
      }
    });
  }

  private mapTradeMarkers(payload: TradeMarkerResponse[] | null): ChartTradeMarker[] {
    if (!payload || !payload.length) {
      return [];
    }

    return payload
      .filter((marker) => !!marker && !!marker.timestamp)
      .map((marker) => {
        const type: 'BUY' | 'SELL' =
          (marker.type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
        const alignedTime = this.alignMarkerTime(this.toUtcTimestamp(marker.timestamp));
        return {
          id: marker.id != null ? marker.id.toString() : `${marker.symbol}-${marker.timestamp}`,
          symbol: (marker.symbol || this.markerSymbol).toUpperCase(),
          type,
          price: Number(marker.price) || 0,
          quantity: Number(marker.quantity) || 0,
          timestamp: marker.timestamp,
          status: marker.status,
          time: alignedTime
        };
      })
      .sort((a, b) => a.time - b.time);
  }

  private markerSymbolCandidates(): string[] {
    const base = this.markerSymbol;
    const normalized = this.normalizedSymbol;
    const original = (this.symbol || defaults.defaultSymbol).toUpperCase();
    const suffixes = ['USDT', 'USD', 'EUR'];
    const set = new Set<string>();

    [base, normalized, original].forEach((sym) => {
      if (!sym) {
        return;
      }
      set.add(sym);
      suffixes.forEach((suffix) => {
        if (!sym.endsWith(suffix)) {
          set.add(`${sym}${suffix}`);
        }
      });
    });

    return Array.from(set);
  }

  private matchesAnySymbol(symbol: string | undefined, candidates: string[]): boolean {
    if (!symbol) {
      return false;
    }
    return candidates.some((candidate) => candidate.toUpperCase() === symbol.toUpperCase());
  }

  private isWithinRange(timestamp: string | undefined, params: { from: string; to: string }): boolean {
    if (!timestamp) {
      return false;
    }
    const ts = Date.parse(timestamp);
    if (Number.isNaN(ts)) {
      return false;
    }
    return ts >= Date.parse(params.from) && ts <= Date.parse(params.to);
  }

  private createFallbackMarkerId(order: Order): string {
    if (order.id !== undefined) {
      return order.id.toString();
    }
    if (order.orderItem?.id !== undefined) {
      return `OI-${order.orderItem.id}`;
    }
    return `ORD-${order.orderType ?? 'NA'}-${order.timestamp ?? Date.now()}-${Math.random()}`;
  }

  private startMarkerPolling(): void {
    if (this.isSimulation) {
      return;
    }
    if (!this.tradeMarkersEnabled || this.markerPollHandle || !this.candleTimeline.length) {
      return;
    }
    this.markerPollHandle = window.setInterval(() => {
      this.ngZone.run(() => this.fetchTradeMarkers());
    }, TRADE_MARKER_POLL_MS);
  }

  private stopMarkerPolling(): void {
    if (this.markerPollHandle) {
      clearInterval(this.markerPollHandle);
      this.markerPollHandle = undefined;
    }
  }

  private resetTradeMarkers(): void {
    this.stopMarkerPolling();
    this.tradeMarkersSub?.unsubscribe();
    this.tradeMarkers = [];
    this.candleTimeline = [];
    this.tradeMarkersLoading = false;
    this.tradeMarkersError = undefined;
    this.hideTradeMarkerTooltip();
    this.applyTradeMarkers();
  }

  private cleanupTradeMarkers(): void {
    this.resetTradeMarkers();
  }

  private applyTradeMarkers(): void {
    if (!this.candleSeries || !this.seriesMarkersPlugin) {
      return;
    }

    if (!this.tradeMarkersEnabled || this.tradeMarkers.length === 0) {
      this.seriesMarkersPlugin.setMarkers([]);
      return;
    }

    const markers: SeriesMarker<Time>[] = this.tradeMarkers.map((marker) => {
      const isBuy = marker.type === 'BUY';
      return {
        id: marker.id,
        time: marker.time,
        color: isBuy ? '#22c55e' : '#ef4444',
        position: isBuy ? 'belowBar' : 'aboveBar',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: `${isBuy ? 'Buy' : 'Sell'} ${this.formatNumber(marker.price)}`
      };
    });

    this.seriesMarkersPlugin.setMarkers(markers);
  }

  private handleMarkerHover(param: MouseEventParams<Time>): void {
    if (
      !this.tradeMarkersEnabled ||
      !this.chart ||
      !this.candleSeries ||
      !param.point ||
      this.tradeMarkers.length === 0
    ) {
      this.hideTradeMarkerTooltip();
      return;
    }

    const hoveredMarker = this.findNearestMarker(param.point);

    if (!hoveredMarker) {
      this.hideTradeMarkerTooltip();
      return;
    }

    const clientCoords = this.getPointerClientPosition(param);
    this.showTradeMarkerTooltip(hoveredMarker, clientCoords);
  }

  private findNearestMarker(point: { x: number; y: number }): ChartTradeMarker | undefined {
    if (!this.chart || !this.candleSeries) {
      return undefined;
    }

    const timeScale = this.chart.timeScale();
    let closest: ChartTradeMarker | undefined;
    let minDistance = this.markerHoverThresholdPx;

    for (const marker of this.tradeMarkers) {
      const x = timeScale.timeToCoordinate(marker.time);
      const y = this.candleSeries.priceToCoordinate(marker.price);

      if (x === null || y === null) {
        continue;
      }

      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= minDistance) {
        minDistance = distance;
        closest = marker;
      }
    }

    return closest;
  }

  private getPointerClientPosition(param: MouseEventParams<Time>): { x: number; y: number } {
    if (param.sourceEvent) {
      return {
        x: param.sourceEvent.clientX,
        y: param.sourceEvent.clientY
      };
    }

    const chartBounds = this.chartContainer.nativeElement.getBoundingClientRect();
    return {
      x: chartBounds.left + (param.point?.x ?? 0),
      y: chartBounds.top + (param.point?.y ?? 0)
    };
  }

  private showTradeMarkerTooltip(marker: ChartTradeMarker, coords: { x: number; y: number }): void {
    if (!this.tradeMarkerTooltip || !this.tradeMarkersEnabled) {
      return;
    }

    const tooltip = this.tradeMarkerTooltip.nativeElement;
    const bounds = this.chartWrapper.nativeElement.getBoundingClientRect();

    tooltip.innerHTML = `
      <div class="trade-tooltip-header ${marker.type === 'BUY' ? 'buy' : 'sell'}">
        ${marker.type === 'BUY' ? 'Buy' : 'Sell'} · ${marker.symbol}
      </div>
      <div class="trade-tooltip-body">
        <div><span>Type</span><strong>${marker.type === 'BUY' ? 'Buy' : 'Sell'}</strong></div>
        <div><span>Prix</span><strong>${this.formatNumber(marker.price)}</strong></div>
        <div><span>Quantité</span><strong>${this.formatNumber(marker.quantity, 4)}</strong></div>
        <div><span>Date</span><strong>${this.formatTradeDate(marker.timestamp)}</strong></div>
        <div><span>Statut</span><strong>${marker.status ?? 'N/A'}</strong></div>
      </div>
    `;

    tooltip.style.opacity = '1';
    tooltip.style.left = `${coords.x - bounds.left + 16}px`;
    tooltip.style.top = `${coords.y - bounds.top - 12}px`;
  }

  private hideTradeMarkerTooltip(): void {
    if (!this.tradeMarkerTooltip) {
      return;
    }
    this.tradeMarkerTooltip.nativeElement.style.opacity = '0';
  }

  private alignMarkerTime(time: UTCTimestamp): UTCTimestamp {
    if (!this.candleTimeline.length) {
      return time;
    }

    let left = 0;
    let right = this.candleTimeline.length - 1;
    let closest = this.candleTimeline[0];
    let bestDiff = Math.abs(closest - time);

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = this.candleTimeline[mid];
      const diff = Math.abs(midTime - time);

      if (diff < bestDiff) {
        bestDiff = diff;
        closest = midTime;
      }

      if (midTime === time) {
        return midTime;
      }
      if (midTime < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return closest;
  }

  private formatTradeDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private formatNumber(value: number, digits: number = 2): string {
    return Number(value).toLocaleString('fr-FR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  private toIsoTimestamp(utc: UTCTimestamp): string {
    return new Date(utc * 1000).toISOString();
  }

  private toUtcTimestamp(value: string | number | Date): UTCTimestamp {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000) as UTCTimestamp;
    }
    if (typeof value === 'string') {
      return Math.floor(Date.parse(value) / 1000) as UTCTimestamp;
    }
    if (value > 1_000_000_000_000) {
      return Math.floor(value / 1000) as UTCTimestamp;
    }
    return Math.floor(value) as UTCTimestamp;
  }
}

