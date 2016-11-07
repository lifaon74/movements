import { StepperMove } from './stepper';

export class TransitionMove {

  public initialSpeed: number = 0;
  public finalSpeed: number = 0;
  public acceleration: number = 0;

  public speedLimit: number;
  public accelerationLimit: number;

  constructor(public moves: StepperMove[]) {
    this.speedLimit = Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.speedLimit / move.steps; // m/s / m => s^-1
    }));

    this.accelerationLimit = Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.accelerationLimit / move.steps; // m/s^-2 / m => s^-2
    }));
  }
}
