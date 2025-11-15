import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Residence } from 'src/app/core/Models/residence';

@Component({
  selector: 'app-residences-details',
  templateUrl: './residences-details.component.html',
  styleUrls: ['./residences-details.component.css'],
})
export class ResidencesDetailsComponent {
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
  //hook
constructor(private actR:ActivatedRoute){ }
id!: number;
//r!: Residence
ngOnInit()  {
  // 1er methode 
  this.id = this.actR.snapshot.params['param']
  //2eme methode
   //this.actR.paramMap.subscribe(data => this.id=data.get("id"))
   // paramMap represente l'observable retourne data ou erreur
   // paramMap represente l'observable retourne data ou erreur
   //this.listResidences.find(r=> r.id == this.id);
}
residence:Residence=new Residence();
}
