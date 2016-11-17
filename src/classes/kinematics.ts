import { Matrix } from './matrix.class';
import { Float } from './float.class';
import { StepperMovement, StepperMove } from './stepper';

/**
 * Represent a move constrained by speed and acceleration
 * Which have maximum initial and final speeds
 */
export class ConstrainedMove {

  public direction: number; // 1 or -1
  public distance: number;

  public initialSpeed: number = null;
  public finalSpeed: number = null;

  public speedLimit: number;
  public accelerationLimit: number;
  public jerkLimit: number;

  constructor() {
  }

  get value(): number {
    return this.distance * this.direction;
  }

  set value(value: number) {
    this.distance = Math.abs(value);
    this.direction = Math.sign(value) || 1;
  }

  /**
   * Compute distance according to time
   */
  computeDistance(time: number): number {
    return 0.5 * this.accelerationLimit * time * time + this.initialSpeed * time;
  }

  clone(): ConstrainedMove {
    let move: ConstrainedMove = new ConstrainedMove();
    move.direction          = this.direction;
    move.distance           = this.distance;
    move.initialSpeed       = this.initialSpeed;
    move.finalSpeed         = this.finalSpeed;
    move.speedLimit         = this.speedLimit;
    move.accelerationLimit  = this.accelerationLimit;
    move.jerkLimit          = this.jerkLimit;
    return move;
  }

  toString(type: string = 'value'): string {
    switch(type) {
      case 'speed':
        return this.initialSpeed + ' ' + this.finalSpeed;
      case 'value':
      default:
        return this.value.toString();
    }

  }
}


/**
 * A Movement is a set of entangled Moves
 *
 * A ConstrainedMovement normalizes its moves to provide easier computing
 */
export class ConstrainedMovement extends ConstrainedMove {

  /**
   * Build the maximization matrix which links 2 ConstrainedMove
   * @param movement_0
   * @param movement_1
   * @returns {Matrix}
   */
  static getMaximizationMatrix(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement): Matrix {
    // 2 per axes
    // + 2 for max values
    // + 1 for maximization
    let rowsNumber: number = movement_0.moves.length * 2 + 2 + 1;

    // D[i][0] * Ve - D[i][1] * Vi < J[i] => 3 columns
    let matrix = new Matrix(rowsNumber, 3 + rowsNumber - 1);

    let move_0: ConstrainedMove, move_1: ConstrainedMove;
    let row: number = 0;

    let col_1: number = matrix.m;
    let col_last: number = (matrix.n - 1) * matrix.m;
    let jerkLimit: number;

    for(let i = 0; i < movement_0.moves.length; i++) {
      move_0 = movement_0.moves[i];
      move_1 = movement_1.moves[i];

      jerkLimit = Math.min(move_0.jerkLimit, move_1.jerkLimit); //  * move_0.direction  * move_1.direction

      matrix.values[row] = move_0.value;
      matrix.values[row + col_1] = -move_1.value;
      matrix.values[row + col_last] = jerkLimit;
      row++;

      matrix.values[row] = -move_0.value;
      matrix.values[row + col_1] = move_1.value;
      matrix.values[row + col_last] = jerkLimit;
      row++;
    }


    matrix.values[row] = 1;
    // matrix.values[row + col_1] = 0;
    matrix.values[row + col_last] = movement_0.finalSpeed;
    row++;

    // matrix.values[row] = 0;
    matrix.values[row + col_1] = 1;
    matrix.values[row + col_last] = Math.min(movement_1.speedLimit, movement_0.finalSpeed);
    row++;

    matrix.values[row] = -1;
    matrix.values[row + col_1] = -1;

    for(let m = 0; m < matrix.m - 1; m++) {
      matrix.values[m + (m + 2) * matrix.m] = 1;
    }

    return matrix;
  }

