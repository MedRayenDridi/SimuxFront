import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

@Component({
  selector: 'app-add-residence',
  templateUrl: './add-residence.component.html',
})
export class AddResidenceComponent {
  residenceForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.residenceForm = this.fb.group({
      id: [''],
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', Validators.required],
      image: ['', [Validators.required]],
      status: ['Disponible', Validators.required],
      apartments: this.fb.array([]),
    });
  }

  get apartments(): FormArray {
    return this.residenceForm.get('apartments') as FormArray;
  }

  addApartment() {
    this.apartments.push(
      this.fb.group({
        apartmentNumber: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
        floorNumber: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      })
    );
  }

  removeApartment(index: number) {
    this.apartments.removeAt(index);
  }

  onSubmit() {
    if (this.residenceForm.valid) {
      console.log('New Residence:', this.residenceForm.value);
    }
  }
}
