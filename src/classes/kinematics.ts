import { Matrix } from './matrix.class';
import { Float } from './float.class';

interface ArrayBufferView {
  [index: number]: number;
  length: number;
  buffer: ArrayBuffer;
}

export interface ArrayBufferViewConstructor {
  new (size: number): ArrayBufferView;
}

export class DynamicSequence {

  static sliceTypedArray(typedArray: any, start: number, end: number, copy: boolean = true) {
    if((start < 0) || (end > typedArray.length)) {
      let array = new typedArray.constructor(end - start);
      array.set(typedArray.subarray(Math.max(0, start), Math.min(typedArray.length, end)), Math.abs(start));
      return array;
    } else {
      return copy ? typedArray.slice(start, end) : typedArray.subarray(start, end);
    }
  }

  static roundFloatArray(source: Float32Array | Float64Array, destination: ArrayBufferView = source) {
    let value: number = 0;
    let roundedValue: number = 0;
    let delta: number;

    for(let i = 0; i < source.length; i++) {
      value += source[i];
      delta = Math.round(value - roundedValue);
      roundedValue += delta;
      destination[i] = delta;
    }
  }

  public _buffers: { [key: string]: ArrayBufferView };
  public _allocated: number;
  public _length: number;

  constructor(allocated: number = 0, buffers: { [key: string]: ArrayBufferViewConstructor } = {}) {
    this._buffers  = {};
    this._allocated   = allocated;
    this._length      = 0;

    for(const key in buffers) {
      this.createBuffer(key, new (buffers[key])(this._allocated));
    }
  }

  get length(): number {
    return this._length;
  }

  set length(length: number) {
    this._length = length;
    this.require(length);
  }

  get allocated(): number {
    return this._allocated;
  }

  createBuffer(name: string, typedArray: ArrayBufferView): this {
    // this._buffers[name] = typedArray;
    Object.defineProperty(this._buffers, name, {
      value : typedArray,
      writable : true,
      enumerable : true,
      configurable : false
    });
    return this;
  }

  getBuffer(name: string): ArrayBufferView {
    return this._buffers[name];
  }

  require(size: number): this {
    if(this._allocated < size) {
      this.allocate(size);
    }
    return this;
  }

  allocate(size: number): this {
    this._allocated = size;
    this.transferBuffers();
    return this;
  }

  compact(): this {
    this.allocate(this._length);
    return this;
  }

  move(index_0: number, index_1: number): this {
    let bufferNames: string[] = Object.keys(this._buffers);
    let buffer: any;
    for(let i = 0; i < bufferNames.length; i++) {
      buffer = this._buffers[bufferNames[i]];
      buffer[index_0] = buffer[index_1];
    }
    return this;
  }

  protected transferBuffers() {
    let bufferNames: string[] = Object.keys(this._buffers);
    let bufferName: string;
    for(let i = 0; i < bufferNames.length; i++) {
      bufferName = bufferNames[i];
      this._buffers[bufferName] = DynamicSequence.sliceTypedArray(this._buffers[bufferName], 0, this._allocated, false)
    }
  }

}

export class DynamicSequenceCollection extends DynamicSequence {
  moves: DynamicSequence[] = [];

  constructor(allocated: number, buffers: { [key: string]: ArrayBufferViewConstructor }) {
    super(allocated, buffers);
  }

  get length(): number {
    return this._length;
  }

  set length(length: number) {
    this._length = length;
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].length = length;
    }
    this.require(length);
  }

  require(size: number): this {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].require(size);
    }
    super.require(size);
    return this;
  }

  allocate(size: number): this {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].allocate(size);
    }
    super.allocate(size);
    return this;
  }

  compact(): this {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].compact();
    }
    super.compact();
    return this;
  }

  // Move the movement at index_1 into the movement at index_0
  move(index_0: number, index_1: number): this {
    for(let i = 0; i < this.moves.length; i++) {
      (<DynamicSequence>this.moves[i]).move(index_0, index_1);
    }
    super.move(index_0, index_1);
    return this;
  }

}





/**
 * Represent a sequence of moves constrained by speed, acceleration and jerk
 */
export class ConstrainedMovesSequence extends DynamicSequence {

  constructor(allocated?: number) {
    super(allocated, {
      'values': Float64Array,
      'speedLimits': Float64Array,
      'accelerationLimits': Float64Array,
      'jerkLimits': Float64Array
    });
  }

