export class Stepper {
  constructor(public name: string,
              public accelerationLimit: number,
              public speedLimit: number,
              public instantSpeed: number,
              public stepsPerMm: number) {
  }
}


export class StepperMove {
  public direction: number; // 1 or -1
  public steps: number;

  public initialSpeed: number;
  public acceleration: number;

  public stepped: number = 0;


  constructor(public stepper: Stepper,
              value: number) {
    this.value = value;
  }

  get value(): number {
    return this.steps * this.direction;
  }

  set value(value: number) {
    this.steps = Math.abs(value);
    this.direction = Math.sign(value) || 1;
  }




  // test

  computeLimitSpeeds() {
    // this.startSpeed = this.stepper.instantSpeed;
    // this.endSpeed = this.startSpeed * t + 0.5 * this.acceleration * t * t;
  }


  /**
   * Compute distance according to time
   */
  computeSteps(time: number): number {
    return 0.5 * this.acceleration * time * time + this.initialSpeed * time;
  }


  computeAccelerationTime(): number { // time to reach maximum initialSpeed
    if(this.acceleration === 0) {
      return 0;
    } else {
      return Math.min(
        this.initialSpeed / this.acceleration,
        Math.sqrt(this.steps / this.acceleration)
      );
    }
  }

  getMovement() {
    let t = this.computeAccelerationTime();
    let d = (this.acceleration / 2) * t * t;
    let dv = this.steps - (d * 2);
    let tv = (this.initialSpeed === 0) ? 0 : (dv / this.initialSpeed);

    // console.log(this.value / this.initialSpeed);
    // console.log(t, d, dv, tv);
    return [
      [d * this.direction, t],
      [dv * this.direction, tv],
      [d * this.direction, t]
    ];
  }


  toString(): string {
    return this.stepper.name + ': ' + this.value;
  }
}