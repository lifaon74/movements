import { StepperMove } from './stepper';
import { TransitionMove } from './transitionMove';


export class Movement {
  constructor(public moves: StepperMove[] = []) { // public moves:{ [key:string]:StepperMove }
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
    let accelerationFactor: number = time * time * 0.5;
    let move: StepperMove;
    let stepsByte: number = 0 | 0;
    for(let i = 0, l = this.moves.length; i < l; i++) {
      move = this.moves[i];
      // console.log(move);
      let steps = Math.min(move.steps, Math.round(move.acceleration * accelerationFactor + move.initialSpeed * time));
      let deltaSteps = (steps - move.stepped) ? 1 : 0;
      stepsByte |= deltaSteps << i;
      move.stepped += deltaSteps;
    }

    // console.log(stepsByte.toString(2));
    return stepsByte;
  }

  // test

  getTransitionMove() {
    return new TransitionMove(this.moves);
  }



  convertMovement() {
    this.getTransitionMove();
    for(let move of this.moves) {
      // console.log(move);
      console.log(move.getMovement());
    }
    // console.log(movement.moves);
  }

  toString() {
    return this.moves.map((move: StepperMove) => move.toString()).join(', ');
  }
}