  roundValues(buffer: any = this._buffers['values']): void {
    DynamicSequence.roundFloatArray(this._buffers['values'] as Float64Array, buffer);
  }

  /**
   * DEBUG
   */
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
          return '( ' + this._buffers['speedLimits'][index] + ', ' + this._buffers['accelerationLimits'][index] + ', ' + this._buffers.jerkLimits[index] + ' )';
        case 'value':
        default:
          return this._buffers['values'][index].toString();
      }
    }
  }

}


/**
 * Represent an abstract sequence of constrained moves
 * Which have maximum initial and final speeds
 */
export class ConstrainedNormalizedMovesSequence extends DynamicSequence {

  constructor(allocated?: number) {
    super(allocated, {
      'initialSpeeds': Float64Array,
      'finalSpeeds': Float64Array,
      'speedLimits': Float64Array,
      'accelerationLimits': Float64Array,
    });
  }

  /**
   * DEBUG
   */
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
          return '( ' + this._buffers.speedLimits[index] + ', ' + this._buffers.accelerationLimits[index] + ' )';
        case 'speed':
        default:
          return '( ' + this._buffers.initialSpeeds[index] + ', ' + this._buffers.finalSpeeds[index] + ' )';
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
  // static DEFAULT_PRECISION = 1e-4;
  static DEFAULT_PRECISION = Float.EPSILON_32;

  public moves: ConstrainedMovesSequence[] = [];

