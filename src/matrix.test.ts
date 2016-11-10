import { Matrix } from './classes/matrix.class';

let a = Matrix.fromArray([
  [1, 0],
  [-1, 3]
]);
console.log(a.toString(), '\n');

let b = Matrix.fromArray([
  [3, 1],
  [2, 1]
]);
console.log(b.toString(), '\n');

if(!Matrix.areEquals(Matrix.multiply(a, b), Matrix.fromArray([
  [3, 1],
  [3, 2]
]))) {
  throw new Error('multiply does\'nt pass');
}


if(!Matrix.areEquals(Matrix.transpose(a), Matrix.fromArray([
    [1, -1],
    [0, 3]
  ]))) {
  throw new Error('transpose does\'nt pass');
}

if(Matrix.det(a) !== 3) {
  throw new Error('det does\'nt pass');
}

console.log(Matrix.identity(3).toString(), '\n');


// http://www.zweigmedia.com/MundoReal/tutorialsf1/frames2_2B.html
let d = Matrix.fromArray([
  [ 3, 4, 1],
  [-8, 1, 2]
]);

if(!Matrix.areEquals(Matrix.pivot(d, 0, 0), Matrix.fromArray([
    [3, 4, 1],
    [0, 35, 14]
  ]))) {
  throw new Error('pivot does\'nt pass');
}

// console.log(d.pivot(0, 0).toString());

if(!Matrix.areEquals(Matrix.pivot(Matrix.fromArray([
    [ 3, 4, 1],
    [ 0, 5, 2]
  ]), 1, 1), Matrix.fromArray([
    [15, 0, -3],
    [0, 5, 2]
  ]))) {
  throw new Error('pivot does\'nt pass');
}

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

// console.log(Matrix.solve(Matrix.fromArray([
//   [-2, 1/4, 1/2],
//   [1/2, 2/3, 1/6]
// ])).toString());

// console.log(Matrix.pivot(e, 0, 0).toString(), '\n');  // [[1, -5, 5, -6], [0, 6, -16, 28], [0, 4, -3, 11]]



