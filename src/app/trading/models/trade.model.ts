export interface Trade {
  id: string;
  symbol: string;
  companyName?: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  currentPrice?: number;
  profitLoss?: number;
  profitLossPercent?: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELLED';
  entryDate: string;
  exitDate?: string;
  duration?: string;
  notes?: string;
}

export interface TradeRequest {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT';
  notes?: string;
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageProfitPerTrade: number;
  totalProfit: number;
  totalLoss: number;
  largestWin: number;
  largestLoss: number;
}

export interface TradeFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: 'BUY' | 'SELL' | 'ALL';
  status?: 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELLED' | 'ALL';
  symbol?: string;
  page?: number;
  pageSize?: number;
}

export interface TradeAnalytics {
  winRateOverTime: ChartData[];
  profitLossDistribution: ChartData[];
  tradingHours: HeatmapData[];
  mostTradedSymbols: BarChartData[];
}

export interface ChartData {
  label: string;
  value: number;
}

export interface HeatmapData {
  hour: number;
  day: string;
  value: number;
}

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}
