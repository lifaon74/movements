// http://www.zweigmedia.com/MundoReal/tutorialsf4/frames4_3.html
//https://en.wikipedia.org/wiki/Simplex_algorithm

export class Matrix {

  static fromArray(array: number[][]): Matrix {
    let matrix = new Matrix(array.length, array.length ? array[0].length : 0);
    let i: number = 0;
    for(let n = 0; n < matrix.n; n++) {
      for(let m = 0; m < matrix.m; m++) {
        matrix.values[i++] = array[m][n]; // matrix.set(m, n, array[m][n]);
      }
    }
    return matrix;
  }

  static toArray(matrix: Matrix): number[][] {
    let array: number[][] = [];
    for(let m = 0; m < matrix.m; m++) {
      array[m] = [];
      for(let n = 0; n < matrix.n; n++) {
        array[m][n] = matrix.get(m, n);
      }
    }
    return array;
  }

  /**
   * Copies matrix
   * @param matrix
   * @returns {Matrix}
   */
  static fromMatrix(matrix: Matrix): Matrix {
    return new Matrix(matrix.m, matrix.n, new Float64Array(matrix.values));
  }


  /**
   * Convert a set a standard maximization problem matrix into a simplex tableau
   *
   * Example:  => http://www.zweigmedia.com/MundoReal/tutorialsf4/frames4_3.html
   *
   *   Maximize p = 2x - 3y + 4z subject to the constraints
   *     4x - 3y + z <= 3
   *     x + y + z <= 10
   *     2x + y - z <= 10,
   *     x >= 0, y >= 0, z >= 0
   *
   *   Gives the matrix:
   *     4,	-3, 1, 3
   *     1, 1, 1, 10
   *     2, 1, -1, 10
   *     -2, 3, -4, 0
   *
   * @param matrix_0
   * @returns {number[][]}
   */
  static toSimplexTableau(matrix_0: Matrix): Matrix {
    // if(matrix_0.m !== matrix_0.n) {
    //   throw new Error('matrix.n must be equal to matrix.m');
    // }

    // variables
    let matrix = new Matrix(matrix_0.m, matrix_0.n + matrix_0.m - 1);
    for(let m = 0; m < matrix_0.m; m++) {
      for(let n = 0; n < matrix_0.n - 1; n++) {
        matrix.values[m + n * matrix.m] = matrix_0.values[m + n * matrix.m];
      }
    }

    // answers (last row)
    let lastColumnIndexMatrix_0: number = (matrix_0.n - 1) * matrix_0.m;
    let lastColumnIndexMatrix: number = (matrix.n - 1) * matrix.m;
    for(let m = 0; m < matrix_0.m; m++) {
      matrix.values[m + lastColumnIndexMatrix] = matrix_0.values[m + lastColumnIndexMatrix_0];
    }

    // slack variables (identity matrix)
    for(let m = 0; m < matrix_0.m - 1; m++) {
      matrix.values[m + (m + matrix_0.n - 1) * matrix.m] = 1;
    }

    return matrix;
  }

