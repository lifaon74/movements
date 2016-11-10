import { Matrix } from './classes/matrix.class';

let a = Matrix.fromArray([
  [1, 0],
  [-1, 3]
]);
// console.log(a.toString(), '\n');

let b = Matrix.fromArray([
  [3, 1],
  [2, 1]
]);
// console.log(b.toString(), '\n');

// TEST MULTIPLY
if(!Matrix.areEquals(Matrix.multiply(a, b), Matrix.fromArray([
  [3, 1],
  [3, 2]
]))) {
  throw new Error('multiply does\'nt pass');
}

// TEST TRANSPOSE
if(!Matrix.areEquals(Matrix.transpose(a), Matrix.fromArray([
    [1, -1],
    [0, 3]
  ]))) {
  throw new Error('transpose does\'nt pass');
}

// TEST DET
if(Matrix.det(a) !== 3) {
  throw new Error('det does\'nt pass');
}

// console.log(Matrix.identity(3).toString(), '\n');




let d = Matrix.fromArray([
  [ 3, 4, 1],
  [-8, 1, 2]
]);


// TEST PIVOT => http://www.zweigmedia.com/MundoReal/tutorialsf1/frames2_2B.html
if(!Matrix.areEquals(Matrix.pivot(d, 0, 0), Matrix.fromArray([
    [3, 4, 1],
    [0, 35, 14]
  ]))) {
  throw new Error('pivot does\'nt pass');
}


if(!Matrix.areEquals(Matrix.pivot(Matrix.fromArray([
    [ 3, 4, 1],
    [ 0, 5, 2]
  ]), 1, 1), Matrix.fromArray([
    [15, 0, -3],
    [0, 5, 2]
  ]))) {
  throw new Error('pivot does\'nt pass');
}


// TEST SOLVE
if(!Matrix.areEquals(Matrix.solve(d), Matrix.solve(Matrix.fromArray([
    [-8, 1, 2],
    [ 3, 4, 1]
  ])))) {
  throw new Error('solve does\'nt pass');
}


let e = Matrix.fromArray([
  [ 1, -1,  5, -6],
  [ 3,  3, -1, 10],
  [ 1,  3,  2,  5]
]);

if(!Matrix.areEquals(Matrix.solve(e), Matrix.fromArray([
    [1, 0, 0, 1],
    [0, 1, 0, 2],
    [0, 0, 1, -1]
  ]))) {
  throw new Error('solve does\'nt pass');
}


let rand = () => {
  return Math.floor(Math.random() * 10 - 5);
  // return Math.random();
};

// Number.EPSILON
let areEquals = (number_0: number, number_1: number, precision: number = 1e-3): boolean => {
  return Math.abs(number_0 - number_1) < precision;
};

let buildRandomMatrix = (number: number, size: number): Matrix[] => {
  let matrixArray:Matrix[] = [];

  for(let i = 0; i < number; i++) {
    let data = new Float32Array(size * (size + 1));
    for(let i = 0; i < data.length; i++) {
      data[i] = rand();
    }

    matrixArray.push(new Matrix(size, size + 1, data));
  }

  return matrixArray;
};

let matrixArray:Matrix[] = buildRandomMatrix(100000, 6);

for(let matrix of matrixArray) {
  let solved = Matrix.solve(matrix);
  let solutions = Matrix.getSolutions(solved);

  if(solutions === null) {
    //console.log('no solutions', matrix.toString());
    continue;
  }

  let lastColumnIndex = matrix.n - 1;

  let m: number;
  for(m = 0; m < matrix.m; m++) {
    let sum: number = 0;
    for(let n = 0; n < lastColumnIndex; n++) {
      sum += matrix.get(m, n) * solutions.get(n, 0);
    }

    if(!areEquals(sum, matrix.get(m, lastColumnIndex), 1e-1)) {
      console.log(sum, matrix.get(m, lastColumnIndex));
      console.log(
        matrix.toString(), '\n--\n',
        solved.toString(), '\n\n',
        solutions.toString(), '\n\n'
      );
      break;
    }
  }

  if(matrix.m !== m) {
    setImmediate(() => { throw new Error('solved failed'); });
    break;
  }
}


let solveSpeedTest = () => {
  let a:number = 0;
  let t1 = process.hrtime();
  for(let matrix of matrixArray) {
    //let solved = Matrix.solve(matrix);
    let solutions = Matrix.getSolutions(matrix.solve());
    if(solutions) {
      a += solutions.values[0];
    }
  }
  let t2 = process.hrtime(t1);
  console.log(t2[0] + t2[1] / 1e9, a);
};

solveSpeedTest();


// console.log(Matrix.solve(Matrix.fromArray([
//   [-2, 1/4, 1/2],
//   [1/2, 2/3, 1/6]
// ])).toString());

// console.log(Matrix.pivot(e, 0, 0).toString(), '\n');  // [[1, -5, 5, -6], [0, 6, -16, 28], [0, 4, -3, 11]]



