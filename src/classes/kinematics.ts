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

  static DEFAULT_PRECISION = Float.EPSILON_32;

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
  static areCollinear(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement, precision: number = ConstrainedMovement.DEFAULT_PRECISION): boolean {
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
   * Check if 2 ConstrainedMove are collinear and have the same constraints
   * @param movement_0
   * @param movement_1
   * @param precision
   * @returns {boolean}
   */
  static areCorrelated(movement_0: ConstrainedMovement, movement_1: ConstrainedMovement, precision: number = ConstrainedMovement.DEFAULT_PRECISION): boolean {
    if(!ConstrainedMovement.areCollinear(movement_0, movement_1, precision)) {
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
  isNull(precision: number = ConstrainedMovement.DEFAULT_PRECISION): boolean {
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
  decomposeToStepperMovements(movements: StepperMovement[], precision: number = 1e-12) {

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


export class ConstrainedMovesSequence {

  public values: Float64Array;
  public initialSpeeds: Float64Array;
  public finalSpeeds: Float64Array;

  public speedLimits: Float64Array;
  public accelerationLimits: Float64Array;
  public jerkLimits: Float64Array;


  public _length: number;
  public _allocated: number;

  constructor(allocated: number = 0) {
    this.values             = new Float64Array(allocated);
    this.initialSpeeds      = new Float64Array(allocated);
    this.finalSpeeds        = new Float64Array(allocated);
    this.speedLimits        = new Float64Array(allocated);
    this.accelerationLimits = new Float64Array(allocated);
    this.jerkLimits         = new Float64Array(allocated);

    this._length = 0;
    this._allocated = allocated;
  }

  get length(): number {
    return this._length;
  }

  set length(length: number) {
    this.allocated = length;
    this._length = length;
  }

  get allocated(): number {
    return this._allocated;
  }

  set allocated(allocated: number) {
    if(this._allocated < allocated) {
      this._allocated = allocated;
      this.transferBuffers();
    }
  }


  clone() {
    let movesSequence = new ConstrainedMovesSequence();

    movesSequence.values             = new Float64Array(this.values);
    movesSequence.initialSpeeds      = new Float64Array(this.initialSpeeds);
    movesSequence.finalSpeeds        = new Float64Array(this.finalSpeeds);
    movesSequence.speedLimits        = new Float64Array(this.speedLimits);
    movesSequence.accelerationLimits = new Float64Array(this.accelerationLimits);
    movesSequence.jerkLimits         = new Float64Array(this.jerkLimits);

    movesSequence._length = this._length;
    movesSequence._allocated = this.values.length;

    return movesSequence;
  }

  move(index_0: number, index_1: number) {
    this.values[index_0]              = this.values[index_1];
    this.initialSpeeds[index_0]       = this.initialSpeeds[index_1];
    this.finalSpeeds[index_0]         = this.finalSpeeds[index_1];
    this.speedLimits[index_0]         = this.speedLimits[index_1];
    this.accelerationLimits[index_0]  = this.accelerationLimits[index_1];
    this.jerkLimits[index_0]          = this.jerkLimits[index_1];
  }

  // transfer(targetConstrainedMovesSequence: ConstrainedMovesSequence, targetIndex: number, originIndex: number) {
  //   targetConstrainedMovesSequence.values[targetIndex]              = this.values[originIndex];
  //   targetConstrainedMovesSequence.initialSpeeds[targetIndex]       = this.initialSpeeds[originIndex];
  //   targetConstrainedMovesSequence.finalSpeeds[targetIndex]         = this.finalSpeeds[originIndex];
  //   targetConstrainedMovesSequence.speedLimits[targetIndex]         = this.speedLimits[originIndex];
  //   targetConstrainedMovesSequence.accelerationLimits[targetIndex]  = this.accelerationLimits[originIndex];
  //   targetConstrainedMovesSequence.jerkLimits[targetIndex]          = this.jerkLimits[originIndex];
  // }


  toString(index: number = -1, type: string = 'value'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = this.length; i < length; i++) {
        str += this.toString(i, type) + '\n';
      }
      return str;
    } else {
      switch(type) {
        case 'speed':
          return '( ' + this.initialSpeeds[index] + ', ' + this.finalSpeeds[index] + ' )';
        case 'limits':
          return '( ' + this.speedLimits[index] + ', ' + this.accelerationLimits[index] + ', ' + this.jerkLimits[index] + ' )';
        case 'value':
        default:
          return this.values[index].toString();
      }
    }
  }

  private transferBuffers() {
    let buffer: Float64Array;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.values);
    this.values = buffer;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.initialSpeeds);
    this.initialSpeeds = buffer;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.finalSpeeds);
    this.finalSpeeds = buffer;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.speedLimits);
    this.speedLimits = buffer;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.accelerationLimits);
    this.accelerationLimits = buffer;

    buffer = new Float64Array(this._allocated);
    buffer.set(this.jerkLimits);
    this.jerkLimits = buffer;
  }

}


