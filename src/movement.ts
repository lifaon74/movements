import { GCODEParser } from './gcodeParser';
import { Stepper, StepperMove } from './classes/stepper';
import { Movement } from './classes/movement';
import { TransitionMove } from './classes/transitionMove';

var NanoTimer = require('nanotimer');


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

const ACCELERATION_LIMIT = stepsPerTurn / 1;
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

  parseFile(path: string): Promise<any> {
    return GCODEParser.parseFile(path).then((commands: any[]) => {
      let movements: Movement[] = [];

      let localConfig: any = {
        unitFactor: 1, // 1 for millimeters, 25.4 for inches,
        absolutePosition: true,
        position: {}
      };

      for(let stepper of this.config.steppers) {
        localConfig.position[stepper.name] = 0;
      }


      commands.forEach((command: any) => {
        switch(command.command) {
          case 'G0':
          case 'G1':
            let movement = new Movement();

            for(let stepper of this.config.steppers) {
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

              movement.moves.push(new StepperMove(
                stepper,
                delta
              ));
            }

            movements.push(movement);
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
      });

      return movements;
    });
  }

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

    let currentMove: TransitionMove = transitionMoves[0];
    let nextMove: TransitionMove;
    let transitionSpeed:number = currentMove.initialSpeed;
    for(let i = 0, l = transitionMoves.length; i < l - 1; i++) {
      currentMove = transitionMoves[i];
      nextMove = transitionMoves[i + 1] || null;

      console.log('---');

      // console.log(Move.computeDuration(move.steps, 0, move.acceleration));
      currentMove.initialSpeed = transitionSpeed;
      // let's compute maximal final speed with maxAcceleration
      currentMove.finalSpeed = Math.min(currentMove.speedLimit, Move.computeFinalSpeed(1, currentMove.initialSpeed, currentMove.accelerationLimit));


      let maxDeltaSpeed = 0;
      let currentStepperMove: StepperMove, nextStepperMove: StepperMove;
      for(let j = 0, l = currentMove.moves.length; j < l; j++) {
        currentStepperMove = currentMove.moves[j];
        nextStepperMove = nextMove.moves[j];
        let finalSpeed = currentStepperMove.steps * currentMove.finalSpeed;
        let initialSpeed = nextStepperMove.steps * currentMove.finalSpeed;
        let deltaSpeed = Math.abs(initialSpeed - finalSpeed);

        if(deltaSpeed > nextStepperMove.stepper.jerkLimit) {
          console.log('too fast');
        }

        maxDeltaSpeed = Math.max(maxDeltaSpeed, deltaSpeed);
        console.log(finalSpeed, initialSpeed, deltaSpeed);
      }

      console.log(maxDeltaSpeed);
      //console.log(currentMove.finalSpeed);
      transitionSpeed = currentMove.finalSpeed;

    }



    return _movements;
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

/**
 * /--\
 * |  |
 * \--/
 */
let main = new Main(CONFIG);
let movements: Movement[] = [
  new Movement([
    new StepperMove(CONFIG.steppers[0], stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], 0)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], 0),
    new StepperMove(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], -stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], -stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], 0)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], -stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], -stepsPerTurn)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], 0),
    new StepperMove(CONFIG.steppers[1], -stepsPerTurn)
  ]),
  new Movement([
    new StepperMove(CONFIG.steppers[0], stepsPerTurn),
    new StepperMove(CONFIG.steppers[1], -stepsPerTurn)
  ])
];

//main.parseMovement(movements);





movements.forEach((movement: Movement) => {
  movement.moves.forEach((move: StepperMove) => {
    move.acceleration = 0;
    move.initialSpeed = move.stepper.speedLimit;
  });
});

let t1 = process.hrtime();
main.executeMovements(movements, () => {
  let t = process.hrtime(t1);
  console.log(t);
});

// console.log(CONFIG.steppers[0].movement(1e4));
// console.log(main.convertMovement(movement));


// main.parseFile('../assets/thin_tower.gcode').then((movements: Movement[]) => {
//   movements.slice(8, 8 + 1).forEach((movement: Movement) => {
//     console.log(movement.toString());
//     // movement.convertMovement();
//   });
//   // console.log(main.convertMovement(movements[1]));
// });
