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
    return new Matrix(matrix.m, matrix.n, new Float32Array(matrix.values));
  }


  /**
   * Compare two matrix and return true if all elements are equals
   * @param matrix_0
   * @param matrix_1
   * @returns {boolean}
   */
  static areEquals(matrix_0: Matrix, matrix_1: Matrix): boolean {
    if((matrix_0.m !== matrix_1.m) || (matrix_0.n !== matrix_1.n)) {
      return false;
    }

    for(let i = 0; i < matrix_0.values.length; i++) {
      if(matrix_0.values[i] !== matrix_1.values[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create an identity matrix with a size of n
   * @param n the size of the identity matrix
   * @returns {Matrix}
   */
  static identity(n: number): Matrix {
    let matrix = new Matrix(n, n);
    for(let i = 0; i < n; i++) {
      matrix.values[i + i * n] = 1; // matrix.set(i, i, 1)
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
   * Solve a matrix
   *
   * Assuming a set of equations:
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
  static solve(matrix: Matrix): Matrix {
    return Matrix.fromMatrix(matrix).solve();
  }


  static getSolutions(matrix_0: Matrix): Matrix {
    let matrix = new Matrix(matrix_0.m, 1);
    let lastColumnNumber: number = matrix_0.n - 1;
    let lastColumnIndex: number = lastColumnNumber * matrix_0.m;

    for(let m = 0; m < matrix_0.m; m++) {
      let n: number;
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
   *
   * @param m number of rows
   * @param n number of columns
   * @param values [
   *  (0, 0), (1, 0), (2, 0),...
   *  (0, 1), (1, 1), ...
   * ]
   */
  constructor(public m: number, public n: number, public values?: Float32Array) {
    if(!this.values) {
      this.values = new Float32Array(this.m * this.n)
    }
  }

  get(m: number, n: number) {
    return this.values[m + n * this.m];
  }

  set(m: number, n: number, value: number) {
    this.values[m + n * this.m] = value;
  }

  toString(): string {
    let string = '';
    for(let m = 0; m < this.m; m++) {
      if(m > 0) string += '\n';
      for(let n = 0; n < this.n; n++) {
        string += this.get(m, n).toString() + ', ';
      }
    }
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
          this.values[m + n * this.m] =
            absolutePivot * this.values[m + n * this.m] +
            a * this.values[m_pivot + n * this.m];

          if(isNaN(this.values[m + n * this.m])) {
            console.log('nan');
          }
        }
      }
    }

    return this;
  }

  // http://www.zweigmedia.com/MundoReal/tutorialsf1/frames2_2B.html
  solve(): this {
    if((this.m + 1) !== this.n) {
      throw new Error('matrix.n must be equal to matrix.m + 1');
    }

    for(let m = 0; m < this.m; m++){
      for(let n = 0; n < this.m; n++) {
        if(this.values[m + n * this.m] !== 0) {
          this.pivot(m, n);
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
    return this;
  }

}


