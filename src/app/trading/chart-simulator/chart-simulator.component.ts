import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  SimulationBroker,
  SimulationConfig,
  SimulationDataMode,
  SimulationDataSpan,
  SimulationSpeedMultiplier,
  SimulationTimeframe,
  SimulationTrade
} from '../models/simulation.model';
import { SimulationEngineService } from '../services/simulation-engine.service';

interface ChartInstrument {
  symbol: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-chart-simulator',
  templateUrl: './chart-simulator.component.html',
  styleUrls: ['./chart-simulator.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartSimulatorComponent {
  instruments: ChartInstrument[] = [
    { symbol: 'BTCUSDT', name: 'Bitcoin · Spot', description: 'Volatilité reine · Marché crypto' },
    { symbol: 'ETHUSDT', name: 'Ethereum · Spot', description: 'Smart contracts & Layer 2' },
    { symbol: 'SOLUSDT', name: 'Solana · Spot', description: 'Écosystème haute performance' },
    { symbol: 'ADAUSDT', name: 'Cardano · Spot', description: 'Proof-of-Stake institutionnel' }
  ];

  readonly dataModes: { value: SimulationDataMode; label: string }[] = [
    { value: 'spot', label: 'Spot' },
    { value: 'futures', label: 'Futures' },
    { value: 'index', label: 'Index' },
    { value: 'multi-broker', label: 'Multi-broker' },
    { value: 'backtest', label: 'Backtest' },
    { value: 'synthetic', label: 'Synthétique' }
  ];

  readonly brokers: { value: SimulationBroker; label: string }[] = [
    { value: 'binance', label: 'Binance' },
    { value: 'bybit', label: 'Bybit' },
    { value: 'okx', label: 'OKX' },
    { value: 'kraken', label: 'Kraken' },
    { value: 'coinbase', label: 'Coinbase' }
  ];

  readonly timeframes: SimulationTimeframe[] = ['1m', '5m', '15m', '1h', '4h'];
  readonly speedOptions: SimulationSpeedMultiplier[] = [1, 2, 5, 10, 30, 60];
  readonly dataSpans: SimulationDataSpan[] = ['1M', '3M', '6M', '1Y'];

  selectedInstrument: ChartInstrument = this.instruments[0];
  manualSymbol = '';

  readonly controlForm: FormGroup = this.fb.group({
    dataMode: ['spot'],
    broker: ['binance'],
    timeframe: ['1m'],
    dataSpan: ['1Y'],
    speed: [60],
    leverage: [5],
    quantity: [1],
    slippage: [0.05],
    takeProfit: [null],
    stopLoss: [null],
    jumpDate: ['']
  });

  readonly simulationInitial$ = this.engine.initial$;
  readonly simulationTicks$ = this.engine.ticks$;
  readonly simulationMarkers$ = this.engine.markers$;
  readonly trades$ = this.engine.trades$;
  readonly status$ = this.engine.status$;

  constructor(
    private readonly fb: FormBuilder,
    private readonly engine: SimulationEngineService
  ) {}

  selectInstrument(instrument: ChartInstrument): void {
    this.selectedInstrument = instrument;
    this.manualSymbol = '';
  }

  applyManualSymbol(): void {
    const symbol = this.manualSymbol.trim().toUpperCase();
    if (!symbol) {
      return;
    }
    this.selectedInstrument = {
      symbol,
      name: `${symbol} · Custom`,
      description: 'Flux personnalisé depuis SimX Backend'
    };
  }

  async startSimulation(): Promise<void> {
    const config = this.buildConfig();
    await this.engine.start(config);
  }

  pauseSimulation(): void {
    this.engine.pause();
  }

  resumeSimulation(): void {
    this.engine.resume();
  }

  resetSimulation(): void {
    this.engine.reset();
  }

  changeSpeed(speed: SimulationSpeedMultiplier): void {
    this.controlForm.patchValue({ speed });
    this.engine.updateSpeed(speed);
  }

  jumpToDate(): void {
    const jumpDate = this.controlForm.value['jumpDate'];
    if (!jumpDate) {
      return;
    }
    this.engine.jumpTo(jumpDate);
  }

  executeTrade(side: 'BUY' | 'SELL'): void {
    const value = this.controlForm.value;
    this.engine.executeTrade({
      side,
      quantity: Number(value['quantity']) || 1,
      leverage: Number(value['leverage']) || 1,
      slippagePct: Number(value['slippage']) || 0,
      takeProfit: value['takeProfit'] ? Number(value['takeProfit']) : undefined,
      stopLoss: value['stopLoss'] ? Number(value['stopLoss']) : undefined
    });
  }

  trackTrade(index: number, trade: SimulationTrade): string {
    return trade.id;
  }

  private buildConfig(): SimulationConfig {
    const value = this.controlForm.value;
    return {
      symbol: this.selectedInstrument.symbol,
      displayName: this.selectedInstrument.name,
      dataMode: value['dataMode'],
      broker: value['broker'],
      timeframe: value['timeframe'],
      dataSpan: value['dataSpan'],
      speed: value['speed'],
      leverage: Number(value['leverage']) || 1,
      slippagePct: Number(value['slippage']) || 0,
      quantity: Number(value['quantity']) || 1,
      syntheticSeed: Math.random() * 500,
      startDate: value['jumpDate']
    };
  }
}

