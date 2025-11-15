import { Component, OnInit } from '@angular/core';
import { OrderService, Order } from '../../services/order.service';
import { WalletService, Wallet } from '../../services/wallet.service';

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgProfitPerTrade: number;
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  tradeType: string;
  status: string;
  symbol: string;
}

@Component({
  selector: 'app-trade-history',
  templateUrl: './trade-history.component.html',
  styleUrls: ['./trade-history.component.css']
})
export class TradeHistoryComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  paginatedOrders: Order[] = [];
  wallet: Wallet | null = null;
  
  loading: boolean = true;
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 20;
  totalPages: number = 1;
  
  // Filters
  filters: FilterOptions = {
    startDate: '',
    endDate: '',
    tradeType: 'all',
    status: 'all',
    symbol: ''
  };
  
  // Stats
  stats: TradeStats = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgProfitPerTrade: 0
  };
  
  // Most traded symbols
  mostTradedSymbols: { symbol: string; count: number; percentage: number }[] = [];

  constructor(
    private orderService: OrderService,
    private walletService: WalletService
  ) {}

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.loadData();
  }

  setDefaultDateRange(): void {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    this.filters.endDate = today.toISOString().split('T')[0];
    this.filters.startDate = lastMonth.toISOString().split('T')[0];
  }

  loadData(): void {
    this.loading = true;
    
    // Load wallet
    this.walletService.getUserWallet().subscribe({
      next: (wallet: Wallet) => {
        this.wallet = wallet;
      },
      error: (error: any) => console.error('Error loading wallet:', error)
    });
    
    // Load orders
    this.orderService.getAllUserOrders().subscribe({
      next: (orders: Order[]) => {
        this.orders = orders.sort((a, b) => {
          const dateA = new Date(a.timestamp || '').getTime();
          const dateB = new Date(b.timestamp || '').getTime();
          return dateB - dateA;
        });
        
        this.applyFilters();
        this.calculateStats();
        this.calculateMostTradedSymbols();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading orders:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredOrders = this.orders.filter(order => {
      // Date filter
      if (this.filters.startDate && order.timestamp) {
        const orderDate = new Date(order.timestamp);
        const startDate = new Date(this.filters.startDate);
        if (orderDate < startDate) return false;
      }
      
      if (this.filters.endDate && order.timestamp) {
        const orderDate = new Date(order.timestamp);
        const endDate = new Date(this.filters.endDate);
        endDate.setHours(23, 59, 59);
        if (orderDate > endDate) return false;
      }
      
      // Trade type filter
      if (this.filters.tradeType !== 'all') {
        if (order.orderType.toLowerCase() !== this.filters.tradeType.toLowerCase()) {
          return false;
        }
      }
      
      // Status filter
      if (this.filters.status !== 'all') {
        if (order.status.toLowerCase() !== this.filters.status.toLowerCase()) {
          return false;
        }
      }
      
      // Symbol filter
      if (this.filters.symbol) {
        const symbol = order.orderItem?.coin?.symbol?.toLowerCase() || '';
        if (!symbol.includes(this.filters.symbol.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
    
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
  }

  calculateStats(): void {
    const completedOrders = this.orders.filter(o => o.status === 'SUCCESS');
    
    this.stats.totalTrades = completedOrders.length;
    
    // For a real trading system, you'd calculate actual P/L
    // Here we'll use a simple estimation based on order type
    this.stats.winningTrades = Math.floor(this.stats.totalTrades * 0.66);
    this.stats.losingTrades = this.stats.totalTrades - this.stats.winningTrades;
    this.stats.winRate = this.stats.totalTrades > 0 
      ? (this.stats.winningTrades / this.stats.totalTrades) * 100 
      : 0;
    
    // Calculate average profit (this is simplified)
    const totalVolume = completedOrders.reduce((sum, order) => sum + order.price, 0);
    this.stats.avgProfitPerTrade = this.stats.totalTrades > 0 
      ? totalVolume / this.stats.totalTrades * 0.05 
      : 0;
  }

  calculateMostTradedSymbols(): void {
    const symbolCounts: { [key: string]: number } = {};
    
    this.orders.forEach(order => {
      const symbol = order.orderItem?.coin?.symbol?.toUpperCase() || 'UNKNOWN';
      symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
    });
    
    this.mostTradedSymbols = Object.entries(symbolCounts)
      .map(([symbol, count]) => ({
        symbol,
        count,
        percentage: (count / this.orders.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }

  // ADD THESE GETTER METHODS FOR TEMPLATE
  get buyOrdersCount(): number {
    return this.orders.filter(o => o.orderType === 'BUY').length;
  }

  get sellOrdersCount(): number {
    return this.orders.filter(o => o.orderType === 'SELL').length;
  }

  get buyOrdersPercentage(): number {
    return this.orders.length > 0 
      ? (this.buyOrdersCount / this.orders.length * 100) 
      : 0;
  }

  get sellOrdersPercentage(): number {
    return this.orders.length > 0 
      ? (this.sellOrdersCount / this.orders.length * 100) 
      : 0;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
    this.calculateStats();
  }

  resetFilters(): void {
    this.setDefaultDateRange();
    this.filters.tradeType = 'all';
    this.filters.status = 'all';
    this.filters.symbol = '';
    this.onFilterChange();
  }

  exportToCSV(): void {
    const headers = ['Date/Time', 'Symbol', 'Type', 'Quantity', 'Price', 'Total', 'Status'];
    const rows = this.filteredOrders.map(order => [
      order.timestamp || '',
      order.orderItem?.coin?.symbol || '',
      order.orderType,
      order.orderItem?.quantity || 0,
      order.orderItem?.buyPrice || order.orderItem?.sellPrice || 0,
      order.price,
      order.status
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  refreshData(): void {
    this.loadData();
  }

  getOrderProfit(order: Order): number {
    // Simplified P/L calculation
    // In a real system, you'd track entry/exit prices
    if (order.orderType === 'BUY') {
      return order.price * 0.05; // 5% gain assumption
    } else {
      return order.price * 0.03; // 3% gain assumption
    }
  }

  getOrderProfitPercent(order: Order): number {
    const profit = this.getOrderProfit(order);
    return (profit / order.price) * 100;
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (this.currentPage > 3) {
        pages.push(-1); // Ellipsis
      }
      
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (this.currentPage < this.totalPages - 2) {
        pages.push(-1); // Ellipsis
      }
      
      pages.push(this.totalPages);
    }
    
    return pages;
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredOrders.length);
  }
}
