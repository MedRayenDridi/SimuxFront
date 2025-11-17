import { Component, OnInit } from '@angular/core';
import { LeaderboardService } from '../../services/leaderboard.service';
import { SimulationService } from '../../services/simulation.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.4s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class LeaderboardComponent implements OnInit {
  globalLeaderboard: any[] = [];
  filteredLeaderboard: any[] = [];
  currentUser: any = null;
  topThree: any[] = [];
  categories: any = {};
  searchQuery: string = '';
  loading: boolean = true;
  
  // Simulation
  showSimulationModal: boolean = false;
  simulationLoading: boolean = false;
  simulationData: any = null;
  showPredictedRankings: boolean = false;
  predictedLeaderboard: any[] = [];

  categoryTabs = [
    { key: 'dayTraders', label: 'Best Day Traders', icon: '📈' },
    { key: 'swingTraders', label: 'Best Swing Traders', icon: '📊' },
    { key: 'cryptoExperts', label: 'Crypto Experts', icon: '₿' },
    { key: 'consistent', label: 'Most Consistent', icon: '🎯' },
    { key: 'biggestPortfolios', label: 'Biggest Portfolios', icon: '💰' },
    { key: 'risingStars', label: 'Rising Stars', icon: '⭐' }
  ];

  constructor(
    private leaderboardService: LeaderboardService,
    private simulationService: SimulationService
  ) { }

  ngOnInit(): void {
    this.loadLeaderboardData();
  }

  loadLeaderboardData(): void {
    this.loading = true;

    this.leaderboardService.getGlobalLeaderboard(0).subscribe({
      next: (data) => {
        this.globalLeaderboard = data;
        this.filteredLeaderboard = data;
        this.topThree = data.slice(0, 3);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading leaderboard:', err);
        this.loading = false;
      }
    });

    this.leaderboardService.getCurrentUserStats().subscribe({
      next: (data) => {
        this.currentUser = data;
      },
      error: (err) => console.error('Error loading user stats:', err)
    });

    this.leaderboardService.getCategoryLeaderboards().subscribe({
      next: (data) => {
        this.categories = data;
      },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  // ========== SIMULATION METHODS ==========

  startSimulation(): void {
    this.simulationLoading = true;
    this.showSimulationModal = true;

    this.simulationService.predictOneYear().subscribe({
      next: (predictions) => {
        this.predictedLeaderboard = predictions;
        
        // Get current user's prediction
        const userPrediction = predictions.find(p => p.userId === this.currentUser?.userId);
        
        this.simulationService.getCurrentUserPrediction().subscribe({
          next: (data) => {
            this.simulationData = data;
            this.simulationLoading = false;
          },
          error: (err) => {
            console.error('Error loading user prediction:', err);
            this.simulationLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error running simulation:', err);
        this.simulationLoading = false;
        alert('Failed to run simulation. Please try again.');
      }
    });
  }

  closeSimulationModal(): void {
    this.showSimulationModal = false;
    this.simulationData = null;
  }

  toggleRankings(): void {
    this.showPredictedRankings = !this.showPredictedRankings;
    if (this.showPredictedRankings) {
      this.filteredLeaderboard = this.predictedLeaderboard;
      this.topThree = this.predictedLeaderboard.slice(0, 3).map(p => ({
        fullName: p.fullName,
        returnPercentage: p.predictedReturnPercentage,
        portfolioValue: p.predictedPortfolioValue,
        totalTrades: 0
      }));
    } else {
      this.filteredLeaderboard = this.globalLeaderboard;
      this.topThree = this.globalLeaderboard.slice(0, 3);
    }
  }

  // ========== HELPER METHODS ==========

  filterTraders(): void {
    if (!this.searchQuery.trim()) {
      this.filteredLeaderboard = this.showPredictedRankings ? this.predictedLeaderboard : this.globalLeaderboard;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    const sourceData = this.showPredictedRankings ? this.predictedLeaderboard : this.globalLeaderboard;
    this.filteredLeaderboard = sourceData.filter(trader =>
      trader.fullName.toLowerCase().includes(query) ||
      trader.username.toLowerCase().includes(query)
    );
  }

  getCategoryData(key: string): any[] {
    return this.categories[key] || [];
  }

  formatCurrency(value: number): string {
    if (!value && value !== 0) return 'TND 0.00';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(value);
  }

  formatPercentage(value: number): string {
    if (!value && value !== 0) return '0.00%';
    const formatted = Math.abs(value).toFixed(2);
    return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
  }

  getBadgeClass(badge: string): string {
    const badgeMap: any = {
      'Elite Day Trader': 'elite',
      'Day Trader': 'day-trader',
      'Swing Trader': 'swing',
      'Crypto Legend': 'legend',
      'Crypto Expert': 'crypto',
      'Master Trader': 'master',
      'Consistent Trader': 'consistent',
      'Active Trader': 'active',
      'Rising Star': 'rising',
      'Beginner': 'beginner'
    };
    return badgeMap[badge] || 'beginner';
  }

  getBadgeIcon(badge: string): string {
    const iconMap: any = {
      'Elite Day Trader': '⚡',
      'Day Trader': '📈',
      'Swing Trader': '📊',
      'Crypto Legend': '👑',
      'Crypto Expert': '₿',
      'Master Trader': '🎖️',
      'Consistent Trader': '🎯',
      'Active Trader': '🔥',
      'Rising Star': '⭐',
      'Beginner': '🌱'
    };
    return iconMap[badge] || '🏆';
  }

  getRankColor(rank: number): string {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    if (rank <= 10) return '#1a3d28';
    return '#6b7280';
  }

  getReturnClass(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  isCurrentUser(userId: number): boolean {
    return this.currentUser && this.currentUser.userId === userId;
  }

  getRankChangeIcon(change: number): string {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  }

  getRankChangeClass(change: number): string {
    if (change > 0) return 'rank-up';
    if (change < 0) return 'rank-down';
    return 'rank-same';
  }
  // Add this method inside your LeaderboardComponent class
getAbsoluteValue(value: number | undefined): number {
  return Math.abs(value || 0);
}

}
