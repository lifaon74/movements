export class Stepper {
  constructor(public name: string,
              public channel: number,
              public homingMinChannel: number,
              public homingMaxChannel: number,
              public accelerationLimit: number,
              public speedLimit: number,
              public jerkLimit: number,
              public stepsPerMm: number) {
  }
}


