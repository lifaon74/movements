import { Matrix } from './matrix.class';

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
}

/**
 * A Movement is a set of entangled Moves
 *
 * A ConstrainedMovement normalized its moves to provide easier computing
 */
export class ConstrainedMovement extends ConstrainedMove {

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



  optimizeSpeeds(nextMovement: ConstrainedMovement) {
    // let's compute maximal final speed with maxAcceleration
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

    // console.log(currentMove.finalSpeed, nextMove.initialSpeed);
    // console.log(matrix.toString());
    // console.log(Matrix.getStandardMaximizationProblemSolutions(Matrix.solveStandardMaximizationProblem(matrix)).toString());
  }


  swapSpeeds() {
    let initialSpeed  = this.initialSpeed;
    this.initialSpeed = this.finalSpeed;
    this.finalSpeed   = initialSpeed;
  }

  isNull(): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(this.moves[i].distance !== 0) {
        return false;
      }
    }

    return true;
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

  toString() {
    return this.initialSpeed + ' ' + this.finalSpeed;
  }
}
