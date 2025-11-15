import { Component } from '@angular/core';
import { Residence } from 'src/app/core/Models/residence';

@Component({
  selector: 'app-residences',
  templateUrl: './residences.component.html',
  styleUrls: ['./residences.component.css']
})
export class ResidencesComponent {
  listResidences:Residence[]=[
    {id:1,"name": "El fel","address":"Borj Cedria",
    "image":"../../assets/images/R1.jpg", status: "Disponible"},
    {id:2,"name": "El yasmine",
    "address":"Ezzahra","image":"../../assets/images/R2.jpg", status:
    "Disponible" },
    {id:3,"name": "El Arij",
    "address":"Rades","image":"../../assets/images/R3.jpg", status:
    "Vendu"},
    {id:4,"name": "El Anber","address":"inconnu",
    "image":"../../assets/images/R4.jpg", status: "En Construction"}
    ];
    selectedResidenceId: number | null = null;
    showadd(R:Residence)
    { if (R.address== 'inconnu')
       {alert('inconnu');

       }else  this.selectedResidenceId = this.selectedResidenceId === R.id ? null : R.id;
    }
    getStatusIcon(status: string) {
      switch (status) {
        case 'Disponible': return '✅';
        case 'En Construction': return '🚧';
        case 'Vendu': return '❌';
        default: return '';
      } 
    }favorites: Residence[] = [];
    addToFavorites(residence: Residence) {
      if (!this.favorites.includes(residence)) {
        this.favorites.push(residence);
      }
    }
    searchText: string = '';
        get filteredResidences() {
          return this.listResidences.filter(residence =>
            residence.address.toLowerCase().includes(this.searchText.toLowerCase())
          );
        }
}
