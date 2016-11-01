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
  public direction: number; // 1 or -1
  public steps: number;

  public speed: number;
  public acceleration: number;

  public stepped: number = 0;

  public startSpeed: number = 0;
  public endSpeed: number = 0;

  constructor(public stepper: Stepper,
              value: number) {
    this.value = value;

    this.acceleration = 0; // 1e2
    this.speed = 6400 / 2;
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
    return 0.5 * this.acceleration * time * time + this.speed * time;
  }


  computeAccelerationTime(): number { // time to reach maximum speed
    if(this.acceleration === 0) {
      return 0;
    } else {
      return Math.min(
        this.speed / this.acceleration,
        Math.sqrt(this.steps / this.acceleration)
      );
    }
  }

  getMovement() {
    let t = this.computeAccelerationTime();
    let d = (this.acceleration / 2) * t * t;
    let dv = this.steps - (d * 2);
    let tv = (this.speed === 0) ? 0 : (dv / this.speed);

    // console.log(this.value / this.speed);
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
  constructor(public moves: Move[] = []) { // public moves:{ [key:string]:Move }
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
    let move: Move;
    let stepsByte: number = 0 | 0;
    for(let i = 0, l = this.moves.length; i < l; i++) {
      move = this.moves[i];
      let steps = Math.min(move.steps, Math.round(move.acceleration * accelerationFactor + move.speed * time));
      let deltaSteps = (steps - move.stepped) ? 1 : 0;
      stepsByte |= deltaSteps << i;
      move.stepped += deltaSteps;
    }

    // console.log(stepsByte.toString(2));
    return stepsByte;
  }

  // test

  normalizeMoves(moves: Move[]) {
    let speedReferenceFactor = Math.min.apply(null, moves.map((move: Move) => {
      return move.stepper.speedLimit / move.steps;
    }));

    let accelerationReferenceFactor = Math.min.apply(null, moves.map((move: Move) => {
      return move.stepper.maxAcceleration / move.steps;
    }));

    for(let move of moves) {
      move.speed = speedReferenceFactor * move.steps;
      move.acceleration = accelerationReferenceFactor * move.steps;
    }
  }

  convertMovement() {
    this.normalizeMoves(this.moves);
    for(let move of this.moves) {
      // console.log(move);
      console.log(move.getMovement());
    }
    // console.log(movement.moves);
  }

  toString() {
    return this.moves.map((move: Move) => move.toString()).join(', ');
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

const ACCELERATION_LIMIT = stepsPerTurn / 2;
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

              movement.moves.push(new Move(
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

    let movement: Movement;
    let transitionSpeed: number = 0;
    for(let i = 0, l = movements.length; i < l; i++) {
      movement = movements[i];
    }

    console.log(_movements);
    return _movements;
  }

}


let speedTest = () => {
  let moves: Move[] = [];
  for(let i = 0; i < 1000000; i++) {
    moves.push(new Move(CONFIG.steppers[0], Math.random() * 1e6));
    moves[i].t = Math.random();
  }

  var timerObject = new NanoTimer();
  let a = 0;
  var microsecs = timerObject.time(() => {
    for(let move of moves) {
      a += 0.5 * move.stepper.accelerationLimit * move.t * move.t + move.stepper.speedLimit * move.t; // 73.76ns
    }
  }, '', 'n');
  console.log(microsecs / moves.length, a);
};
// speedTest();

/**
 * /--\
 * |  |
 * \--/
 */
let main = new Main(CONFIG);
let movements: Movement[] = [
  new Movement([
    new Move(CONFIG.steppers[0], stepsPerTurn),
    new Move(CONFIG.steppers[1], 0)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], stepsPerTurn),
    new Move(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], 0),
    new Move(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], -stepsPerTurn),
    new Move(CONFIG.steppers[1], stepsPerTurn)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], -stepsPerTurn),
    new Move(CONFIG.steppers[1], 0)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], -stepsPerTurn),
    new Move(CONFIG.steppers[1], -stepsPerTurn)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], 0),
    new Move(CONFIG.steppers[1], -stepsPerTurn)
  ]),
  new Movement([
    new Move(CONFIG.steppers[0], stepsPerTurn),
    new Move(CONFIG.steppers[1], -stepsPerTurn)
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
