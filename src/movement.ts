import { GCODEParser, GCODECommand } from './gcodeParser';
import { Stepper, StepperMove } from './classes/stepper';
import { Movement } from './classes/movement';
import { TransitionMove } from './classes/transitionMove';
import { Matrix } from './classes/matrix.class';
import { ConstrainedMovement, ConstrainedMove } from './classes/kinematics';

let NanoTimer = require('nanotimer');


class Vector3D {
  constructor(public x: number = 0,
              public y: number = 0,
              public z: number = 0) {

  }

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}


export class Kinematic {
  // public position: number = 0;
  // public acceleration: number = 0;
  // public jerk: number = 0;

  public initialJerk: number = 0;
  public initialVelocity: number = 0;
  public initialAcceleration: number = 0;

  constructor() {

  }

  getAcceleration(time: number): number {
    return this.initialJerk * time + this.initialAcceleration;
  }

  getVelocity(time: number): number {
    return 0.5 * this.initialJerk * time * time + this.initialAcceleration * time;
  }

  getPosition(time: number): number {
    return (1 / 6) * this.initialJerk * time * time * time + 0.5 * this.initialAcceleration * time * time + this.initialVelocity * time;
  }


  getDuration(position: number): number {
    return 0;
  }
}




class Move {

  static computeDuration(distance: number, initialSpeed: number, acceleration: number): number {
    return (acceleration === 0) ?
      (distance / initialSpeed) : ((Move.computeFinalSpeed(distance, initialSpeed, acceleration) - initialSpeed) / acceleration);
  }

  static computeFinalSpeed(distance: number, initialSpeed: number, acceleration: number): number {
    return (acceleration === 0) ?
      initialSpeed : Math.sqrt(initialSpeed * initialSpeed + 2 * acceleration * distance);
  }

}


const stepsPerTurn = 6400;

const ACCELERATION_LIMIT = stepsPerTurn / 4;
const SPEED_LIMIT = stepsPerTurn / 1;
const JERK_LIMIT = stepsPerTurn / 4;



interface ICONFIG {
  steppers: Stepper[]
}

const CONFIG: ICONFIG = <ICONFIG>{
  steppers: [
    new Stepper('x', ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 160),
    new Stepper('y', ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 160),
    new Stepper('z', ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 3316.36),
    new Stepper('e', 1e10, SPEED_LIMIT, JERK_LIMIT, 160),
  ]
};




class Main {
  constructor(private config: any) {
  }

  parseFile(path: string): Promise<ConstrainedMovement[]> {
    return GCODEParser.parseFile(path).then(this.parseGCODECommand.bind(this));
  }

  parseGCODECommand(commands: GCODECommand[]): ConstrainedMovement[] {
    let movements: ConstrainedMovement[] = [];

    let localConfig: any = {
      unitFactor: 1, // 1 for millimeters, 25.4 for inches,
      absolutePosition: true,
      position: {}
    };

    for(let stepper of this.config.steppers) {
      localConfig.position[stepper.name] = 0;
    }

    for(let command of commands) {
      switch(command.command) {
        case 'G0':
        case 'G1':
          let moves: ConstrainedMove[] = [];
          for(let stepper of this.config.steppers) {
            let move: ConstrainedMove = new ConstrainedMove();
            let value: number = command.params[stepper.name];
            let delta: number = 0;

            if(typeof value === 'number') {
              value = value * localConfig.unitFactor * stepper.stepsPerMm; // convert value to steps

              if(localConfig.absolutePosition) {
                delta = (value - localConfig.position[stepper.name]);
                localConfig.position[stepper.name] = value;
              } else {
                delta = value;
                localConfig.position[stepper.name] += value;
              }
            }

            move.speedLimit         = stepper.speedLimit;
            move.accelerationLimit  = stepper.accelerationLimit;
            move.jerkLimit          = stepper.jerkLimit;

            moves.push(move);
          }

          movements.push(new ConstrainedMovement(moves));
          break;

        case 'G20': // unit = inches
          localConfig.unitFactor = 25.4;
          break;
        case 'G21': // unit = millimeters
          localConfig.unitFactor = 1;
          break;

        case 'G90': // absolute position
          localConfig.absolutePosition = true;
          break;
        case 'G91': // relative position
          localConfig.absolutePosition = false;
          break;
        case 'G92': // define position
          for(let stepper of this.config.steppers) {
            localConfig.position[stepper.name] = command.params[stepper.name] || 0;
          }
          break;
      }
    }

    return movements;
  }