  /**
   * Compare two matrix and return true if all elements are equals
   * @param matrix_0
   * @param matrix_1
   * @param areEqualsCallback [optional]
   * @returns {boolean}
   */
  static areEquals(
    matrix_0: Matrix,
    matrix_1: Matrix,
    areEqualsCallback: ((a: number, b: number) => boolean) = ((a, b) => (a === b))
  ): boolean {

    if((matrix_0.m !== matrix_1.m) || (matrix_0.n !== matrix_1.n)) {
      return false;
    }

    for(let i = 0; i < matrix_0.values.length; i++) {
      if(!areEqualsCallback(matrix_0.values[i], matrix_1.values[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create an identity matrix with a size of 'size'
   * @param size the size of the identity matrix
   * @returns {Matrix}
   */
  static identity(size: number): Matrix {
    let matrix = new Matrix(size, size);
    for(let i = 0; i < size; i++) {
      matrix.values[i + i * size] = 1; // matrix.set(i, i, 1)
    }
    return matrix;
  }

  /**
   * Multiply two matrix
   * @param matrix_0
   * @param matrix_1
   * @returns {Matrix}
   */
  static multiply(matrix_0: Matrix, matrix_1: Matrix): Matrix {
    if(matrix_0.n !== matrix_1.m) {
      throw new Error('matrix_0.n must be equal to matrix_1.m');
    }

    let matrix = new Matrix(matrix_0.m, matrix_1.n);

    let i: number = 0, sum: number, k: number;
    for(let n = 0; n < matrix.n; n++) {
      for(let m = 0; m < matrix.m; m++) {
        sum = 0;
        k = n * matrix_1.m;
        for(let j = 0; j < matrix_0.n; j++) {
          sum += matrix_0.values[m + j * matrix_0.m] * matrix_1.values[j + k]; // sum += matrix_0.get(m, i) * matrix_1.get(i, n);
        }
        matrix.values[i++] = sum;
      }
    }

    return matrix;
  }

  /**
   * Transpose a matrix
   * @param matrix_0
   * @returns {Matrix}
   */
  static transpose(matrix_0: Matrix): Matrix {
    let matrix = new Matrix(matrix_0.n, matrix_0.m);
    let i: number = 0;
    for(let n = 0; n < matrix.n; n++) {
      for(let m = 0; m < matrix.m; m++) {
        matrix.values[i++] = matrix_0.values[n + m * matrix_0.m]; // matrix.set(m, n, matrix.get(n, m))
      }
    }
    return matrix;
  }

  /**
   * Compute the determinant of a matrix
   * @param matrix
   * @returns {number}
   */
  static det(matrix: Matrix): number {
    return matrix.det();
  }

  /**
   * Apply a pivot to a matrix
   * @param matrix the matrix to pivot
   * @param m_pivot the row of the pivot
   * @param n_pivot the column of the pivot
   * @returns {Matrix}
   */
  static pivot(matrix: Matrix, m_pivot: number, n_pivot: number): Matrix {
    return Matrix.fromMatrix(matrix).pivot(m_pivot, n_pivot);
  }


  /**
   * Solve a system of equations
   *
   * Example:
   *  1/2 * x + 2/3 * y = 1/6
   *  -2 * x + 1/4 * y = 1/2
   *
   * Gives the matrix:
   *    1/2, 2/3, 1/6,
   *    -2, 1/4, 1/2
   *
   * And return :
   *  1, 0, -0.2,
   *  0, 1, 0.4
   *
   * The last column contain the result
   *
   * @param matrix
   * @returns {Matrix}
   */
  static solveSystemOfEquationsProblem(matrix: Matrix): Matrix {
    return Matrix.fromMatrix(matrix).solveSystemOfEquationsProblem();
  }


  /**
   * Return the formatted solutions from solved matrix of a system of equations
   * or null if no solution
   *
   * In matrix:
   *  0, 1,  0.4,
   *  1, 0, -0.2
   *
   * Out matrix:
   *  -0.2,
   *   0.4
   *
   * @param matrix_0
   * @returns {Matrix} | null
   */
  static getSystemOfEquationsProblemSolutions(matrix_0: Matrix): Matrix {
    let matrix = new Matrix(matrix_0.m, 1);
    let lastColumnNumber: number = matrix_0.n - 1;
    let lastColumnIndex: number = lastColumnNumber * matrix_0.m;
    let n: number;

    for(let m = 0; m < matrix_0.m; m++) {
      for(n = 0; n < lastColumnNumber; n++) {
        if(matrix_0.values[m + n * matrix_0.m] === 1) {
          matrix.values[n] = matrix_0.values[m + lastColumnIndex];
          break;
        }
      }

      if(n === lastColumnNumber) {
        return null;
      }
    }
    return matrix;
  }

  /**
   * Verify if the solutions are conform to the system of equations matrix
   *
   * @param matrix
   * @param solutions
   * @param precision
   * @returns {boolean}
   */
  static verifySystemOfEquationsProblemSolutions(matrix: Matrix, solutions: Matrix, precision: number = 1e-3): boolean {
    if(solutions === null) {
      return true;
    }

    let lastColumnNumber = matrix.n - 1;
    let lastColumnIndex = lastColumnNumber * matrix.m;

    let m: number;
    for(m = 0; m < matrix.m; m++) {
      let sum: number = 0;
      for(let n = 0; n < lastColumnIndex; n++) {
        sum +=  matrix.values[m + n * matrix.m] * solutions.values[n];
      }

      if(Math.abs(sum - matrix.values[m + lastColumnNumber]) > precision) {
        return false;
      }
    }

    return true;
  }


  /**
   * Return the formatted solutions from solved matrix of a standard maximization problem
   *
   * Out matrix: [
   *    x,
   *    y,
   *    ...,
   *    slack0,
   *    slack1,
   *    ...
   *    maximum
   *  ]
   *
   * @param matrix_0
   * @returns {Matrix}
   */
  static getStandardMaximizationProblemSolutions(matrix_0: Matrix): Matrix {
    let matrix = new Matrix(matrix_0.n, 1);
    let lastColumnNumber: number = matrix_0.n - 1;
    let lastRowIndex: number = matrix_0.m - 1;
    let lastColumnIndex: number = lastColumnNumber * matrix_0.m;

    let value: number;
    let rowIndex: number;

    for(let n = 0; n < lastColumnNumber; n++) {
      rowIndex = -1;
      for(let m = 0; m < lastRowIndex; m++) {
        value = matrix_0.values[m + n * matrix_0.m];
        if(value === 1) {
          if(rowIndex === -1) {
            rowIndex = m;
          } else {
            rowIndex = -1;
            break;
          }
        } else if(value !== 0) {
          break;
        }
      }

      if(rowIndex !== -1) {
        matrix.values[n] = matrix_0.values[rowIndex + lastColumnIndex];
      }
    }

    matrix.values[lastColumnNumber] = matrix_0.values[matrix_0.values.length - 1];

    return matrix;
  }

  /**
   *
   * @param m number of rows
   * @param n number of columns
   * @param values [
   *  (0, 0), (1, 0), (2, 0),...
   *  (0, 1), (1, 1), ...
   * ]
   */
  constructor(public m: number, public n: number, public values?: Float64Array) {
    if(!this.values) {
      this.values = new Float64Array(this.m * this.n)
    }
  }

  get(m: number, n: number) {
    return this.values[m + n * this.m];
  }

  set(m: number, n: number, value: number) {
    this.values[m + n * this.m] = value;
  }

  toString(): string {
    let string = '[\n';
    for(let m = 0; m < this.m; m++) {
      if(m > 0) string += ',\n';
      string += '  [';
      for(let n = 0; n < this.n; n++) {
        if(n > 0) string += ', ';
        string += this.get(m, n).toString();
      }
      string += ']';
    }
    string += '\n]\n';
    return string;
  }

  det(): number {
    if(this.n !== this.m) {
      throw new Error('matrix.n must be equal to matrix.m');
    }

    if(this.n === 2) {
      return this.values[0] * this.values[3] - this.values[1] * this.values[2];
    } else {
      return 0; // TODO
    }
  }


  pivot(m_pivot: number, n_pivot: number): this {
    let pivot: number = this.values[m_pivot + n_pivot * this.m];
    let absolutePivot: number = Math.abs(pivot);
    let pivotInvertedSign: number = -Math.sign(pivot);
    let pivotColumnIndex: number = n_pivot * this.m;

    for(let m = 0; m < this.m; m++) {
      if(m !== m_pivot) {
        let a: number = pivotInvertedSign * this.values[m + pivotColumnIndex];
        for(let n = 0; n < this.n; n++) {
          let columnIndex: number = n * this.m;
          this.values[m + columnIndex] =
            absolutePivot * this.values[m + columnIndex] +
            a * this.values[m_pivot + columnIndex];
        }
      }
    }

    return this;
  }

  // http://www.zweigmedia.com/MundoReal/tutorialsf1/frames2_2B.html
  solveSystemOfEquationsProblem(): this {
    if((this.m + 1) !== this.n) {
      throw new Error('matrix.n must be equal to matrix.m + 1');
    }

    for(let m = 0; m < this.m; m++){
      for(let n = 0; n < this.m; n++) {
        if(this.values[m + n * this.m] !== 0) {
          this.pivot(m, n);
          this._reduceRowsCoefficients();
          break;
        }
      }
    }

    let pivot: number;
    let lastColumnIndex: number = (this.n - 1) * this.m;
    for(let m = 0; m < this.m; m++) {
      for(let n = 0; n < this.m; n++) {
        pivot = this.values[m + n * this.m];
        if(pivot !== 0) {
          this.values[m + lastColumnIndex] /= pivot;
          this.values[m + n * this.m] = 1;
          break;
        }
      }
    }

    // console.log('solved:\n', this.toString(), '\n');
    return this;
  }


  // http://math.uww.edu/~mcfarlat/s-prob.htm
  // https://en.wikipedia.org/wiki/Simplex_algorithm
  // http://www.zweigmedia.com/MundoReal/tutorialsf4/frames4_3.html
  solveStandardMaximizationProblem(): this { // simplex method
    let lastRowIndex: number = this.m - 1;
    let lastColumnNumber: number = this.n - 1;
    let lastColumnIndex: number = lastColumnNumber * this.m;
    let columnIndex: number; // index of the pivot column

    let value_0: number/*, value_1: number*/, min: number, ratio: number;
    let column: number, row: number;

    let i: number = 0;
    let limit: number = this.m * 100;
    while(i < limit) {
      column = row = -1;

      // search for most negative value, if all values >= 0 finish
      min = 0;
      for(let n = 0; n < lastColumnNumber; n++) {
        value_0 = this.values[lastRowIndex + n * this.m];
        if(value_0 < min) {
          column = n;
          min = value_0;
        }
      }

      if(column === -1) {
        // console.log('finished');
        return this;
      }

      columnIndex = column * this.m;
      min = 1;
      for(let m = 0; m < lastRowIndex; m++) {
        value_0 = this.values[m + columnIndex];
        // value_1 = this.values[m + lastColumnIndex];
        // if((value_0 !== 0) && (Math.sign(value_0) === Math.sign(value_1))) {
        if(value_0 > 0) {
          ratio = this.values[m + lastColumnIndex] / value_0;
          if((row === -1) || (ratio < min)) {
            row = m;
            min = ratio;
          }
        }
      }

      // console.log(row, column, min);

      if(row === -1) {
        // console.log('inconsistent');
        return null;
      }

      let pivot: number = this.values[row + column * this.m];
      for(let n = 0; n < this.n; n++) {
        this.values[row + n * this.m] /= pivot;
      }

      this.pivot(row, column);

      // console.log(this.toString());

      i++;
    }

    return null;
  }


  /**
   * This function try to divide an entire row by the best factor
   * to keep values in the range of floats, this avoids NaN,
   * Infinite and -Infinite values
   * @private
   */
  private _reduceRowsCoefficients() {
    // console.log('bef', this.toString(), '\n');


    // try to reach 0 technique
    // let max: number, value: number;
    // for(let m_1 = 0; m_1 < this.m; m_1++) {
    //   max = 1;
    //
    //   for(let n_1 = 0; n_1 < this.n; n_1++) {
    //     value = Math.abs(this.values[m_1 + n_1 * this.m]);
    //     if(value < 1e-9) {
    //       this.values[m_1 + n_1 * this.m] = 0;
    //     } else {
    //       max = Math.max(max, value);
    //     }
    //   }
    //   for(let n_1 = 0; n_1 < this.n; n_1++) {
    //     this.values[m_1 + n_1 * this.m] /= max;
    //   }
    // }

    // try to reach 1 technique
    let sum: number, count:number, value: number;
    for(let m_1 = 0; m_1 < this.m; m_1++) {
      sum = 0;
      count = 0;

      for(let n_1 = 0; n_1 < this.n; n_1++) {
        value = Math.abs(this.values[m_1 + n_1 * this.m]);
        if(value < 1e-12) {
          this.values[m_1 + n_1 * this.m] = 0;
        } else {
          sum += Math.log(value);
          count++;
        }
      }

      if(count > 0) {
        value = Math.exp(sum / count);
        for(let n_1 = 0; n_1 < this.n; n_1++) {
          this.values[m_1 + n_1 * this.m] /= value;
        }
      }
    }

    // console.log(this.toString(), '\n');
  }

}


