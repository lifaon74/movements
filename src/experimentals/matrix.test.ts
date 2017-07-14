import { Matrix } from '../classes/matrix.class';
import { Float } from '../classes/float.class';


let rand = () => {
  return Math.floor(Math.random() * 10 - 5);
  //return Math.random();
};

let buildRandomMatrix = (number: number, size: number): Matrix[] => {
  let matrixArray:Matrix[] = [];

  for(let i = 0; i < number; i++) {
    let data = new Float64Array(size * (size + 1));
    for(let i = 0; i < data.length; i++) {
      data[i] = rand();
    }

    matrixArray.push(new Matrix(size, size + 1, data));
  }

  return matrixArray;
};




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
if(!Matrix.areEquals(Matrix.solveSystemOfEquationsProblem(d), Matrix.solveSystemOfEquationsProblem(Matrix.fromArray([
    [-8, 1, 2],
    [ 3, 4, 1]
  ])), (a, b) => { return Float.equals(a, b, 1e-3); })) {
  throw new Error('solve 1 does\'nt pass');
}


let e = Matrix.fromArray([
  [ 1, -1,  5, -6],
  [ 3,  3, -1, 10],
  [ 1,  3,  2,  5]
]);

if(!Matrix.areEquals(Matrix.solveSystemOfEquationsProblem(e), Matrix.fromArray([
    [1, 0, 0, 1],
    [0, 1, 0, 2],
    [0, 0, 1, -1]
  ]), (a, b) => { return Float.equals(a, b, 1e-3); })) {
  throw new Error('solve 2 does\'nt pass');
}


let checkIfProperlySolved = (matrix: Matrix): number => {
  let solved = Matrix.solveSystemOfEquationsProblem(matrix);
  let solutions = Matrix.getSystemOfEquationsProblemSolutions(solved);

  if(solutions === null) {
    return -1;
  }

  let correct = Matrix.verifySystemOfEquationsProblemSolutions(matrix, solutions);

  if(correct) {
    return 1;
  } else {
    console.log(
      matrix.toString(), '\n--\n',
      solved.toString(), '\n\n',
      solutions.toString(), '\n\n'
    );

    setImmediate(() => { throw new Error('solved 3 failed'); });
    return 0;
  }
};

let solveTest = () => {
  let matrixArray:Matrix[] = buildRandomMatrix(1000, 16);
  let inconsistent: number = 0;
  for(let matrix of matrixArray) {
    switch(checkIfProperlySolved(matrix)) {
      case -1:
        inconsistent++;
        break;
      case 0:
        return;
    }
  }

  console.log('inconsistent', inconsistent); // ak not resolvable
};

solveTest();


let solveSystemOfEquationsProblemSpeedTest = () => {
  let matrixArray:Matrix[] = buildRandomMatrix(100000, 10);

  let a:number = 0;
  let t1 = process.hrtime();
  for(let matrix of matrixArray) {
    //let solved = Matrix.solveSystemOfEquationsProblem(matrix);
    let solutions = Matrix.getSystemOfEquationsProblemSolutions(matrix.solveSystemOfEquationsProblem());
    if(solutions) {
      // console.log(solutions.toString());
      a += solutions.values[0];
    }
  }
  let t2 = process.hrtime(t1);
  console.log(t2[0] + t2[1] / 1e9, a);
};

// solveSystemOfEquationsProblemSpeedTest();

let standardMaximizationProblemSpeedTest = () => {
  let mat = Matrix.fromArray([
    [3, -1, 1],
    [-3, 1, 1],
    [1, -2, 1],
    [-1, 2, 1],
    [1,  0, 0.5],
    [0,  1, 0.5],
    [-1, -1, 0]
  ]);

  let matrixArray:Matrix[] = [];
  for(let i = 0; i < 1000000; i++) {
    let _mat = Matrix.fromMatrix(mat);
    _mat.set(5, 2, Math.random() + 0.5);
    matrixArray.push(_mat);
  }

  let a:number = 0;
  let t1 = process.hrtime();
  for(let matrix of matrixArray) {
    //let solved = Matrix.solveSystemOfEquationsProblem(matrix);
    let solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());
    if(solutions) {
      // console.log(solutions.toString());
      a += solutions.values[0];
    }
  }
  let t2 = process.hrtime(t1);
  console.log(t2[0] + t2[1] / 1e9, a);
};

// standardMaximizationProblemSpeedTest();

// let f = Matrix.fromArray([
//   [4,	-3, 1, 3],
//   [1, 1, 1, 10],
//   [2, 1, -1, 10],
//   [-2, 3, -4, 0]
// ]);

let f = Matrix.fromArray([
  // [2, 1, 1, 14],
  // [4, 2, 3, 28],
  // [2, 5, 5, 30],
  // [-1, -2, 1, 0]

  // [1, -1, 0, 1],
  // [-1, 1, 0, 1],
  // [1,  0, 0, 1],
  // [-1, -1, 0, 0]

  // [1, -1, 1],
  // [-1, 1, 1],
  // [1,  0, 1],
  // [-1, -1, 0]

  [3, -1, 1],
  [-3, 1, 1],
  [1, -2, 1],
  [-1, 2, 1],
  [1,  0, 0.5],
  [0,  1, 0.5],
  [-1, -1, 0]
]);


// let tableau = Matrix.toSimplexTableau(f);
// console.log(tableau.toString());
// console.log(tableau.solveStandardMaximizationProblem().toString());
let solved = Matrix.toSimplexTableau(f).solveStandardMaximizationProblem();
if(solved) {
  console.log(solved.toString());
  console.log(Matrix.getStandardMaximizationProblemSolutions(solved).toString());
}
