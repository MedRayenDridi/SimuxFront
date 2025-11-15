import { Component, OnInit, OnDestroy } from '@angular/core';
import { CoinService, Coin } from '../../services/coin.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface WatchlistCoin extends Coin {
  isInWatchlist?: boolean;
}

@Component({
  selector: 'app-watchlist',
  templateUrl: './watchlist.component.html',
  styleUrls: ['./watchlist.component.css']
})
export class WatchlistComponent implements OnInit, OnDestroy {
  coins: WatchlistCoin[] = [];
  trendingCoins: any[] = [];
  watchlistCoins: WatchlistCoin[] = [];
  currentPage = 1;
  activeTab = 'watchlist';
  searchQuery = '';
  loading = false;
  error: string | null = null;
  private refreshSubscription?: Subscription;

  constructor(private coinService: CoinService) {}

  ngOnInit(): void {
    this.loadCoins(1);
    this.loadWatchlist();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadCoins(page: number = 1): void {
    this.loading = true;
    this.error = null;
    this.currentPage = page;
    
    this.coinService.getCoinList(page).subscribe({
      next: (data) => {
        console.log('Raw data from backend:', data);
        
        // Map the backend response to match our interface
        this.coins = data.map(coin => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          currentPrice: coin.current_price || coin.currentPrice,
          marketCap: coin.market_cap || coin.marketCap,
          marketCapRank: coin.market_cap_rank || coin.marketCapRank,
          totalVolume: coin.total_volume || coin.totalVolume,
          high24h: coin.high_24h || coin.high24h,
          low24h: coin.low_24h || coin.low24h,
          priceChange24h: coin.price_change_24h || coin.priceChange24h,
          priceChangePercentage24h: coin.price_change_percentage_24h || coin.priceChangePercentage24h,
          marketCapChange24h: coin.market_cap_change_24h || coin.marketCapChange24h,
          marketCapChangePercentage24h: coin.market_cap_change_percentage_24h || coin.marketCapChangePercentage24h,
          totalSupply: coin.total_supply || coin.totalSupply,
          isInWatchlist: this.isInWatchlist(coin.id)
        }));
        
        console.log('Mapped coins:', this.coins);
        this.updateWatchlistCoins();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load coins. Please try again.';
        this.loading = false;
        console.error('Error loading coins:', err);
      }
    });
  }

  loadWatchlist(): void {
    const savedWatchlist = localStorage.getItem('watchlist');
    if (savedWatchlist) {
      const watchlistIds = JSON.parse(savedWatchlist);
      this.watchlistCoins = this.coins.filter(coin => watchlistIds.includes(coin.id));
    }
  }

  loadTop50Coins(): void {
    this.loading = true;
    this.error = null;
    this.coinService.getTop50Coins().subscribe({
      next: (data) => {
        console.log('Top 50 coins:', data);
        
        this.coins = data.map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          currentPrice: coin.current_price || coin.currentPrice,
          marketCap: coin.market_cap || coin.marketCap,
          marketCapRank: coin.market_cap_rank || coin.marketCapRank,
          totalVolume: coin.total_volume || coin.totalVolume,
          high24h: coin.high_24h || coin.high24h,
          low24h: coin.low_24h || coin.low24h,
          priceChange24h: coin.price_change_24h || coin.priceChange24h,
          priceChangePercentage24h: coin.price_change_percentage_24h || coin.priceChangePercentage24h,
          marketCapChange24h: coin.market_cap_change_24h || coin.marketCapChange24h,
          marketCapChangePercentage24h: coin.market_cap_change_percentage_24h || coin.marketCapChangePercentage24h,
          totalSupply: coin.total_supply || coin.totalSupply,
          isInWatchlist: this.isInWatchlist(coin.id)
        }));
        
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load top coins.';
        this.loading = false;
        console.error('Error loading top 50 coins:', err);
      }
    });
  }

  searchCoins(): void {
    if (this.searchQuery.trim()) {
      this.coinService.searchCoin(this.searchQuery).subscribe({
        next: (data) => {
          console.log('Search results:', data);
        },
        error: (err) => {
          console.error('Search error:', err);
        }
      });
    }
  }

  addToWatchlist(coin: Coin): void {
    const watchlist = this.getWatchlistIds();
    if (!watchlist.includes(coin.id)) {
      watchlist.push(coin.id);
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
      
      const watchlistCoin = this.coins.find(c => c.id === coin.id);
      if (watchlistCoin) {
        this.watchlistCoins.push(watchlistCoin);
      }
      
      this.updateCoinWatchlistStatus(coin.id, true);
    }
  }

  removeFromWatchlist(coinId: string): void {
    const watchlist = this.getWatchlistIds().filter(id => id !== coinId);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    this.watchlistCoins = this.watchlistCoins.filter(coin => coin.id !== coinId);
    this.updateCoinWatchlistStatus(coinId, false);
  }

  getCoinDetails(coinId: string): void {
    if (!coinId) return;
    
    this.loading = true;
    this.coinService.getCoinDetails(coinId).subscribe({
      next: (data) => {
        console.log('Coin details:', data);
        const coin: Coin = {
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          image: data.image?.large || data.image?.small || data.image,
          currentPrice: data.market_data?.current_price?.usd || 0,
          marketCap: data.market_data?.market_cap?.usd || 0,
          marketCapRank: data.market_data?.market_cap_rank || 0,
          totalVolume: data.market_data?.total_volume?.usd || 0,
          high24h: data.market_data?.high_24h?.usd || 0,
          low24h: data.market_data?.low_24h?.usd || 0,
          priceChange24h: data.market_data?.price_change_24h || 0,
          priceChangePercentage24h: data.market_data?.price_change_percentage_24h || 0,
          marketCapChange24h: data.market_data?.market_cap_change_24h || 0,
          marketCapChangePercentage24h: data.market_data?.market_cap_change_percentage_24h || 0,
          totalSupply: data.market_data?.total_supply || 0
        };
        
        this.addToWatchlist(coin);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching coin details:', err);
        this.error = 'Failed to fetch coin details.';
        this.loading = false;
      }
    });
  }

  isInWatchlist(coinId: string): boolean {
    return this.getWatchlistIds().includes(coinId);
  }

  private getWatchlistIds(): string[] {
    const saved = localStorage.getItem('watchlist');
    return saved ? JSON.parse(saved) : [];
  }

  private updateCoinWatchlistStatus(coinId: string, status: boolean): void {
    const coin = this.coins.find(c => c.id === coinId);
    if (coin) {
      coin.isInWatchlist = status;
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'trending') {
      this.loadTop50Coins();
    } else if (tab === 'crypto') {
      this.loadCoins(this.currentPage);
    } else if (tab === 'watchlist') {
      this.updateWatchlistCoins();
    }
  }

  formatNumber(num: number): string {
    if (!num) return '$0';
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    return '$' + num.toFixed(2);
  }

  formatPrice(price: number): string {
    if (!price) return '0.00';
    return price >= 1 ? price.toFixed(2) : price.toFixed(6);
  }

  refreshData(): void {
    if (this.activeTab === 'crypto') {
      this.loadCoins(this.currentPage);
    } else if (this.activeTab === 'trending') {
      this.loadTop50Coins();
    } else if (this.activeTab === 'watchlist') {
      this.loadCoins(this.currentPage);
      setTimeout(() => this.updateWatchlistCoins(), 500);
    }
  }

  nextPage(): void {
    this.currentPage++;
    this.loadCoins(this.currentPage);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadCoins(this.currentPage);
    }
  }

  private startAutoRefresh(): void {
    this.refreshSubscription = interval(60000)
      .pipe(switchMap(() => this.coinService.getCoinList(this.currentPage)))
      .subscribe({
        next: (data) => {
          this.coins = data.map(coin => ({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            image: coin.image,
            currentPrice: coin.current_price || coin.currentPrice,
            marketCap: coin.market_cap || coin.marketCap,
            marketCapRank: coin.market_cap_rank || coin.marketCapRank,
            totalVolume: coin.total_volume || coin.totalVolume,
            high24h: coin.high_24h || coin.high24h,
            low24h: coin.low_24h || coin.low24h,
            priceChange24h: coin.price_change_24h || coin.priceChange24h,
            priceChangePercentage24h: coin.price_change_percentage_24h || coin.priceChangePercentage24h,
            marketCapChange24h: coin.market_cap_change_24h || coin.marketCapChange24h,
            marketCapChangePercentage24h: coin.market_cap_change_percentage_24h || coin.marketCapChangePercentage24h,
            totalSupply: coin.total_supply || coin.totalSupply,
            isInWatchlist: this.isInWatchlist(coin.id)
          }));
          this.updateWatchlistCoins();
        },
        error: (err) => console.error('Auto-refresh error:', err)
      });
  }
  handleImageError(event: any, symbol: string): void {
  // Fallback to a simple colored circle with the symbol initial
  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 36;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Generate a color based on the symbol
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(18, 18, 18, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol.substring(0, 2).toUpperCase(), 18, 18);
    
    event.target.src = canvas.toDataURL();
  }
}


  private updateWatchlistCoins(): void {
    const watchlistIds = this.getWatchlistIds();
    this.watchlistCoins = this.coins.filter(coin => watchlistIds.includes(coin.id));
  }
}