  optimizeMovementsSequence(movements: ConstrainedMovement[]) {
    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.speedLimit, move.accelerationLimit);
    // });

    this.computeSpeedsOfMovementsSequence(movements);

    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.toString());
    // });
  }


  private computeSpeedsOfMovementsSequence(movements: ConstrainedMovement[]) {
    movements[0].initialSpeed = 0;
    for(let i = 0, length = movements.length - 1; i < length; i++) {
      movements[i].optimizeSpeeds(movements[i + 1]);
    }

    movements.forEach((movement) => movement.swapSpeeds());

    movements[movements.length - 1].initialSpeed = 0;
    for(let i = movements.length - 1; i > 1; i--) {
      movements[i].optimizeSpeeds(movements[i - 1]);
    }

    movements.forEach((movement) => movement.swapSpeeds());
  }


  // old
  parseMovement(movements: Movement[]): Movement[] {
    let _movements: Movement[] = [];


    let transitionMoves: TransitionMove[] = [];
    let movement: Movement;
    for(let i = 0, l = movements.length; i < l; i++) {
      movement = movements[i];
      let move = movement.getTransitionMove();
      // console.log((move.initialSpeed + ' - ' + move.acceleration + ' - ' + move.instantSpeed));
      transitionMoves.push(move);
    }

    // console.log(transitionMoves);


    this.buildTransitionMoves(transitionMoves);

    console.log('----------------------------');

    transitionMoves.reverse().forEach((move: TransitionMove) => {
      let initialSpeed  = move.initialSpeed;
      move.initialSpeed = move.finalSpeed;
      move.finalSpeed   = initialSpeed;
    });

    this.buildTransitionMoves(transitionMoves);

    transitionMoves.reverse().forEach((move: TransitionMove) => {
      let initialSpeed  = move.initialSpeed;
      move.initialSpeed = move.finalSpeed;
      move.finalSpeed   = initialSpeed;
    });


    transitionMoves.forEach((move: TransitionMove) => {
      console.log('---');
      console.log(move.initialSpeed, move.finalSpeed);
    });
    // console.log(transitionMoves);


    return _movements;
  }

  buildTransitionMoves(transitionMoves: TransitionMove[]) {
    let currentMove: TransitionMove = transitionMoves[0];
    let nextMove: TransitionMove;

    currentMove.initialSpeed = 0;

    for(let i = 0, l = transitionMoves.length - 1; i < l; i++) {
      currentMove = transitionMoves[i];
      nextMove    = transitionMoves[i + 1] || null;

      // console.log('---');

      // console.log(Move.computeDuration(move.steps, 0, move.acceleration));

      // let's compute maximal final speed with maxAcceleration
      let finalSpeed = currentMove.getFinalMaximumSpeed();
      if(currentMove.finalSpeed === null) {
        currentMove.finalSpeed = finalSpeed;
      } else {
        currentMove.finalSpeed = Math.min(currentMove.finalSpeed, finalSpeed);
      }

      let matrix = TransitionMove.getMaximizationMatrix(currentMove, nextMove);
      // console.log(matrix.toString());
      let solutions = Matrix.getStandardMaximizationProblemSolutions(matrix.solveStandardMaximizationProblem());

      currentMove.finalSpeed = solutions.values[0];
      nextMove.initialSpeed = solutions.values[1];

      // console.log(currentMove.finalSpeed, nextMove.initialSpeed);
      // console.log(matrix.toString());
      // console.log(Matrix.getStandardMaximizationProblemSolutions(Matrix.solveStandardMaximizationProblem(matrix)).toString());
    }
  }


  executeMovements(movements: Movement[], callback: (() => any)) {
    let movementIndex: number = 0;
    let currentMovement: Movement = movements[movementIndex];
    let startTime = process.hrtime();

    let loop = () => {
      let time = process.hrtime(startTime);
      let t = time[0] + time[1] / 1e9;
      let byte = currentMovement.tick(t);
      if(byte) {
        // console.log(byte.toString(2));
      }

      if(currentMovement.ended()) {
        currentMovement = movements[movementIndex++];
        if(currentMovement) {
          startTime = process.hrtime();
        } else {
          return callback();
        }
      }

      process.nextTick(loop);
    };

    loop();
  }
}


