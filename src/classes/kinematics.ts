import { Matrix } from './matrix.class';
import { Float } from './float.class';

export abstract class DynamicSequence {

  static sliceTypedArray(typedArray: any, start: number, end: number) {
    if((start < 0) || (end > typedArray.length)) {
      let array = new typedArray.constructor(end - start);
      array.set(typedArray.subarray(Math.max(0, start), Math.min(typedArray.length, end)), Math.abs(start));
      return array;
    } else {
      return typedArray.subarray(start, end);
    }
  }

  public allocated: number;
  public _length: number;


  constructor(size: number = 0) {
    this._length = 0;
    this.allocated = size;
  }

  get length(): number {
    return this._length;
  }

  set length(length: number) {
    this._length = length;
    this.require(length);
  }


  require(size: number): this {
    if(this.allocated < size) {
      this.allocate(size);
    }
    return this;
  }

  allocate(size: number): this {
    this.allocated = size;
    this.transferBuffers();
    return this;
  }

  compact(): this {
    this.allocate(this._length);
    return this;
  }

  protected abstract transferBuffers(): void;

}



export abstract class DynamicSequenceCollection {
  moves: DynamicSequence[] = [];

  constructor() {
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

  require(size: number) {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].require(size);
    }
  }

  allocate(size: number) {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].allocate(size);
    }
  }

  compact() {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].compact();
    }
  }

}



/**
 * Represent a sequence of moves constrained by speed, acceleration and jerk
 */
export class ConstrainedMovesSequence extends DynamicSequence {

  public values: Float64Array;
  public speedLimits: Float64Array;
  public accelerationLimits: Float64Array;
  public jerkLimits: Float64Array;

  constructor(size?: number) {
    super(size);

    this.values             = new Float64Array(this.allocated);
    this.speedLimits        = new Float64Array(this.allocated);
    this.accelerationLimits = new Float64Array(this.allocated);
    this.jerkLimits         = new Float64Array(this.allocated);
  }

  clone() {
    let movesSequence = new ConstrainedMovesSequence();

    movesSequence.values             = new Float64Array(this.values);
    movesSequence.speedLimits        = new Float64Array(this.speedLimits);
    movesSequence.accelerationLimits = new Float64Array(this.accelerationLimits);
    movesSequence.jerkLimits         = new Float64Array(this.jerkLimits);

    movesSequence._length = this._length;
    movesSequence.allocated = this.values.length;

    return movesSequence;
  }

  move(index_0: number, index_1: number) {
    this.values[index_0]              = this.values[index_1];
    this.speedLimits[index_0]         = this.speedLimits[index_1];
    this.accelerationLimits[index_0]  = this.accelerationLimits[index_1];
    this.jerkLimits[index_0]          = this.jerkLimits[index_1];
  }

  toString(index: number = -1, type: string = 'value'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = this.length; i < length; i++) {
        str += this.toString(i, type) + '\n';
      }
      return str;
    } else {
      switch(type) {
        case 'limits':
          return '( ' + this.speedLimits[index] + ', ' + this.accelerationLimits[index] + ', ' + this.jerkLimits[index] + ' )';
        case 'value':
        default:
          return this.values[index].toString();
      }
    }
  }

  protected transferBuffers() {
    this.values             = DynamicSequence.sliceTypedArray(this.values, 0, this.allocated);
    this.speedLimits        = DynamicSequence.sliceTypedArray(this.speedLimits, 0, this.allocated);
    this.accelerationLimits = DynamicSequence.sliceTypedArray(this.accelerationLimits, 0, this.allocated);
    this.jerkLimits         = DynamicSequence.sliceTypedArray(this.jerkLimits, 0, this.allocated);
  }

}


/**
 * Represent an abstract sequence of constrained moves
 * Which have maximum initial and final speeds
 */
export class ConstrainedNormalizedMovesSequence extends DynamicSequence {

  public initialSpeeds: Float64Array;
  public finalSpeeds: Float64Array;
  public speedLimits: Float64Array;
  public accelerationLimits: Float64Array;

  constructor(allocated?: number) {
    super(allocated);

    this.initialSpeeds      = new Float64Array(this.allocated);
    this.finalSpeeds        = new Float64Array(this.allocated);
    this.speedLimits        = new Float64Array(this.allocated);
    this.accelerationLimits = new Float64Array(this.allocated);
  }

