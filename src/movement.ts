import { GCODEParser } from './gcodeParser';
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


class TransitionMove {

  public initialSpeed: number = 0;
  public finalSpeed: number = 0;
  public acceleration: number = 0;

  public speedLimit: number;
  public accelerationLimit: number;

  constructor(public moves: StepperMove[]) {
    this.speedLimit = Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.speedLimit / move.steps; // m/s / m => s^-1
    }));

    this.accelerationLimit = Math.min.apply(null, this.moves.map((move: StepperMove) => {
      return move.stepper.accelerationLimit / move.steps; // m/s^-2 / m => s^-2
    }));
  }



}


class StepperMove {
  public direction: number; // 1 or -1
  public steps: number;

  public initialSpeed: number;
  public acceleration: number;

  public stepped: number = 0;


  constructor(public stepper: Stepper,
              value: number) {
    this.value = value;
  }

  get value(): number {
    return this.steps * this.direction;
  }

  set value(value: number) {
    this.steps = Math.abs(value);
    this.direction = Math.sign(value) || 1;
  }


  // test

  computeLimitSpeeds() {
    // this.startSpeed = this.stepper.instantSpeed;
    // this.endSpeed = this.startSpeed * t + 0.5 * this.acceleration * t * t;
  }


  /**
   * Compute distance according to time
   */
  computeSteps(time: number): number {
    return 0.5 * this.acceleration * time * time + this.initialSpeed * time;
  }


  computeAccelerationTime(): number { // time to reach maximum initialSpeed
    if(this.acceleration === 0) {
      return 0;
    } else {
      return Math.min(
        this.initialSpeed / this.acceleration,
        Math.sqrt(this.steps / this.acceleration)
      );
    }
  }

  getMovement() {
    let t = this.computeAccelerationTime();
    let d = (this.acceleration / 2) * t * t;
    let dv = this.steps - (d * 2);
    let tv = (this.initialSpeed === 0) ? 0 : (dv / this.initialSpeed);

    // console.log(this.value / this.initialSpeed);
    // console.log(t, d, dv, tv);
    return [
      [d * this.direction, t],
      [dv * this.direction, tv],
      [d * this.direction, t]
    ];
  }


  toString(): string {
    return this.stepper.name + ': ' + this.value;
  }
}

class Movement {
  constructor(public moves: StepperMove[] = []) { // public moves:{ [key:string]:StepperMove }
  }

  ended(): boolean {
    for(let i = 0, l = this.moves.length; i < l; i++) {
      if(this.moves[i].stepped < this.moves[i].steps) {
        return false;
      }
    }
    return true;
  }

  tick(time: number): number {
    let accelerationFactor: number = time * time * 0.5;
    let move: StepperMove;
    let stepsByte: number = 0 | 0;
    for(let i = 0, l = this.moves.length; i < l; i++) {
      move = this.moves[i];
      let steps = Math.min(move.steps, Math.round(move.acceleration * accelerationFactor + move.initialSpeed * time));
      let deltaSteps = (steps - move.stepped) ? 1 : 0;
      stepsByte |= deltaSteps << i;
      move.stepped += deltaSteps;
    }

    // console.log(stepsByte.toString(2));
    return stepsByte;
  }

  // test

  getTransitionMove() {
    return new TransitionMove(this.moves);
  }



  convertMovement() {
    this.getTransitionMove();
    for(let move of this.moves) {
      // console.log(move);
      console.log(move.getMovement());
    }
    // console.log(movement.moves);
  }

  toString() {
    return this.moves.map((move: StepperMove) => move.toString()).join(', ');
  }
}


class Stepper {
  constructor(public name: string,
              public accelerationLimit: number,
              public speedLimit: number,
              public instantSpeed: number,
              public stepsPerMm: number) {
  }
}


const stepsPerTurn = 6400;

const ACCELERATION_LIMIT = stepsPerTurn / 1;
const SPEED_LIMIT = stepsPerTurn / 1;
const INSTANT_SPEED = stepsPerTurn / 4;


interface ICONFIG {
  steppers: Stepper[]
}

const CONFIG: ICONFIG = <ICONFIG>{
  steppers: [
    new Stepper('x', ACCELERATION_LIMIT, SPEED_LIMIT, INSTANT_SPEED, 160),
    new Stepper('y', ACCELERATION_LIMIT, SPEED_LIMIT, INSTANT_SPEED, 160),
    new Stepper('z', ACCELERATION_LIMIT, SPEED_LIMIT, INSTANT_SPEED, 3316.36),
    new Stepper('e', 1e10, SPEED_LIMIT, INSTANT_SPEED, 160),
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
      currentMove.finalSpeed = Math.min(currentMove.speedLimit, Move.computeFinalSpeed(1, currentMove.initialSpeed, currentMove.accelerationLimit));



      let jerk:number = 0;
      let maxDeltaSpeed = 0;
      for(let j = 0, l = currentMove.moves.length; j < l; j++) {
        let finalSpeed = currentMove.moves[j].steps * currentMove.finalSpeed;
        let initialSpeed = nextMove.moves[j].steps * currentMove.finalSpeed;
        // let finalSpeed = move.steps * currentMove.finalSpeed;
        let deltaSpeed = Math.abs(initialSpeed - finalSpeed);
        maxDeltaSpeed = Math.max(maxDeltaSpeed, deltaSpeed);
        console.log(finalSpeed, initialSpeed, deltaSpeed, deltaSpeed);
      }

      console.log(maxDeltaSpeed);
      //console.log(currentMove.finalSpeed);
      transitionSpeed = currentMove.finalSpeed;

    }



    return _movements;
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

  var timerObject = new NanoTimer();
  let a = 0;
  var microsecs = timerObject.time(() => {
    for(let i = 0; i < 1000000; i++) {
      let acc = (Math.random() > 0.5) ? 0 : Math.random();
      a += Move.computeFinalSpeed(Math.random(), Math.random(), acc);
    }
  }, '', 'n');
  console.log(microsecs / 1000000, a);
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

main.parseMovement(movements);

// let movement = movements[0];
// movement.moves[1].acceleration /= 2;
//
// let startTime = process.hrtime();
//
// while(!movement.ended()) {
//   let time = process.hrtime(startTime);
//   let t = time[0] + time[1] / 1e9;
//   let byte = movement.tick(t);
//   if(byte) {
//     // console.log(byte.toString(2));
//   }
// }
//
// let t = process.hrtime(startTime);
// console.log(t);


// console.log(CONFIG.steppers[0].movement(1e4));
// console.log(main.convertMovement(movement));


// main.parseFile('../assets/thin_tower.gcode').then((movements: Movement[]) => {
//   movements.slice(8, 8 + 1).forEach((movement: Movement) => {
//     console.log(movement.toString());
//     // movement.convertMovement();
//   });
//   // console.log(main.convertMovement(movements[1]));
// });
