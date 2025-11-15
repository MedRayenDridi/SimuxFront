import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Apartment } from 'src/app/core/Models/apartment';

@Component({
  selector: 'app-add-apartment',
  templateUrl: './add-apartment.component.html',
})
export class AddApartmentComponent {
  apartForm: FormGroup;
  newApart!: Apartment;

  constructor(private fb: FormBuilder) {
    this.apartForm = this.fb.group({
      apartNum: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      floorNum: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      surface: ['', Validators.required],
      terrace: [false],
      surfaceterrace: [{ value: '', disabled: true }],
      category: ['', Validators.required],
      residenceId: ['', Validators.required],
    });

    // Enable Surface Terrace if Terrace is checked
    this.apartForm.get('terrace')?.valueChanges.subscribe((checked) => {
      const surfaceTerraceControl = this.apartForm.get('surfaceterrace');
      if (checked) {
        surfaceTerraceControl?.enable();
        surfaceTerraceControl?.setValidators(Validators.required);
      } else {
        surfaceTerraceControl?.disable();
        surfaceTerraceControl?.clearValidators();
      }
      surfaceTerraceControl?.updateValueAndValidity();
    });
  }

  onSubmit() {
    if (this.apartForm.valid) {
      this.newApart = this.apartForm.value as Apartment;
      console.log('New Apartment:', this.newApart);
    }
  }
}
