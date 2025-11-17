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
  ISeriesApi,
  LineStyle,
  MouseEventParams,
  Time,
  createChart
} from 'lightweight-charts';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { fromEvent, Subject, Subscription } from 'rxjs';
import { MarketCandle, MarketDataService } from '../../services/market-data.service';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';

const defaults = environment.marketDataConfig ?? {
  defaultSymbol: 'btc',
  defaultInterval: '1h',
  candleLimit: 500
};

@Component({
  selector: 'app-chart-trading',
  templateUrl: './chart-trading.component.html',
  styleUrls: ['./chart-trading.component.css']
})
export class ChartTradingComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() symbol: string = defaults.defaultSymbol;
  @Input() displayName?: string;
  @Input() height = 520;

  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chartTooltip', { static: true }) chartTooltip!: ElementRef<HTMLDivElement>;

  loading = true;
  error?: string;
  lastCandle?: MarketCandle;

  readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  selectedTimeframe: string = defaults.defaultInterval;

  private chart?: IChartApi;
  private candleSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private crosshairHandler?: (param: MouseEventParams<Time>) => void;

  private historicalSub?: Subscription;
  private realtimeSub?: Subscription;

  private readonly destroy$ = new Subject<void>();
  private chartReady = false;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly ngZone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.createChart();
      this.observeResize();
      this.chartReady = true;
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

    if (this.chart && this.crosshairHandler) {
      this.chart.unsubscribeCrosshairMove(this.crosshairHandler);
    }

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
    this.loading = true;
    this.error = undefined;
    this.historicalSub?.unsubscribe();
    this.historicalSub = this.marketDataService
      .getHistoricalCandles(this.normalizedSymbol, this.selectedTimeframe, defaults.candleLimit)
      .subscribe({
        next: (candles) => {
          this.lastCandle = candles[candles.length - 1];
          this.setSeriesData(candles);
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
  }

  private reloadChart(): void {
    this.realtimeSub?.unsubscribe();
    this.lastCandle = undefined;
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
  }

  private initTooltip(): void {
    if (!this.chart) {
      return;
    }
    this.chartTooltip.nativeElement.style.opacity = '0';

    this.crosshairHandler = (param: MouseEventParams<Time>) => this.updateTooltip(param);
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
      .subscribe(() => this.resizeChart());
  }

  private resizeChart(): void {
    const element = this.chartContainer.nativeElement;
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

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}