  protected transferBuffers() {
    this.initialSpeeds      = DynamicSequence.sliceTypedArray(this.initialSpeeds, 0, this.allocated);
    this.finalSpeeds        = DynamicSequence.sliceTypedArray(this.finalSpeeds, 0, this.allocated);
    this.speedLimits        = DynamicSequence.sliceTypedArray(this.speedLimits, 0, this.allocated);
    this.accelerationLimits = DynamicSequence.sliceTypedArray(this.accelerationLimits, 0, this.allocated);
  }

  toString(index: number = -1, type: string = 'value'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = this.length; i < length; i++) {
        str += this.toString(i, type) + '\n';
      }
      return str;
    } else {
      switch(type) {
        case 'limits':
          return '( ' + this.speedLimits[index] + ', ' + this.accelerationLimits[index] + ' )';
        case 'speed':
        default:
          return '( ' + this.initialSpeeds[index] + ', ' + this.finalSpeeds[index] + ' )';
      }
    }
  }
}



/**
 * A Movement is a set of entangled ConstrainedMovesSequence
 *
 * Its purpose it's to optimize the moves sequence
 */
export class ConstrainedMovementsSequence extends DynamicSequenceCollection {
  static DEFAULT_PRECISION = Float.EPSILON_32;

  constructor(numberOfParallelMoves: number) {
    super();

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new ConstrainedMovesSequence();
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

  optimize(): StepperMovementsSequence {
    let normalizedMovesSequence = this._getNormalizedMovesSequence();
    // console.log(normalizedMovesSequence.toString(-1, 'limits'));

    this._optimizeTransitionSpeedsPass1(normalizedMovesSequence);

    //console.log(normalizedMovesSequence.toString(-1, 'speed'));

    this._optimizeTransitionSpeedsPass2(normalizedMovesSequence);

    // console.log(normalizedMovesSequence.toString(-1, 'speed'));

    return this._decompose(normalizedMovesSequence);
  }

    private _getNormalizedMovesSequence(): ConstrainedNormalizedMovesSequence {
      let movesSequence = new ConstrainedNormalizedMovesSequence();
      movesSequence.length = this.length;

      let move: ConstrainedMovesSequence;
      let speedLimit: number, accelerationLimit: number, value: number;
      for(let i = 0, length = this.length; i < length; i++) {
        move = <ConstrainedMovesSequence>this.moves[0];
        value = Math.abs(move.values[i]);
        speedLimit = move.speedLimits[i] / value;
        accelerationLimit = move.accelerationLimits[i] / value;
        for(let j = 1; j < this.moves.length; j++) {
          move = <ConstrainedMovesSequence>this.moves[j];
          value = Math.abs(move.values[i]);
          speedLimit = Math.min(speedLimit, move.speedLimits[i] / value);
          accelerationLimit = Math.min(accelerationLimit, move.accelerationLimits[i] / value);
        }

        // movesSequence.initialSpeeds[i]       = NaN;
        // movesSequence.finalSpeeds[i]         = NaN;
        movesSequence.speedLimits[i]         = speedLimit;
        movesSequence.accelerationLimits[i]  = accelerationLimit;
      }

      return movesSequence;
    }

    private _optimizeTransitionSpeedsPass1(normalizedMovesSequence: ConstrainedNormalizedMovesSequence) {
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

    private _optimizeTransitionSpeedsPass2(normalizedMovesSequence: ConstrainedNormalizedMovesSequence) {
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
        movesSequence = <ConstrainedMovesSequence>this.moves[i];

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

    private _decompose(normalizedMovesSequence: ConstrainedNormalizedMovesSequence, precision: number = 1e-12): StepperMovementsSequence {
      let stepperMovementsSequence = new StepperMovementsSequence(this.moves.length);
      stepperMovementsSequence.require(normalizedMovesSequence.length * 3);
      let stepperMovementsSequenceLength: number = 0;

      let initialSpeed: number, finalSpeed: number;
      let speedLimit: number, accelerationLimit: number;

      let ta: number, tb: number, t0: number, t1: number, t2: number;
      let v0_max: number;
      let d0: number, d1: number, d2: number;


      for(let i = 0, length = normalizedMovesSequence.length; i < length; i++) {

        initialSpeed = normalizedMovesSequence.initialSpeeds[i];
        finalSpeed = normalizedMovesSequence.finalSpeeds[i];
        speedLimit = normalizedMovesSequence.speedLimits[i];
        accelerationLimit = normalizedMovesSequence.accelerationLimits[i];

        // ta, tb => time to reach junction peak of full acceleration and deceleration
        // ta for acceleration, tb for deceleration
        ta =  (Math.sqrt(
            (initialSpeed * initialSpeed + finalSpeed * finalSpeed) / 2 +
            accelerationLimit /* * this.distance */
          ) - initialSpeed) / accelerationLimit;
        tb = ta + (initialSpeed - finalSpeed) / accelerationLimit;

        // t0, t1, t2 => times of the 3 decomposed moves
        t0 = Math.min(ta, (speedLimit - initialSpeed) / accelerationLimit);
        t2 = Math.min(tb, (speedLimit - finalSpeed) / accelerationLimit);

        // max achieved speed
        v0_max = accelerationLimit * t0 + initialSpeed;
        // v1_max = this.accelerationLimit * t2 + this.finalSpeed;

        // d0, d1, d2 => distances of the 3 decomposed moves
        d0 = 0.5 * accelerationLimit * t0 * t0 + initialSpeed * t0;
        d2 = 0.5 * accelerationLimit * t2 * t2 + finalSpeed * t2;
        d1 = 1 - d0 - d2;

        t1 = d1 / v0_max;


        // console.log('t=>', t0, t1, t2);
        // // console.log('v=>', v0_max, v1_max);
        // console.log('d=>', d0, d1, d2);
        // console.log('--');

        // acceleration
        if(!Float.isNull(t0, precision)) {
          stepperMovementsSequence.times[stepperMovementsSequenceLength] = t0;
          stepperMovementsSequence.initialSpeeds[stepperMovementsSequenceLength] = normalizedMovesSequence.initialSpeeds[i];
          stepperMovementsSequence.accelerations[stepperMovementsSequenceLength] = normalizedMovesSequence.accelerationLimits[i];

          for(let j = 0; j < this.moves.length; j++) {
            stepperMovementsSequence.moves[j].values[stepperMovementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j]).values[i] * d0;
          }

          stepperMovementsSequenceLength++;
        }

        // linear
        if(!Float.isNull(t1, precision)) {
          stepperMovementsSequence.times[stepperMovementsSequenceLength] = t1;
          stepperMovementsSequence.initialSpeeds[stepperMovementsSequenceLength] = v0_max;
          // stepperMovementsSequence.accelerations[stepperMovementsSequenceLength] = 0;

          for(let j = 0; j < this.moves.length; j++) {
            stepperMovementsSequence.moves[j].values[stepperMovementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j]).values[i] * d1;
          }

          stepperMovementsSequenceLength++;
        }

        // deceleration
        if(!Float.isNull(t2, precision)) {
          stepperMovementsSequence.times[stepperMovementsSequenceLength] = t2;
          stepperMovementsSequence.initialSpeeds[stepperMovementsSequenceLength] = v0_max;
          stepperMovementsSequence.accelerations[stepperMovementsSequenceLength] = -normalizedMovesSequence.accelerationLimits[i];

          for(let j = 0; j < this.moves.length; j++) {
            stepperMovementsSequence.moves[j].values[stepperMovementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j]).values[i] * d2;
          }

          stepperMovementsSequenceLength++;
        }

      }


      stepperMovementsSequence.length = stepperMovementsSequenceLength;
      // console.log(stepperMovementsSequence.toString());

      return stepperMovementsSequence;
    }

