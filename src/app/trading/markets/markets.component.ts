import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CoinService, Coin } from '../../services/coin.service';
import { WalletService, Wallet } from '../../services/wallet.service';
import { OrderService } from '../../services/order.service';

interface CoinWithStats extends Coin {
  changeClass: 'positive' | 'negative';
  sparklineData: string;
}

@Component({
  selector: 'app-markets',
  templateUrl: './markets.component.html',
  styleUrls: ['./markets.component.css']
})
export class MarketsComponent implements OnInit, OnDestroy {
  coins: CoinWithStats[] = [];
  topGainers: CoinWithStats[] = [];
  topLosers: CoinWithStats[] = [];
  mostActive: CoinWithStats[] = [];

  wallet: Wallet | null = null;
  
  activeTab: 'gainers' | 'losers' | 'active' = 'gainers';
  searchTerm: string = '';
  loading: boolean = true;
  
  // Trading Modal
  showTradeModal: boolean = false;
  selectedCoin: Coin | null = null;
  tradeType: 'BUY' | 'SELL' = 'BUY';
  tradeQuantity: number = 0;
  tradeLoading: boolean = false;
  tradeMessage: string = '';
  
  private refreshSubscription?: Subscription;

  constructor(
    private coinService: CoinService,
    private walletService: WalletService,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    this.loadData();
    
    // Auto-refresh every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadCoins();
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadData(): void {
    this.loadWallet();
    this.loadCoins();
  }

  loadWallet(): void {
    this.walletService.getUserWallet().subscribe({
      next: (wallet: Wallet) => {
        this.wallet = wallet;
      },
      error: (error: any) => console.error('Error loading wallet:', error)
    });
  }

  loadCoins(): void {
    this.loading = true;
    this.coinService.getTop50Coins().subscribe({
      next: (coins: any[]) => {
        this.coins = coins.map(coin => this.enhanceCoin(coin));
        this.categorizeCoins();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading coins:', error);
        this.loading = false;
      }
    });
  }

  enhanceCoin(coin: any): CoinWithStats {
    const price = coin.currentPrice || coin.current_price || 0;
    const change24h = coin.priceChangePercentage24h || coin.price_change_percentage_24h || 0;
    
    return {
      ...coin,
      currentPrice: price,
      priceChangePercentage24h: change24h,
      changeClass: change24h >= 0 ? 'positive' : 'negative',
      sparklineData: this.generateSparkline(change24h)
    };
  }

  generateSparkline(change: number): string {
    // Generate simple sparkline points based on price change
    const points: string[] = [];
    const baseY = 20;
    const amplitude = 15;
    
    for (let i = 0; i <= 100; i += 10) {
      const variance = Math.sin((i / 100) * Math.PI * 2) * amplitude;
      const y = baseY + variance + (change > 0 ? -5 : 5);
      points.push(`${i},${y}`);
    }
    
    return points.join(' ');
  }

  categorizeCoins(): void {
    const sorted = [...this.coins].sort((a, b) => 
      b.priceChangePercentage24h - a.priceChangePercentage24h
    );
    
    this.topGainers = sorted.filter(c => c.priceChangePercentage24h > 0).slice(0, 10);
    this.topLosers = sorted.filter(c => c.priceChangePercentage24h < 0).slice(-10).reverse();
    
    const volumeSorted = [...this.coins].sort((a, b) => 
      (b.totalVolume || b.total_volume || 0) - (a.totalVolume || a.total_volume || 0)
    );
    this.mostActive = volumeSorted.slice(0, 10);
  }

  get displayedCoins(): CoinWithStats[] {
    switch (this.activeTab) {
      case 'gainers':
        return this.topGainers;
      case 'losers':
        return this.topLosers;
      case 'active':
        return this.mostActive;
      default:
        return this.topGainers;
    }
  }

  setActiveTab(tab: 'gainers' | 'losers' | 'active'): void {
    this.activeTab = tab;
  }

  openTradeModal(coin: Coin, type: 'BUY' | 'SELL' = 'BUY'): void {
    this.selectedCoin = coin;
    this.tradeType = type;
    this.tradeQuantity = 0;
    this.tradeMessage = '';
    this.showTradeModal = true;
  }

  closeTradeModal(): void {
    this.showTradeModal = false;
    this.selectedCoin = null;
    this.tradeQuantity = 0;
    this.tradeMessage = '';
  }

  get totalTradePrice(): number {
    if (!this.selectedCoin || !this.tradeQuantity) return 0;
    const price = this.selectedCoin.currentPrice || this.selectedCoin.current_price || 0;
    return price * this.tradeQuantity;
  }

  get canTrade(): boolean {
    if (!this.selectedCoin || !this.tradeQuantity || this.tradeQuantity <= 0) {
      return false;
    }
    
    if (this.tradeType === 'BUY' && this.wallet) {
      return this.wallet.balance >= this.totalTradePrice;
    }
    
    return true;
  }

  executeTrade(): void {
    if (!this.selectedCoin || !this.canTrade) return;

    this.tradeLoading = true;
    this.tradeMessage = '';

    const tradeObservable = this.tradeType === 'BUY'
      ? this.orderService.buyAsset(this.selectedCoin.id, this.tradeQuantity)
      : this.orderService.sellAsset(this.selectedCoin.id, this.tradeQuantity);

    tradeObservable.subscribe({
      next: (order: any) => {
        this.tradeMessage = `Successfully ${this.tradeType === 'BUY' ? 'bought' : 'sold'} ${this.tradeQuantity} ${this.selectedCoin?.symbol.toUpperCase()}!`;
        this.tradeLoading = false;
        
        // Refresh wallet
        this.loadWallet();
        
        // Close modal after 2 seconds
        setTimeout(() => {
          this.closeTradeModal();
        }, 2000);
      },
      error: (error: any) => {
        this.tradeMessage = error.message || 'Transaction failed. Please try again.';
        this.tradeLoading = false;
      }
    });
  }

  formatVolume(volume: number): string {
    if (volume >= 1000000000) {
      return (volume / 1000000000).toFixed(2) + 'B';
    } else if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(2) + 'K';
    }
    return volume.toFixed(2);
  }

  refreshData(): void {
    this.loadData();
  }

}