export class ConstrainedMovementsSequence {
  static DEFAULT_PRECISION = Float.EPSILON_32;

  moves: ConstrainedMovesSequence[] = [];

  constructor(numberOfParallelMoves: number) {
    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new ConstrainedMovesSequence();
    }
  }

  get length(): number {
    return this.moves[0].length;
  }

  set length(length: number) {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].length = length;
    }
  }

  get allocated(): number {
    return this.moves[0].allocated;
  }

  set allocated(allocated: number) {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].allocated = allocated;
    }
  }

  /**
   * Remove unnecessary movements
   */
  reduce() {
    let length: number = this.length;
    if(length === 1) {
      if(this.isNull(0)) {
        this.length = 0;
      }
    } else {
      let readIndex: number = 1;
      let writeIndex: number = 0;
      for(; readIndex < length; readIndex++) {
        if(!this.merge(writeIndex, readIndex)) {
          writeIndex++;
          if(writeIndex !== readIndex) {
            this.move(writeIndex, readIndex);
          }
        }
      }

      this.length = writeIndex + 1;
    }
  }


  optimizeTransitionSpeeds() {
    let normalizedMovesSequence = this._getNormalizedMovesSequence();
    // console.log(normalizedMovesSequence.toString(-1, 'limits'));

    this._optimizeTransitionSpeedsPass1(normalizedMovesSequence);

    //console.log(normalizedMovesSequence.toString(-1, 'speed'));

    this._optimizeTransitionSpeedsPass2(normalizedMovesSequence);

    console.log(normalizedMovesSequence.toString(-1, 'speed'));
  }

    private _getNormalizedMovesSequence(): ConstrainedMovesSequence {
      let movesSequence = new ConstrainedMovesSequence();
      movesSequence.length = this.length;

      let move: ConstrainedMovesSequence;
      let speedLimit: number, accelerationLimit: number, value: number;
      for(let i = 0, length = this.length; i < length; i++) {
        move = this.moves[0];
        value = Math.abs(move.values[i]);
        speedLimit = move.speedLimits[i] / value;
        accelerationLimit = move.accelerationLimits[i] / value;
        for(let j = 1; j < this.moves.length; j++) {
          move = this.moves[j];
          value = Math.abs(move.values[i]);
          speedLimit = Math.min(speedLimit, move.speedLimits[i] / value);
          accelerationLimit = Math.min(accelerationLimit, move.accelerationLimits[i] / value);
        }

        // movesSequence.values[i]              = 1;
        // movesSequence.initialSpeeds[i]       = NaN;
        // movesSequence.finalSpeeds[i]         = NaN;
        movesSequence.speedLimits[i]         = speedLimit;
        movesSequence.accelerationLimits[i]  = accelerationLimit;
        // movesSequence.jerkLimits[i]          = 0;
      }

      return movesSequence;
    }

    private _optimizeTransitionSpeedsPass1(normalizedMovesSequence: ConstrainedMovesSequence) {
      let initialSpeed: number;
      let accelerationLimit: number;
      let finalSpeedLimit: number;

      let matrix: Matrix;
      let solutions: Matrix;
      let i: number = 0;
      normalizedMovesSequence.initialSpeeds[i] = 0;
      for(let length = normalizedMovesSequence.length - 1; i < length; i++) {
        initialSpeed = normalizedMovesSequence.initialSpeeds[i];
        accelerationLimit = normalizedMovesSequence.accelerationLimits[i];

        // compute final speed limit according to accelerationLimit and speedLimit
        finalSpeedLimit = Math.min(
          normalizedMovesSequence.speedLimits[i],
          (accelerationLimit === 0) ?
            initialSpeed : Math.sqrt(initialSpeed * initialSpeed + 2 * accelerationLimit)
        );

        // build the maximization matrix
        matrix = this._getMaximizationMatrix(
          i, i + 1,
          finalSpeedLimit, Math.min(finalSpeedLimit, normalizedMovesSequence.speedLimits[i + 1])
        );
        // get max final and initial speeds
        solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

        normalizedMovesSequence.finalSpeeds[i]        = solutions.values[0];
        normalizedMovesSequence.initialSpeeds[i + 1]  = solutions.values[1];
      }
    }

    private _optimizeTransitionSpeedsPass2(normalizedMovesSequence: ConstrainedMovesSequence) {
      let finalSpeed: number;
      let accelerationLimit: number;
      let initialSpeedLimit: number;

      let matrix: Matrix;
      let solutions: Matrix;
      let i: number = normalizedMovesSequence.length - 1;
      normalizedMovesSequence.finalSpeeds[i] = 0;
      for(; i > 0; i--) {
        finalSpeed = normalizedMovesSequence.finalSpeeds[i];
        accelerationLimit = normalizedMovesSequence.accelerationLimits[i];

        // compute initial speed limit according to accelerationLimit and speedLimit
        initialSpeedLimit = Math.min(
          normalizedMovesSequence.speedLimits[i],
          (accelerationLimit === 0) ?
            finalSpeed : Math.sqrt(finalSpeed * finalSpeed + 2 * accelerationLimit)
        );

        // build the maximization matrix
        matrix = this._getMaximizationMatrix(
          i - 1, i,
          Math.min(initialSpeedLimit, normalizedMovesSequence.finalSpeeds[i - 1]), initialSpeedLimit
        );
        // get max final and initial speeds
        solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

        normalizedMovesSequence.finalSpeeds[i - 1]  = solutions.values[0];
        normalizedMovesSequence.initialSpeeds[i]    = solutions.values[1];
      }
    }

    // Build the maximization matrix which links 2 ConstrainedMove
    private _getMaximizationMatrix(index_0: number, index_1: number, finalSpeedLimit: number, initialSpeedLimit: number): Matrix {
      // 2 per axes
      // + 2 for max values
      // + 1 for maximization
      let rowsNumber: number = this.moves.length * 2 + 2 + 1;

      // D[i][0] * Ve - D[i][1] * Vi < J[i] => 3 columns
      let matrix = new Matrix(rowsNumber, 3 + rowsNumber - 1);

      let movesSequence: ConstrainedMovesSequence;
      let row: number = 0;

      let col_1: number = matrix.m;
      let col_last: number = (matrix.n - 1) * matrix.m;
      let jerkLimit: number;
      let value_0: number, value_1: number;

      for(let i = 0; i < this.moves.length; i++) {
        movesSequence = this.moves[i];

        jerkLimit = Math.min(movesSequence.jerkLimits[index_0], movesSequence.jerkLimits[index_1]); //  * move_0.direction  * move_1.direction

        value_0 = movesSequence.values[index_0];
        value_1 = movesSequence.values[index_1];

        matrix.values[row] = value_0;
        matrix.values[row + col_1] = -value_1;
        matrix.values[row + col_last] = jerkLimit;
        row++;

        matrix.values[row] = -value_0;
        matrix.values[row + col_1] = value_1;
        matrix.values[row + col_last] = jerkLimit;
        row++;
      }

      matrix.values[row] = 1;
      // matrix.values[row + col_1] = 0;
      matrix.values[row + col_last] = finalSpeedLimit;
      row++;

      // matrix.values[row] = 0;
      matrix.values[row + col_1] = 1;
      matrix.values[row + col_last] = initialSpeedLimit;
      row++;

      matrix.values[row] = -1;
      matrix.values[row + col_1] = -1;

      for(let m = 0; m < matrix.m - 1; m++) {
        matrix.values[m + (m + 2) * matrix.m] = 1;
      }

      return matrix;
    }



  // Move the movement at index_1 into the movement at index_0
  move(index_0: number, index_1: number) {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].move(index_0, index_1);
    }
  }

  // transfer(targetConstrainedMovementsSequence: ConstrainedMovementsSequence, targetIndex: number, originIndex: number) {
  //   for(let i = 0; i < this.moves.length; i++) {
  //     this.moves[i].transfer(targetConstrainedMovementsSequence.moves[i], targetIndex, originIndex);
  //   }
  // }

  /**
   * Try to merge two movements,
   * can only append if both movements are collinear and have the same limits
   *
   * @param index_0 movement_0 where de merge will occur
   * @param index_1 movement_1 to remove if mergeable
   * @param precision
   * @returns {boolean}
   */
  merge(index_0: number, index_1: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    if(this.isNull(index_0)) {
      this.move(index_0, index_1);
      return true;
    }

    if(this.isNull(index_1)) {
      return true;
    }

    if(this.areCorrelated(index_0, index_1, precision)) {
      let movesSequence: ConstrainedMovesSequence;
      for(let i = 0; i < this.moves.length; i++) {
        movesSequence = this.moves[i];
        movesSequence.values[index_0] += movesSequence.values[index_1];
        movesSequence.values[index_1] = 0;
      }
      return true;
    }

    return false;
  }



  isNull(index: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(!Float.isNull(this.moves[i].values[index], precision)) {
        return false;
      }
    }
    return true;
  }

  areCollinear(index_0: number, index_1: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    let movesSequence: ConstrainedMovesSequence = this.moves[0];
    let value_0: number  = movesSequence.values[index_0];
    let value_1: number = movesSequence.values[index_1];
    let factor: number = value_0 / value_1;
    for(let i = 1; i < this.moves.length; i++) {
      movesSequence = this.moves[i];
      value_0 = movesSequence.values[index_0];
      value_1 = movesSequence.values[index_1];
      if(
        (Math.sign(value_0) !== Math.sign(value_1)) ||
        !Float.equals(factor, value_0 / value_1, precision)
      ) {
        return false;
      }
    }
    return true;
  }

  areCorrelated(index_0: number, index_1: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    if(!this.areCollinear(index_0, index_1, precision)) {
      return false;
    }

    let movesSequence: ConstrainedMovesSequence;
    for(let i = 0; i < this.moves.length; i++) {
      movesSequence = this.moves[i];
      if(
        !Float.equals(movesSequence.speedLimits[index_0], movesSequence.speedLimits[index_1], precision) ||
        !Float.equals(movesSequence.accelerationLimits[index_0], movesSequence.accelerationLimits[index_1], precision) ||
        !Float.equals(movesSequence.jerkLimits[index_0], movesSequence.jerkLimits[index_1], precision)
      ) {
        return false;
      }
    }

    return true;
  }


  toString(index: number = -1, type: string = 'values'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = this.length; i < length; i++) {
        str += this.toString(i, type) + '\n';
      }
      return str;
    } else {
      switch(type) {
        case 'values':
          return this.moves.map((move) => { return move.toString(index, 'value'); }).join(', ');
        // case 'speeds':
        //   return this.moves.map((move) => { return (move.value * this.initialSpeed) + ' | ' + (move.value * this.finalSpeed); }).join(', ');
        default:
          return '';
        // return super.toString(type);
      }
    }
  }

}




