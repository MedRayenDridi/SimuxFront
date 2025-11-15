export interface Metric {
  title: string;
  value: string | number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
  period: string;
  featured?: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  cashAvailable: number;
  investedAmount: number;
  todayProfitLoss: number;
  todayProfitLossPercent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
}

export interface Holding {
  id: string;
  symbol: string;
  companyName: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalProfitLoss: number;
  profitLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface Allocation {
  category: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PerformanceData {
  date: string;
  value: number;
}

export interface PerformerData {
  symbol: string;
  companyName: string;
  change: number;
  changePercent: number;
}
