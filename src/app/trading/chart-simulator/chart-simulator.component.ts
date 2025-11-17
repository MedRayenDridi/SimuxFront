import { Component } from '@angular/core';

interface ChartInstrument {
  symbol: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-chart-simulator',
  templateUrl: './chart-simulator.component.html',
  styleUrls: ['./chart-simulator.component.css']
})
export class ChartSimulatorComponent {
  instruments: ChartInstrument[] = [
    { symbol: 'btc', name: 'Bitcoin · USDT', description: 'Volatilité reine · Marché crypto' },
    { symbol: 'eth', name: 'Ethereum · USDT', description: 'Smart contracts & Layer 2' },
    { symbol: 'sol', name: 'Solana · USDT', description: 'Écosystème haute performance' },
    { symbol: 'ada', name: 'Cardano · USDT', description: 'Proof-of-Stake institutionnel' }
  ];

  selectedInstrument: ChartInstrument = this.instruments[0];

  manualSymbol = '';

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
}