// let speedTest1 = () => {
//   let moves: StepperMove[] = [];
//   for(let i = 0; i < 1000000; i++) {
//     moves.push(new StepperMove(CONFIG.steppers[0], Math.random() * 1e6));
//     moves[i].t = Math.random();
//   }
//
//   var timerObject = new NanoTimer();
//   let a = 0;
//   var microsecs = timerObject.time(() => {
//     for(let move of moves) {
//       a += 0.5 * move.stepper.accelerationLimit * move.t * move.t + move.stepper.speedLimit * move.t; // 73.76ns
//     }
//   }, '', 'n');
//   console.log(microsecs / moves.length, a);
// };

let speedTest2 = () => {
  let timerObject = new NanoTimer();
  let a = 0;
  let time = timerObject.time(() => {
    for(let i = 0; i < 1000000; i++) {
      let acc = (Math.random() > 0.5) ? 0 : Math.random();
      a += Move.computeFinalSpeed(Math.random(), Math.random(), acc);
    }
  }, '', 'n');
  console.log(time / 1000000, a);
};
// speedTest2();

let simpleMovement = (x: number, y: number) => {
  let move_0 = new ConstrainedMove();
  move_0.speedLimit         = CONFIG.steppers[0].speedLimit;
  move_0.accelerationLimit  = CONFIG.steppers[0].accelerationLimit;
  move_0.jerkLimit          = CONFIG.steppers[0].jerkLimit;
  move_0.value              = x;

  let move_1 = new ConstrainedMove();
  move_1.speedLimit         = CONFIG.steppers[1].speedLimit;
  move_1.accelerationLimit  = CONFIG.steppers[1].accelerationLimit;
  move_1.jerkLimit          = CONFIG.steppers[1].jerkLimit;
  move_1.value              = y;

  return new ConstrainedMovement([move_0, move_1]);

  // return new Movement([
  //   new StepperMove(CONFIG.steppers[0], x),
  //   new StepperMove(CONFIG.steppers[1], y)
  // ]);
};

/**
 * /--\
 * |  |
 * \--/
 */
let main = new Main(CONFIG);
// let movements: any[] = [
//   simpleMovement(stepsPerTurn, 0),
//   simpleMovement(stepsPerTurn, stepsPerTurn),
//   simpleMovement(0, stepsPerTurn),
//   simpleMovement(-stepsPerTurn, stepsPerTurn),
//   simpleMovement(-stepsPerTurn, 0),
//   simpleMovement(-stepsPerTurn, -stepsPerTurn),
//   simpleMovement(0, -stepsPerTurn),
//   simpleMovement(stepsPerTurn, -stepsPerTurn)
// ];

let movements: any[] = [];
for(let i = 0; i < 100000; i++) {
  movements.push(simpleMovement(stepsPerTurn, stepsPerTurn));
}

let t1 = process.hrtime();
main.optimizeMovementsSequence(movements);
let t2 = process.hrtime(t1);
console.log(t2[0] + t2[1] / 1e9);
// main.parseMovement(movements);





// movements.forEach((movement: Movement) => {
//   movement.moves.forEach((move: StepperMove) => {
//     move.acceleration = 0;
//     move.initialSpeed = move.stepper.speedLimit;
//   });
// });
//
// let t1 = process.hrtime();
// main.executeMovements(movements, () => {
//   let t = process.hrtime(t1);
//   console.log(t);
// });

// console.log(CONFIG.steppers[0].movement(1e4));
// console.log(main.convertMovement(movement));


// main.parseFile('../assets/thin_tower.gcode').then((movements: Movement[]) => {
//   movements.slice(8, 8 + 1).forEach((movement: Movement) => {
//     console.log(movement.toString());
//     // movement.convertMovement();
//   });
//   // console.log(main.convertMovement(movements[1]));
// });