  constructor(numberOfParallelMoves: number) {
    super(0, {
      'indices': Uint32Array
    });

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new ConstrainedMovesSequence();
    }
  }


  roundValues() {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].roundValues();
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

  optimize(): OptimizedMovementsSequence {
    const normalizedMovesSequence: ConstrainedNormalizedMovesSequence = this._getNormalizedMovesSequence();
    // console.log(normalizedMovesSequence.toString(-1, 'limits'));

    this._optimizeTransitionSpeedsPass1(normalizedMovesSequence);

    //console.log(normalizedMovesSequence.toString(-1, 'speed'));

    this._optimizeTransitionSpeedsPass2(normalizedMovesSequence);

    // console.log(normalizedMovesSequence.toString(-1, 'speed'));

    return this._decompose(normalizedMovesSequence);
  }

    private _getNormalizedMovesSequence(): ConstrainedNormalizedMovesSequence {
      const movesSequence: ConstrainedNormalizedMovesSequence = new ConstrainedNormalizedMovesSequence();
      movesSequence.length = this.length;

      let move: ConstrainedMovesSequence;
      let speedLimit: number, accelerationLimit: number, value: number;
      for(let i = 0, length = this.length; i < length; i++) {
        move = <ConstrainedMovesSequence>this.moves[0];
        value = Math.abs(move._buffers.values[i]);
        speedLimit = move._buffers.speedLimits[i] / value;
        accelerationLimit = move._buffers.accelerationLimits[i] / value;
        for(let j = 1; j < this.moves.length; j++) {
          move = <ConstrainedMovesSequence>this.moves[j];
          value = Math.abs(move._buffers.values[i]);
          speedLimit = Math.min(speedLimit, move._buffers.speedLimits[i] / value);
          accelerationLimit = Math.min(accelerationLimit, move._buffers.accelerationLimits[i] / value);
        }

        // movesSequence.initialSpeeds[i]       = NaN;
        // movesSequence.finalSpeeds[i]         = NaN;
        movesSequence._buffers.speedLimits[i]         = speedLimit;
        movesSequence._buffers.accelerationLimits[i]  = accelerationLimit;
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
      normalizedMovesSequence._buffers.initialSpeeds[i] = 0;
      for(let length = normalizedMovesSequence.length - 1; i < length; i++) {
        initialSpeed = normalizedMovesSequence._buffers.initialSpeeds[i];
        accelerationLimit = normalizedMovesSequence._buffers.accelerationLimits[i];

        // compute final speed limit according to accelerationLimit and speedLimit
        finalSpeedLimit = Math.min(
          normalizedMovesSequence._buffers.speedLimits[i],
          (accelerationLimit === 0) ?
            initialSpeed : Math.sqrt(initialSpeed * initialSpeed + 2 * accelerationLimit)
        );

        // build the maximization matrix
        matrix = this._getMaximizationMatrix(
          i, i + 1,
          finalSpeedLimit, Math.min(finalSpeedLimit, normalizedMovesSequence._buffers.speedLimits[i + 1])
        );
        // get max final and initial speeds
        solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

        normalizedMovesSequence._buffers.finalSpeeds[i]        = solutions.values[0];
        normalizedMovesSequence._buffers.initialSpeeds[i + 1]  = solutions.values[1];
      }
    }

    private _optimizeTransitionSpeedsPass2(normalizedMovesSequence: ConstrainedNormalizedMovesSequence) {
      let finalSpeed: number;
      let accelerationLimit: number;
      let initialSpeedLimit: number;

      let matrix: Matrix;
      let solutions: Matrix;
      let i: number = normalizedMovesSequence.length - 1;
      normalizedMovesSequence._buffers.finalSpeeds[i] = 0;
      for(; i > 0; i--) {
        finalSpeed = normalizedMovesSequence._buffers.finalSpeeds[i];
        accelerationLimit = normalizedMovesSequence._buffers.accelerationLimits[i];

        // compute initial speed limit according to accelerationLimit and speedLimit
        initialSpeedLimit = Math.min(
          normalizedMovesSequence._buffers.speedLimits[i],
          normalizedMovesSequence._buffers.initialSpeeds[i],
          (accelerationLimit === 0) ?
            finalSpeed : Math.sqrt(finalSpeed * finalSpeed + 2 * accelerationLimit)
        );

        // build the maximization matrix
        matrix = this._getMaximizationMatrix(
          i - 1, i,
          Math.min(initialSpeedLimit, normalizedMovesSequence._buffers.finalSpeeds[i - 1]), initialSpeedLimit,
        );
        // get max final and initial speeds
        solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

        normalizedMovesSequence._buffers.finalSpeeds[i - 1]  = solutions.values[0];
        normalizedMovesSequence._buffers.initialSpeeds[i]    = solutions.values[1];
      }
    }

    private _getMaximizationMatrix(index_0: number, index_1: number, finalSpeedLimit: number, initialSpeedLimit: number): Matrix {
      // 2 per axes
      // + 2 for max values
      // + 1 for maximization
      const rowsNumber: number = this.moves.length * 2 + 2 + 1;

      // D[i][0] * Ve - D[i][1] * Vi < J[i] => 3 columns
      const matrix = new Matrix(rowsNumber, 3 + rowsNumber - 1);

      let movesSequence: ConstrainedMovesSequence;
      let row: number = 0;

      const col_1: number = matrix.m;
      const col_last: number = (matrix.n - 1) * matrix.m;
      let jerkLimit: number;
      let value_0: number, value_1: number;

      for(let i = 0; i < this.moves.length; i++) {
        movesSequence = <ConstrainedMovesSequence>this.moves[i];

        jerkLimit = Math.min(movesSequence._buffers.jerkLimits[index_0], movesSequence._buffers.jerkLimits[index_1]); //  * move_0.direction  * move_1.direction

        value_0 = movesSequence._buffers.values[index_0];
        value_1 = movesSequence._buffers.values[index_1];

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

    private _decompose(normalizedMovesSequence: ConstrainedNormalizedMovesSequence, precision: number = 1e-12): OptimizedMovementsSequence {
      const movementsSequence = new OptimizedMovementsSequence(this.moves.length);
      movementsSequence.require(normalizedMovesSequence.length * 3);
      let movementsSequenceLength: number = 0;

      let index: number;
      let initialSpeed: number, finalSpeed: number;
      let speedLimit: number, accelerationLimit: number;

      let ta: number, tb: number, t0: number, t1: number, t2: number;
      let v0_max: number;
      let d0: number, d1: number, d2: number;


      for(let i = 0, length = normalizedMovesSequence.length; i < length; i++) {
        index = this._buffers.indices[i];

        initialSpeed = normalizedMovesSequence._buffers.initialSpeeds[i];
        finalSpeed = normalizedMovesSequence._buffers.finalSpeeds[i];
        speedLimit = normalizedMovesSequence._buffers.speedLimits[i];
        accelerationLimit = normalizedMovesSequence._buffers.accelerationLimits[i];

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


        // console.log('t=>', t0, t1, t2, ta, tb);
        // // console.log('v=>', v0_max, v1_max);
        // console.log('d=>', d0, d1, d2);
        // console.log('--');

        // acceleration
        if(!Float.isNull(t0, precision)) {
          // console.log('i', i, 'vi', initialSpeed, 'vf', finalSpeed, 'al', accelerationLimit);

          movementsSequence._buffers.indices[movementsSequenceLength] = index;
          movementsSequence._buffers.times[movementsSequenceLength] = t0;
          movementsSequence._buffers.initialSpeeds[movementsSequenceLength] = initialSpeed / d0;
          movementsSequence._buffers.accelerations[movementsSequenceLength] = accelerationLimit / d0;

          for(let j = 0; j < this.moves.length; j++) {
            movementsSequence.moves[j]._buffers.values[movementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j])._buffers.values[i] * d0;
          }

          movementsSequenceLength++;
        }

        // linear
        if(!Float.isNull(t1, precision)) {
          movementsSequence._buffers.indices[movementsSequenceLength] = index;
          movementsSequence._buffers.times[movementsSequenceLength] = t1;
          movementsSequence._buffers.initialSpeeds[movementsSequenceLength] = v0_max / d1;
          // movementsSequence.accelerations[movementsSequenceLength] = 0;

          for(let j = 0; j < this.moves.length; j++) {
            movementsSequence.moves[j]._buffers.values[movementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j])._buffers.values[i] * d1;
          }

          movementsSequenceLength++;
        }

        // deceleration
        if(!Float.isNull(t2, precision)) {
          movementsSequence._buffers.indices[movementsSequenceLength] = index;
          movementsSequence._buffers.times[movementsSequenceLength] = t2;
          movementsSequence._buffers.initialSpeeds[movementsSequenceLength] = v0_max / d2;
          movementsSequence._buffers.accelerations[movementsSequenceLength] = -normalizedMovesSequence._buffers.accelerationLimits[i] / d2;

          for(let j = 0; j < this.moves.length; j++) {
            movementsSequence.moves[j]._buffers.values[movementsSequenceLength] = (<ConstrainedMovesSequence>this.moves[j])._buffers.values[i] * d2;
          }

          movementsSequenceLength++;
        }

      }

      movementsSequence.length = movementsSequenceLength;
      // console.log(movementsSequence.toString());

      return movementsSequence;
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
        movesSequence._buffers.values[index_0] += movesSequence._buffers.values[index_1];
        movesSequence._buffers.values[index_1] = 0;
      }
      return true;
    }

    return false;
  }



  isNull(index: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(!Float.isNull((<ConstrainedMovesSequence>this.moves[i])._buffers.values[index], precision)) {
        return false;
      }
    }
    return true;
  }

  areCollinear(index_0: number, index_1: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    let movesSequence: ConstrainedMovesSequence = <ConstrainedMovesSequence>this.moves[0];
    let value_0: number  = movesSequence._buffers.values[index_0];
    let value_1: number = movesSequence._buffers.values[index_1];
    const factor: number = value_0 / value_1;
    for(let i = 1; i < this.moves.length; i++) {
      movesSequence = <ConstrainedMovesSequence>this.moves[i];
      value_0 = movesSequence._buffers.values[index_0];
      value_1 = movesSequence._buffers.values[index_1];
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
        !Float.equals(movesSequence._buffers.speedLimits[index_0], movesSequence._buffers.speedLimits[index_1], precision) ||
        !Float.equals(movesSequence._buffers.accelerationLimits[index_0], movesSequence._buffers.accelerationLimits[index_1], precision) ||
        !Float.equals(movesSequence._buffers.jerkLimits[index_0], movesSequence._buffers.jerkLimits[index_1], precision)
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
        case 'limits':
          return this.moves.map((move: ConstrainedMovesSequence) => {
            return move.toString(index, 'limits');
          }).join(', ');
        default:
          return '';
      }
    }
  }

}