  // Move the movement at index_1 into the movement at index_0
  move(index_0: number, index_1: number) {
    for(let i = 0; i < this.moves.length; i++) {
      (<ConstrainedMovesSequence>this.moves[i]).move(index_0, index_1);
    }
  }


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
        movesSequence = <ConstrainedMovesSequence>this.moves[i];
        movesSequence.values[index_0] += movesSequence.values[index_1];
        movesSequence.values[index_1] = 0;
      }
      return true;
    }

    return false;
  }



  isNull(index: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(!Float.isNull((<ConstrainedMovesSequence>this.moves[i]).values[index], precision)) {
        return false;
      }
    }
    return true;
  }

  areCollinear(index_0: number, index_1: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    let movesSequence: ConstrainedMovesSequence = <ConstrainedMovesSequence>this.moves[0];
    let value_0: number  = movesSequence.values[index_0];
    let value_1: number = movesSequence.values[index_1];
    let factor: number = value_0 / value_1;
    for(let i = 1; i < this.moves.length; i++) {
      movesSequence = <ConstrainedMovesSequence>this.moves[i];
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
      movesSequence = <ConstrainedMovesSequence>this.moves[i];
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
          return (<ConstrainedMovesSequence[]>this.moves).map((move: ConstrainedMovesSequence) => {
            return move.toString(index, 'value');
          }).join(', ');
        // case 'speeds':
        //   return this.moves.map((move) => { return (move.value * this.initialSpeed) + ' | ' + (move.value * this.finalSpeed); }).join(', ');
        default:
          return '';
      }
    }
  }

}


