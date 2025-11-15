import { Component, OnInit } from '@angular/core';
import { OrderService, Order } from '../../services/order.service';
import { WalletService, Wallet } from '../../services/wallet.service';
import { AssetService } from '../../services/asset.service';

interface DashboardMetrics {
  portfolioValue: number;
  totalProfitLoss: number;
  activePositions: number;
  winRate: number;
  portfolioChange: number;
  plChange: number;
  positionsChange: number;
  winRateChange: number;
}

interface PerformanceData {
  month: string;
  value: number;
}

interface RecentTrade extends Order {
  profitLoss: number;
  profitLossPercent: number;
  currentPrice: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  loading = true;
  
  // User data
  wallet: Wallet | null = null;
  orders: Order[] = [];
  assets: any[] = [];
  
  // Dashboard metrics
  metrics: DashboardMetrics = {
    portfolioValue: 0,
    totalProfitLoss: 0,
    activePositions: 0,
    winRate: 0,
    portfolioChange: 0,
    plChange: 0,
    positionsChange: 0,
    winRateChange: 0
  };
  
  // Performance chart data
  performanceData: PerformanceData[] = [];
  selectedPeriod: 'day' | 'week' | 'month' | 'year' = 'month';
  
  // Recent trades
  recentTrades: RecentTrade[] = [];
  
  // Current date
  currentDate = new Date();
  currentMonth = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  constructor(
    private orderService: OrderService,
    private walletService: WalletService,
    private assetService: AssetService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Load wallet
    this.walletService.getUserWallet().subscribe({
      next: (wallet: Wallet) => {
        this.wallet = wallet;
        this.calculateMetrics();
      },
      error: (error) => console.error('Error loading wallet:', error)
    });
    
    // Load orders
    this.orderService.getAllUserOrders().subscribe({
      next: (orders: Order[]) => {
        this.orders = orders.sort((a, b) => {
          const dateA = new Date(a.timestamp || '').getTime();
          const dateB = new Date(b.timestamp || '').getTime();
          return dateB - dateA;
        });
        
        this.calculateMetrics();
        this.prepareRecentTrades();
        this.preparePerformanceData();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
      }
    });
    
    // Load assets (holdings)
    this.assetService.getUserAssets().subscribe({
      next: (assets) => {
        this.assets = assets;
        this.calculateMetrics();
      },
      error: (error) => console.error('Error loading assets:', error)
    });
  }

  calculateMetrics(): void {
    if (!this.wallet) return;
    
    // Portfolio value = wallet balance + assets value
    const assetsValue = this.assets.reduce((sum, asset) => 
      sum + (asset.quantity * asset.currentPrice), 0
    );
    this.metrics.portfolioValue = this.wallet.balance + assetsValue;
    
    // Calculate total P/L
    const completedOrders = this.orders.filter(o => o.status === 'SUCCESS');
    let totalProfit = 0;
    
    completedOrders.forEach(order => {
      if (order.orderType === 'BUY') {
        const asset = this.assets.find(a => a.coin.id === order.orderItem.coin.id);
        if (asset) {
          const costBasis = order.orderItem.quantity * order.orderItem.buyPrice;
          const currentValue = order.orderItem.quantity * asset.currentPrice;
          totalProfit += (currentValue - costBasis);
        }
      } else {
        // For sell orders, profit is already realized
        totalProfit += order.price * 0.05; // Simplified: assume 5% profit
      }
    });
    
    this.metrics.totalProfitLoss = totalProfit;
    
    // Active positions (number of different assets held)
    this.metrics.activePositions = this.assets.length;
    
    // Calculate win rate
    const profitableOrders = completedOrders.filter(order => {
      if (order.orderType === 'SELL') {
        return true; // Assume sells are profitable for now
      }
      const asset = this.assets.find(a => a.coin.id === order.orderItem.coin.id);
      if (asset) {
        return asset.currentPrice > order.orderItem.buyPrice;
      }
      return false;
    });
    
    this.metrics.winRate = completedOrders.length > 0 
      ? (profitableOrders.length / completedOrders.length) * 100 
      : 0;
    
    // Calculate changes (simplified: random for demo, you'd compare with historical data)
    this.metrics.portfolioChange = this.calculateRandomChange(5, 10);
    this.metrics.plChange = this.calculateRandomChange(2, 5);
    this.metrics.positionsChange = this.calculateRandomChange(0, 3);
    this.metrics.winRateChange = this.calculateRandomChange(1, 3);
  }

  calculateRandomChange(min: number, max: number): number {
    const change = Math.random() * (max - min) + min;
    return Math.random() > 0.5 ? change : -change;
  }

  prepareRecentTrades(): void {
    this.recentTrades = this.orders.slice(0, 10).map(order => {
      const asset = this.assets.find(a => a.coin.id === order.orderItem?.coin?.id);
      const currentPrice = asset?.currentPrice || order.orderItem?.buyPrice || 0;
      
      let profitLoss = 0;
      if (order.orderType === 'BUY' && asset) {
        const costBasis = order.orderItem.quantity * order.orderItem.buyPrice;
        const currentValue = order.orderItem.quantity * currentPrice;
        profitLoss = currentValue - costBasis;
      } else {
        profitLoss = order.price * 0.05; // Simplified
      }
      
      const profitLossPercent = order.orderItem?.buyPrice 
        ? ((currentPrice - order.orderItem.buyPrice) / order.orderItem.buyPrice) * 100 
        : 0;
      
      return {
        ...order,
        profitLoss,
        profitLossPercent,
        currentPrice
      };
    });
  }

  preparePerformanceData(): void {
    // Group orders by month and calculate cumulative value
    const monthlyData: { [key: string]: number } = {};
    
    this.orders.forEach(order => {
      if (order.timestamp) {
        const date = new Date(order.timestamp);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0;
        }
        
        if (order.orderType === 'BUY') {
          monthlyData[monthKey] += order.price;
        } else {
          monthlyData[monthKey] -= order.price;
        }
      }
    });
    
    // Convert to array for chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.performanceData = months.map(month => ({
      month,
      value: monthlyData[month] || Math.random() * 20000 // Random for demo if no data
    }));
  }

  selectPeriod(period: 'day' | 'week' | 'month' | 'year'): void {
    this.selectedPeriod = period;
    // In a real app, you'd filter data based on period
    this.preparePerformanceData();
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'danger';
      default:
        return 'success';
    }
  }

  getStatusLabel(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'Closed';
      case 'PENDING':
        return 'Pending';
      case 'FAILED':
        return 'Failed';
      default:
        return status;
    }
  }

  getBarHeight(value: number): string {
    const maxValue = Math.max(...this.performanceData.map(d => d.value));
    const percentage = (value / maxValue) * 100;
    return `${Math.max(percentage, 10)}%`;
  }
}