  /**
   * Check if 2 ConstrainedMove are collinear (same direction and collinear moves)
   * @param movement_0
   * @param movement_1
   * @param precision
   * @returns {boolean}
   */
  static areCorrelated(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement, precision: number = Float.EPSILON_32): boolean {
    let move_0: ConstrainedMove = movement_0.moves[0], move_1: ConstrainedMove = movement_1.moves[0];
    let factor: number = move_0.value / move_1.value;

    for(let i = 1; i < movement_0.moves.length; i++) {
      move_0 = movement_0.moves[i];
      move_1 = movement_1.moves[i];

      if(
        (move_0.direction !== move_1.direction) ||
        !Float.equals(factor, move_0.value / move_1.value, precision)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if 2 ConstrainedMove are correlated and have the same constraints
   * @param movement_0
   * @param movement_1
   * @param precision
   * @returns {boolean}
   */
  static areStronglyCorrelated(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement, precision: number = Float.EPSILON_32): boolean {
    if(!ConstrainedMovement.areCorrelated(movement_0, movement_1, precision)) {
      return false;
    }

    let move_0: ConstrainedMove, move_1: ConstrainedMove;
    for(let i = 0; i < movement_0.moves.length; i++) {
      move_0 = movement_0.moves[i];
      move_1 = movement_1.moves[i];

      if(
        !Float.equals(move_0.speedLimit, move_1.speedLimit, precision) ||
        !Float.equals(move_0.accelerationLimit, move_1.accelerationLimit, precision) ||
        !Float.equals(move_0.jerkLimit, move_1.jerkLimit, precision)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Merge 2 correlated ConstrainedMove as 1
   * @param movement_0
   * @param movement_1
   * @returns {ConstrainedMovement}
   */
  static merge(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement): ConstrainedMovement {
    let moves: ConstrainedMove[] = [];
    let move_0: ConstrainedMove;
    let mergeMove: ConstrainedMove;
    for(let j = 0; j < movement_0.moves.length; j++) {
      move_0 = movement_0.moves[j];

      mergeMove = new ConstrainedMove();
      mergeMove.speedLimit         = move_0.speedLimit;
      mergeMove.accelerationLimit  = move_0.accelerationLimit;
      mergeMove.jerkLimit          = move_0.jerkLimit;
      mergeMove.value              = move_0.value + movement_1.moves[j].value;

      moves.push(mergeMove);
    }

    return new ConstrainedMovement(moves);
  }



  constructor(public moves: ConstrainedMove[]) {
    super();

    this.speedLimit         = this.getNormalizedSpeedLimit();
    this.accelerationLimit  = this.getNormalizedAccelerationLimit();
  }

  getNormalizedSpeedLimit(): number {
    let move: ConstrainedMove = this.moves[0];
    let speedLimit: number = move.speedLimit / move.distance;
    for(let i = 1; i < this.moves.length; i++) {
      move = this.moves[i];
      speedLimit = Math.min(speedLimit, move.speedLimit / move.distance);
    }
    return speedLimit;
  }

  getNormalizedAccelerationLimit(): number {
    let move: ConstrainedMove = this.moves[0];
    let accelerationLimit: number = move.accelerationLimit / move.distance;
    for(let i = 1; i < this.moves.length; i++) {
      move = this.moves[i];
      accelerationLimit = Math.min(accelerationLimit, move.accelerationLimit / move.distance);
    }
    return accelerationLimit;
  }

  /**
   * Return true if the movement is null (its distance equals 0)
   * @param precision
   * @returns {boolean}
   */
  isNull(precision: number = Float.EPSILON_32): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(!Float.isNull(this.moves[i].distance, precision)) {
        return false;
      }
    }
    return true;
  }

  optimizeTransitionSpeeds(nextMovement: ConstrainedMovement) {
    let finalSpeed = this.getFinalMaximumSpeed();
    
    if(this.finalSpeed === null) {
      this.finalSpeed = finalSpeed;
    } else {
      this.finalSpeed = Math.min(this.finalSpeed, finalSpeed);
    }

    let matrix: Matrix = ConstrainedMovement.getMaximizationMatrix(this, nextMovement);
    let solutions: Matrix = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

    this.finalSpeed = solutions.values[0];
    nextMovement.initialSpeed = solutions.values[1];

    // nextMovement.initialSpeed = this.finalSpeed;

    // console.log(this.finalSpeed, nextMove.initialSpeed);
    // console.log(matrix.toString());
  }


  swapTransitionSpeeds() {
    let initialSpeed  = this.initialSpeed;
    this.initialSpeed = this.finalSpeed;
    this.finalSpeed   = initialSpeed;
  }


  /**
   * Split this movement into optimized movements (full acceleration, constant speed and full deceleration)
   * t0, t2, t1
   * d0, d2, d1
   */
  decomposeToStepperMovements(movements: StepperMovement[]) {
    let precision: number = 1e-12;

    // compute time to reach the highest speed (not limited to speedLimit),
    // according to the accelerationLimit
    let ta =  (Math.sqrt(
      (this.initialSpeed * this.initialSpeed + this.finalSpeed * this.finalSpeed) / 2 +
      this.accelerationLimit /* * this.distance */
    ) - this.initialSpeed) / this.accelerationLimit;
    let tb = ta + (this.initialSpeed - this.finalSpeed) / this.accelerationLimit;

    let t0 = Math.min(ta, (this.speedLimit - this.initialSpeed) / this.accelerationLimit);
    let t1 = Math.min(tb, (this.speedLimit - this.finalSpeed) / this.accelerationLimit);

    let v0_max = this.accelerationLimit * t0 + this.initialSpeed;
    // let v1_max = this.accelerationLimit * t1 + this.finalSpeed;

    let d0 = 0.5 * this.accelerationLimit * t0 * t0 + this.initialSpeed * t0;
    let d1 = 0.5 * this.accelerationLimit * t1 * t1 + this.finalSpeed * t1;
    let d2 = 1 - d0 - d1;

    let t2 = d2 / v0_max;


    // console.log('t=>', t0, t1, t2);
    // console.log('v=>', v0_max, v1_max);
    //
    // console.log('d=>', d0, d1, d2);
    // console.log('--');


    let stepperAccelerationMovement: StepperMovement = null;
    let stepperLinearMovement: StepperMovement = null;
    let stepperDecelerationMovement: StepperMovement = null;
    let stepperMove: StepperMove;
    let move: ConstrainedMove;

      // acceleration
    if(!Float.isNull(t0, precision)) {
      stepperAccelerationMovement = new StepperMovement();

      for(let move of this.moves) {
        stepperMove = new StepperMove();

        stepperMove.steps         = Math.round(move.distance * d0);
        stepperMove.direction     = move.direction;
        stepperMove.acceleration  = this.accelerationLimit * move.distance;
        stepperMove.initialSpeed  = this.initialSpeed * move.distance;

        stepperAccelerationMovement.moves.push(stepperMove);
      }
    }

      // deceleration
    if(!Float.isNull(t1, precision)) {
      stepperDecelerationMovement = new StepperMovement();

      for(let move of this.moves) {
        stepperMove = new StepperMove();

        stepperMove.steps         = Math.round(move.distance * d1);
        stepperMove.direction     = move.direction;
        stepperMove.acceleration  = -this.accelerationLimit * move.distance;
        stepperMove.initialSpeed  = v0_max * move.distance;

        stepperDecelerationMovement.moves.push(stepperMove);
      }
    }

    // linear
    if(!Float.isNull(t2, precision)) {
      stepperLinearMovement = new StepperMovement();

      for(let i = 0; i < this.moves.length; i++) {
        move = this.moves[i];

        stepperMove = new StepperMove();

        stepperMove.steps = Math.round(move.distance);

        if(stepperAccelerationMovement) {
          stepperMove.steps -= stepperAccelerationMovement.moves[i].steps;
        }

        if(stepperDecelerationMovement) {
          stepperMove.steps -= stepperDecelerationMovement.moves[i].steps;
        }

        // stepperMove.steps         = Math.round(move.distance * d2);
        stepperMove.direction     = move.direction;
        stepperMove.acceleration  = 0;
        stepperMove.initialSpeed  = v0_max * move.distance;

        stepperLinearMovement.moves.push(stepperMove);
      }
    }


    if(stepperAccelerationMovement) movements.push(stepperAccelerationMovement);
    if(stepperLinearMovement) movements.push(stepperLinearMovement);
    if(stepperDecelerationMovement) movements.push(stepperDecelerationMovement);

  }



  /**
   * Compute and return the best reachable final speed constrained by own limits
   * @returns {number}
   */
  getFinalMaximumSpeed(): number {
    return Math.min(
      this.speedLimit,
      (this.accelerationLimit === 0) ?
        this.initialSpeed : Math.sqrt(this.initialSpeed * this.initialSpeed + 2 * this.accelerationLimit)
    );
  }

  toString(type: string = 'values'): string {
    switch(type) {
      case 'values':
        return this.moves.map((move) => { return move.toString('value'); }).join(', ');
      case 'speeds':
        return this.moves.map((move) => { return (move.value * this.initialSpeed) + ' | ' + (move.value * this.finalSpeed); }).join(', ');
      default:
        return super.toString(type);
    }
  }

}




