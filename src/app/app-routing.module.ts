import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { HomeComponent } from './home/home.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ActivateAccountComponent } from './activate-account/activate-account.component';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { PortfolioComponent } from './trading/portfolio/portfolio.component';
import { MarketsComponent } from './trading/markets/markets.component';
import { WatchlistComponent } from './trading/watchlist/watchlist.component';
import { TradeHistoryComponent } from './trading/trade-history/trade-history.component';
import { LeaderboardComponent } from './trading/leaderboard/leaderboard.component';
import { LearningComponent } from './trading/learning/learning.component';
import { ChartSimulatorComponent } from './trading/chart-simulator/chart-simulator.component';
import { ChartPageComponent } from './trading/chart-page/chart-page.component';


const routes: Routes = [
  // Landing page as default route
  { path: '', component: LandingPageComponent, pathMatch: 'full' },

  // Home page (optional - you can remove if not needed)
  { path: 'home', component: HomeComponent },

  // Auth routes (you can add these later)
   { path: 'auth/login', component: LoginComponent },
   { path: 'auth/register', component: RegisterComponent },
   { path: 'auth/activate-account', component: ActivateAccountComponent },

  // Trading platform routes
  { path: 'dashboard', component: DashboardComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'markets', component: MarketsComponent },
  { path: 'watchlist', component: WatchlistComponent },
  { path: 'trade-history', component: TradeHistoryComponent },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'learning', component: LearningComponent },
  { path: 'chart', component: ChartPageComponent },
  { path: 'chart-simulator', component: ChartSimulatorComponent },

  // Wildcard route for 404 pages (must be last)
  { path: '**', component: NotFoundComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