export class OptimizedMovesSequence extends DynamicSequence {
  constructor(allocated?: number) {
    super(allocated, {
      'values': Float64Array
    });
  }

  roundValues(buffer: any = this._buffers['values']): void {
    DynamicSequence.roundFloatArray(this._buffers['values'] as Float64Array, buffer);
  }

}

export class OptimizedMovementsSequence extends DynamicSequenceCollection {
  public moves: OptimizedMovesSequence[] = [];

  constructor(numberOfParallelMoves: number) {
    super(0, {
      'indices': Uint32Array,
      'times': Float64Array,
      'initialSpeeds': Float64Array,
      'accelerations': Float64Array
    });

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new OptimizedMovesSequence();
    }
  }

  roundValues() {
    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].roundValues();
    }
  }

  reduce() {
    let writeIndex: number = 0;
    for(let i = 0; i < this._length; i++) {
      if(!this.isNull(i)) {
        this.move(writeIndex, i);
        writeIndex++;
      }
    }
    this.length = writeIndex;
  }

  isNull(index: number, precision: number = ConstrainedMovementsSequence.DEFAULT_PRECISION): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(!Float.isNull((<ConstrainedMovesSequence>this.moves[i])._buffers.values[index], precision)) {
        return false;
      }
    }
    return true;
  }

  toStepperMovementsSequence(): StepperMovementsSequence {
    let movementsSequence = new StepperMovementsSequence(this.moves.length);
    movementsSequence.length = this._length;

    for(let i = 0; i < this.moves.length; i++) {
      this.moves[i].roundValues(movementsSequence.moves[i]._buffers.values);
    }

    for(let i = 0; i < this._length; i++) {
      movementsSequence._buffers.times[i] = this._buffers.times[i];
      movementsSequence._buffers.initialSpeeds[i] = this._buffers.initialSpeeds[i];
      movementsSequence._buffers.accelerations[i] = this._buffers.accelerations[i];
    }

    return movementsSequence;
  }


  /**
   * DEBUG
   */
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
          return '(' + this._buffers.indices[index] + ') ' + 'time: ' + this._buffers.times[index] + ' => ' +
            this.moves.map((move: OptimizedMovesSequence) => {
              // return move.toString(index);
              let value = move._buffers.values[index];
              return '{ ' +
                  'value: ' + value +
                ', speed: ' + value * this._buffers.initialSpeeds[index] +
                ', accel: ' + value * this._buffers.accelerations[index] +
                ' }';
            }).join(', ');
        case 'times':
          return 'time: ' + this._buffers.times[index] + ' => ' +
            this.moves.map((move: OptimizedMovesSequence) => {
              // return move.toString(index);
              let value = move._buffers.values[index];
              let computed = 0.5 * this._buffers.accelerations[index] * this._buffers.times[index] * this._buffers.times[index] + this._buffers.initialSpeeds[index] * this._buffers.times[index];
              return '{ ' +
                'value: ' + value +
                ', computed: ' + computed * value +
                ' }' + (Float.equals(computed, 1, 1e-9)? '' : '=>>>>>>>>[ERROR]');
            }).join(', ');
        default:
          return '';
      }
    }
  }

}





