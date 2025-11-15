import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common'; // Add this
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { HomeComponent } from './home/home.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ActivateAccountComponent } from './activate-account/activate-account.component';

// Import services
import { UserService } from './services/user.service';
import { RoleService } from './services/role.service';
import { ConnexionInfoService } from './services/connexion-info.service';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { PortfolioComponent } from './trading/portfolio/portfolio.component';
import { MarketsComponent } from './trading/markets/markets.component';
import { WatchlistComponent } from './trading/watchlist/watchlist.component';
import { TradeHistoryComponent } from './trading/trade-history/trade-history.component';
import { LeaderboardComponent } from './trading/leaderboard/leaderboard.component';
import { LearningComponent } from './trading/learning/learning.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingPageComponent,
    HomeComponent,
    NotFoundComponent,
    LoginComponent,
    RegisterComponent,
    ActivateAccountComponent,
    DashboardComponent,
    PortfolioComponent,
    MarketsComponent,
    WatchlistComponent,
    TradeHistoryComponent,
    LeaderboardComponent,
    LearningComponent,
    SidebarComponent
  ],
  imports: [
    BrowserModule,
    CommonModule, // Add this - important for *ngIf, *ngFor
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  providers: [
    UserService,
    RoleService,
    ConnexionInfoService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
