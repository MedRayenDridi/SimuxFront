import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { Wallet, WalletService } from '../../services/wallet.service';
import { Asset, AssetService } from '../../services/asset.service';
import { Order, OrderService } from '../../services/order.service';
import { CoinService } from '../../services/coin.service';

interface PortfolioStats {
  totalValue: number;
  cashAvailable: number;
  investedAmount: number;
  todayPL: number;
  todayPLPercent: number;
}

interface HoldingWithStats extends Asset {
  currentPrice: number;
  marketValue: number;
  totalPL: number;
  plPercent: number;
}

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit, OnDestroy {
  wallet: Wallet | null = null;
  assets: Asset[] = [];
  holdings: HoldingWithStats[] = [];
  orders: Order[] = [];
  
  portfolioStats: PortfolioStats = {
    totalValue: 0,
    cashAvailable: 0,
    investedAmount: 0,
    todayPL: 0,
    todayPLPercent: 0
  };

  searchTerm: string = '';
  filterType: string = 'all';
  loading: boolean = true;
  
  bestPerformer: string = '-';
  worstPerformer: string = '-';
  
  private refreshSubscription?: Subscription;

  constructor(
    private walletService: WalletService,
    private assetService: AssetService,
    private orderService: OrderService,
    private coinService: CoinService
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    
    // Auto-refresh every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.refreshData();
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadAllData(): void {
    this.loading = true;
    
    // Load wallet
    this.walletService.getUserWallet().subscribe({
      next: (wallet) => {
        this.wallet = wallet;
        this.portfolioStats.cashAvailable = wallet.balance;
        this.calculatePortfolioStats();
      },
      error: (error) => console.error('Error loading wallet:', error)
    });

    // Load assets
    this.assetService.getUserAssets().subscribe({
      next: (assets) => {
        this.assets = assets;
        this.processAssets();
      },
      error: (error) => console.error('Error loading assets:', error)
    });

    // Load orders
    this.orderService.getAllUserOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
      }
    });
  }

  processAssets(): void {
    if (this.assets.length === 0) {
      this.holdings = [];
      this.calculatePortfolioStats();
      return;
    }

    this.holdings = this.assets.map(asset => {
      const currentPrice = asset.coin.currentPrice || asset.coin.current_price || 0;
      const marketValue = currentPrice * asset.quantity;
      const totalPL = marketValue - (asset.buyPrice * asset.quantity);
      const plPercent = ((currentPrice - asset.buyPrice) / asset.buyPrice) * 100;

      return {
        ...asset,
        currentPrice,
        marketValue,
        totalPL,
        plPercent
      };
    });

    this.findBestWorstPerformers();
    this.calculatePortfolioStats();
  }

  findBestWorstPerformers(): void {
    if (this.holdings.length === 0) return;

    const sorted = [...this.holdings].sort((a, b) => b.plPercent - a.plPercent);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    this.bestPerformer = `${best.coin.symbol.toUpperCase()} ${best.plPercent > 0 ? '+' : ''}${best.plPercent.toFixed(1)}%`;
    this.worstPerformer = `${worst.coin.symbol.toUpperCase()} ${worst.plPercent > 0 ? '+' : ''}${worst.plPercent.toFixed(1)}%`;
  }

  calculatePortfolioStats(): void {
    const investedAmount = this.holdings.reduce((sum, h) => sum + (h.buyPrice * h.quantity), 0);
    const currentValue = this.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalPL = currentValue - investedAmount;
    const plPercent = investedAmount > 0 ? (totalPL / investedAmount) * 100 : 0;

    this.portfolioStats = {
      totalValue: currentValue + (this.wallet?.balance || 0),
      cashAvailable: this.wallet?.balance || 0,
      investedAmount: currentValue,
      todayPL: totalPL,
      todayPLPercent: plPercent
    };
  }

  refreshData(): void {
    this.walletService.getUserWallet().subscribe({
      next: (wallet) => {
        this.wallet = wallet;
        this.portfolioStats.cashAvailable = wallet.balance;
        this.calculatePortfolioStats();
      }
    });

    this.assetService.getUserAssets().subscribe({
      next: (assets) => {
        this.assets = assets;
        this.processAssets();
      }
    });
  }

  get filteredHoldings(): HoldingWithStats[] {
    let filtered = this.holdings;

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(h => 
        h.coin.symbol.toLowerCase().includes(term) ||
        h.coin.name.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (this.filterType !== 'all') {
      // Add filtering logic based on asset type if you have that field
    }

    return filtered;
  }

  buyMore(holding: HoldingWithStats): void {
    // Navigate to trading page or open modal
    console.log('Buy more:', holding.coin.symbol);
  }

  sell(holding: HoldingWithStats): void {
    // Navigate to trading page or open modal
    console.log('Sell:', holding.coin.symbol);
  }

  getAssetAllocation(): { stocks: number; crypto: number; etfs: number } {
    const total = this.portfolioStats.investedAmount;
    if (total === 0) return { stocks: 0, crypto: 100, etfs: 0 };
    
    // For now, assume everything is crypto
    // You can enhance this by adding asset type to your Asset model
    return {
      stocks: 0,
      crypto: 100,
      etfs: 0
    };
  }
}