// not used

export class StepperMovesSequence extends DynamicSequence {
  constructor(allocated?: number) {
    super(allocated, {
      'values': Int32Array,
      'positions': Uint32Array,
    });
  }
}

export class StepperMovementsSequence extends DynamicSequenceCollection {
  public moves: StepperMovesSequence[] = [];

  constructor(numberOfParallelMoves: number) {
    super(0, {
      'times': Float64Array,
      'initialSpeeds': Float64Array,
      'accelerations': Float64Array
    });

    for(let i = 0; i < numberOfParallelMoves; i++) {
      this.moves[i] = new StepperMovesSequence(this._allocated);
    }
  }

  reduce() {
    let writeIndex: number = 0;
    for(let i = 0; i < this._length; i++) {
      if(!this.isNull(i)) {
        this.move(writeIndex, i);
        writeIndex++;
      }
    }
    this.length = writeIndex;
  }

  isNull(index: number): boolean {
    for(let i = 0; i < this.moves.length; i++) {
      if(this.moves[i]._buffers.values[index] !== 0) {
        return false;
      }
    }
    return true;
  }


  /**
   * DEBUG
   */
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
          return 'time: ' + this._buffers.times[index] + ' => ' +
            this.moves.map((move: StepperMovesSequence) => {
              // return move.toString(index);
              let value = move._buffers.values[index];
              return '{ ' +
                'value: ' + value +
                ', speed: ' + value * this._buffers.initialSpeeds[index] +
                ', accel: ' + value * this._buffers.accelerations[index] +
                ' }';
            }).join(', ');
        case 'times':
          return 'time: ' + this._buffers.times[index] + ' => ' +
            this.moves.map((move: StepperMovesSequence) => {
              // return move.toString(index);
              let value = move._buffers.values[index];
              let computed = 0.5 * this._buffers.accelerations[index] * this._buffers.times[index] * this._buffers.times[index] + this._buffers.initialSpeeds[index] * this._buffers.times[index];
              return '{ ' +
                'value: ' + value +
                ', computed: ' + computed * value +
                ' }' + (Float.equals(computed, 1, 1e-9)? '' : '=>>>>>>>>[ERROR]');
            }).join(', ');
        default:
          return '';
      }
    }
  }

}

