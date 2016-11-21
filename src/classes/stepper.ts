export class Stepper {
  constructor(public name: string,
              public accelerationLimit: number,
              public speedLimit: number,
              public jerkLimit: number,
              public stepsPerMm: number) {
  }
}


