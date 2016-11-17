export class Stepper {
  constructor(public name: string,
              public accelerationLimit: number,
              public speedLimit: number,
              public jerkLimit: number,
              public stepsPerMm: number) {
  }
}


export class StepperMove {

  public direction: number; // 1 or -1
  public steps: number;

  public initialSpeed: number;
  public acceleration: number;

  public stepped: number = 0;


  constructor() {
  }

  get value(): number {
    return this.steps * this.direction;
  }

  set value(value: number) {
    this.steps = Math.abs(value);
    this.direction = Math.sign(value) || 1;
  }

  toString(): string {
    return '{ d: ' + this.value + ', v: ' + this.initialSpeed + ', a: ' + this.acceleration + ' }';
  }
}


export class StepperMovement {
  constructor(public moves: StepperMove[] = []) {
  }

  ended(): boolean {
    for(let i = 0, l = this.moves.length; i < l; i++) {
      if(this.moves[i].stepped < this.moves[i].steps) {
        return false;
      }
    }
    return true;
  }

  tick(time: number): number {
    let accelerationFactor: number = 0.5 * time * time;
    let move: StepperMove;
    let stepsByte: number = 0 | 0;
    for(let i = 0, length = this.moves.length; i < length; i++) {
      move = this.moves[i];
      let steps = Math.min(move.steps, Math.round(move.acceleration * accelerationFactor + move.initialSpeed * time));
      let deltaSteps = (steps - move.stepped) ? 1 : 0;
      stepsByte |= deltaSteps << i;
      move.stepped += deltaSteps;
    }

    return stepsByte;
  }

  toString(): string {
    return this.moves.map((move) => { return move.toString(); }).join(', ');
  }
}