export class StepperMovesSequence extends DynamicSequence {
  public values: Float64Array;
  public positions: Float64Array;


  constructor(size?: number) {
    super(size);

    this.values     = new Float64Array(this.allocated);
    this.positions  = new Float64Array(this.allocated);
  }


  protected transferBuffers() {
    this.values     = DynamicSequence.sliceTypedArray(this.values, 0, this.allocated);
    this.positions  = DynamicSequence.sliceTypedArray(this.positions, 0, this.allocated);
  }

}


export class StepperMovementsSequence extends DynamicSequence {

  public times: Float64Array;
  public initialSpeeds: Float64Array;
  public accelerations: Float64Array;

  public moves: StepperMovesSequence[] = [];

  constructor(numberOfParallelMoves: number) {
    super();

    this.times          = new Float64Array(this.allocated);
    this.initialSpeeds  = new Float64Array(this.allocated);
    this.accelerations  = new Float64Array(this.allocated);

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new StepperMovesSequence(this.allocated);
    }
  }

  protected transferBuffers() {
    this.times          = DynamicSequence.sliceTypedArray(this.times, 0, this.allocated);
    this.initialSpeeds  = DynamicSequence.sliceTypedArray(this.initialSpeeds, 0, this.allocated);
    this.accelerations  = DynamicSequence.sliceTypedArray(this.accelerations, 0, this.allocated);

    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].require(this.allocated);
    }
  }


  toString(index: number = -1, type: string = 'values'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = Math.min(30, this.length); i < length; i++) {
        str += this.toString(i, type) + '\n----\n';
      }
      return str;
    } else {
      switch(type) {
        case 'values':
          return 'time: ' + this.times[index] + ' => ' +
            this.moves.map((move: StepperMovesSequence) => {
              // return move.toString(index);
              return '{ ' +
                  'value: ' + move.values[index] +
                ', speed: ' + move.values[index] * this.initialSpeeds[index] +
                ', accel: ' + move.values[index] * this.accelerations[index] +
                ' }';
            }).join(', ');
        default:
          return '';
      }
    }
  }

}



export class StepperMovesSequence2 extends DynamicSequence {
  public steps: Float64Array;
  public directions: Uint8Array;
  public initialSpeeds: Float64Array;
  public accelerations: Float64Array;


  constructor() {
    super();

    this.steps          = new Float64Array(this.allocated);
    this.directions     = new Uint8Array(this.allocated);
    this.initialSpeeds  = new Float64Array(this.allocated);
    this.accelerations  = new Float64Array(this.allocated);
  }


  protected transferBuffers() {
    this.steps          = DynamicSequence.sliceTypedArray(this.steps, 0, this.allocated);
    this.directions     = DynamicSequence.sliceTypedArray(this.directions, 0, this.allocated);
    this.initialSpeeds  = DynamicSequence.sliceTypedArray(this.initialSpeeds, 0, this.allocated);
    this.accelerations  = DynamicSequence.sliceTypedArray(this.accelerations, 0, this.allocated);
  }

  toString(index: number = -1): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = this.length; i < length; i++) {
        str += this.toString(i) + '\n';
      }
      return str;
    } else {
      return '{ ' +
          'value: ' + (this.steps[index] * (this.directions[index] ? 1 : -1)) +
          ', speed: ' + this.initialSpeeds[index] +
          ', accel: ' + this.accelerations[index] +
        ' }';
    }
  }

}


export class StepperMovementsSequence2 extends DynamicSequenceCollection {

  times: Float64Array;

  constructor(numberOfParallelMoves: number) {
    super();
    this.times = new Float64Array(0);

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new StepperMovesSequence2();
    }
  }

  toString(index: number = -1, type: string = 'values'): string {
    if(index === -1) {
      let str: string = '';
      for(let i = 0, length = Math.min(30, this.length); i < length; i++) {
        str += this.toString(i, type) + '\n----\n';
      }
      return str;
    } else {
      switch(type) {
        case 'values':
          return 'time: ' + this.times[index] + ' => ' + (<StepperMovesSequence2[]>this.moves).map((move: StepperMovesSequence2) => {
            return move.toString(index);
          }).join(', ');
        default:
          return '';
      }
    }
  }

}



