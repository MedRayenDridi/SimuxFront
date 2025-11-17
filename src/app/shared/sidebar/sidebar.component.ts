import { Component } from '@angular/core';
import { CurrencyService } from '../../services/currency.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {

  constructor(public currencyService: CurrencyService, private userService: UserService) {}

  toggleCurrency(): void {
    this.currencyService.toggleCurrency();
  }

  logout(): void {
    this.userService.logout();
  }

}
