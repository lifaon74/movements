import { StepperMove } from './stepper';
import { Matrix } from './matrix.class';

export class TransitionMove {

  static getMaximizationMatrix(move_0: TransitionMove, move_1: TransitionMove): Matrix {
    // 2 per axes
    // + 2 for max values
    // + 1 for maximization
    let m: number = move_0.moves.length * 2 + 2 + 1;

    // D[i][0] * Ve - D[i][1] * Vi < J[i] => 3
    let n: number = 3;

    let matrix = new Matrix(m, n + m - 1);

    let m_0: StepperMove, m_1: StepperMove;
    let row: number = 0;

    let col_1: number = matrix.m;
    let col_last: number = (matrix.n - 1) * matrix.m;
    let jerkLimit: number;

    for(let i = 0; i < move_0.moves.length; i++) {
      m_0 = move_0.moves[i];
      m_1 = move_1.moves[i];

      jerkLimit = Math.min(m_0.stepper.jerkLimit, m_1.stepper.jerkLimit); //  * m_0.direction  * m_1.direction

      matrix.values[row] = m_0.value;
      matrix.values[row + col_1] = -m_1.value;
      matrix.values[row + col_last] = jerkLimit;
      row++;

      matrix.values[row] = -m_0.value;
      matrix.values[row + col_1] = m_1.value;
      matrix.values[row + col_last] = jerkLimit;
      row++;
    }


    matrix.values[row] = 1;
    // matrix.values[row + col_1] = 0;
    matrix.values[row + col_last] = move_0.finalSpeed;
    row++;

    // matrix.values[row] = 0;
    matrix.values[row + col_1] = 1;
    matrix.values[row + col_last] = Math.min(move_1.speedLimit, move_0.finalSpeed);
    row++;

    matrix.values[row] = -1;
    matrix.values[row + col_1] = -1;


    for(let m = 0; m < matrix.m - 1; m++) {
      matrix.values[m + (m + 2) * matrix.m] = 1;
    }

    return matrix;
  }

  public initialSpeed: number = null;
  public finalSpeed: number = null;

  public speedLimit: number;
  public accelerationLimit: number;

  constructor(public moves: StepperMove[]) {
    this.speedLimit = this.getStepperSpeedLimit();
    this.accelerationLimit = this.getStepperAccelerationLimit();
  }

  getStepperSpeedLimit(): number {
    return Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.speedLimit / move.steps; // m/s / m => s^-1
    }));
  }

  getStepperAccelerationLimit(): number {
    return Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.accelerationLimit / move.steps; // m/s^-2 / m => s^-2
    }));
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
}




