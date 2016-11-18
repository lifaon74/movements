import { GCODEParser, GCODECommand } from './gcodeParser';
import { Stepper, StepperMovement } from './classes/stepper';
import { ConstrainedMovement, ConstrainedMove, ConstrainedMovementsSequence, ConstrainedMovesSequence } from './classes/kinematics';
import { Float } from './classes/float.class';


let NanoTimer = require('nanotimer');


const stepsPerTurn = 6400;//6400

const ACCELERATION_LIMIT = stepsPerTurn / 1;
const SPEED_LIMIT = stepsPerTurn / 1; // 1 turn / s
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
      // if(movements.length > 10) break;

      switch(command.command) {
        case 'G0':
        case 'G1':
          let moves: ConstrainedMove[] = [];
          // console.log(command.params);

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
            move.value              = delta;

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


  optimizeMovementsSequence(movementsSequence: ConstrainedMovementsSequence) {

  }


  reduceMovementsSequence(movementsSequence: ConstrainedMovementsSequence) {
    let precision = Float.EPSILON_32;
    // let reduced: ConstrainedMovementsSequence = new ConstrainedMovementsSequence(movementsSequence.moves.length);
    // reduced.allocated = movementsSequence.length;

    let reducedLength: number = 0;
    let readIndex: number = 1;
    let writeIndex: number = 0;
    for(let length = movementsSequence.length; readIndex < length; readIndex++) {
      if(movementsSequence.isNull(readIndex)) {
        continue;
      }

      // movementsSequence.transfer(movementsSequence, writeIndex++, readIndex);


      if(movementsSequence.merge(writeIndex, readIndex)) {
        // writeIndex++;
      }

      // let movesSequence: ConstrainedMovesSequence;
      //
      // for(let j = 0; j < movementsSequence.moves.length; j++) {
      //   movesSequence = movementsSequence.moves[j];
      //   if(!Float.isNull(movesSequence.values[i], precision)) {
      //     // if(reducedLength !== i) {
      //     //   movementsSequence.transfer(movementsSequence, reducedLength, i);
      //     // }
      //     // reducedLength++;
      //     break;
      //   }
      // }
      //

    }

    console.log(writeIndex);
    movementsSequence.length = writeIndex + 1;

    // let currentMovement: ConstrainedMovement, nextMovement: ConstrainedMovement;
    // for(let i = 0; i < movements.length - 1; i++) {
    //   currentMovement = movements[i];
    //   nextMovement    = movements[i + 1];
    //
    //   if(ConstrainedMovement.areCorrelated(currentMovement, nextMovement)) {
    //     movements.splice(i, 2, ConstrainedMovement.merge(currentMovement, nextMovement));
    //     i--;
    //   }
    // }

    return movementsSequence;
  }



  optimizeMovementsSequence_old(movements: ConstrainedMovement[]) {
    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.speedLimit, move.accelerationLimit);
    // });

    this.reduceMovementsSequence_old(movements);

    let t1 = process.hrtime();
    this.computeTransitionSpeedsOfMovementsSequence(movements);
    let t2 = process.hrtime(t1);
    console.log('optimized in', t2[0] + t2[1] / 1e9);

    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.toString());
    // });


    return this.decomposeToStepperMovements(movements);

  }



  reduceMovementsSequence_old(movements: ConstrainedMovement[]) {
    for(let i = 0; i < movements.length; i++) {
      if(movements[i].isNull()) {
        movements.splice(i, 1);
        i--;
      }
    }

    let currentMovement: ConstrainedMovement, nextMovement: ConstrainedMovement;
    for(let i = 0; i < movements.length - 1; i++) {
      currentMovement = movements[i];
      nextMovement    = movements[i + 1];

      if(ConstrainedMovement.areCorrelated(currentMovement, nextMovement)) {
        movements.splice(i, 2, ConstrainedMovement.merge(currentMovement, nextMovement));
        i--;
      }
    }
  }


  /**
   * Compute best initial and finals speeds of ConstrainedMovement
   * @param movements
   */
  computeTransitionSpeedsOfMovementsSequence(movements: ConstrainedMovement[]) {
    movements[0].initialSpeed = 0;
    for(let i = 0, length = movements.length - 1; i < length; i++) {
      movements[i].optimizeTransitionSpeeds(movements[i + 1]);
    }

    movements.forEach((movement) => movement.swapTransitionSpeeds());

    movements[movements.length - 1].initialSpeed = 0;
    for(let i = movements.length - 1; i > 1; i--) {
      movements[i].optimizeTransitionSpeeds(movements[i - 1]);
    }

    movements.forEach((movement) => movement.swapTransitionSpeeds());
  }

  decomposeToStepperMovements(movements: ConstrainedMovement[]): StepperMovement[] {
    let stepperMovements: StepperMovement[] = [];
    for(let movement of movements) {
      movement.decomposeToStepperMovements(stepperMovements);
    }
    return stepperMovements;
  }

  // executeMovements(movements: Movement[], callback: (() => any)) {
  //   let movementIndex: number = 0;
  //   let currentMovement: Movement = movements[movementIndex];
  //   let startTime = process.hrtime();
  //
  //   let loop = () => {
  //     let time = process.hrtime(startTime);
  //     let t = time[0] + time[1] / 1e9;
  //     let byte = currentMovement.tick(t);
  //     if(byte) {
  //       // console.log(byte.toString(2));
  //     }
  //
  //     if(currentMovement.ended()) {
  //       currentMovement = movements[movementIndex++];
  //       if(currentMovement) {
  //         startTime = process.hrtime();
  //       } else {
  //         return callback();
  //       }
  //     }
  //
  //     process.nextTick(loop);
  //   };
  //
  //   loop();
  // }
}


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


let buildSimpleMovementsSequence = (): ConstrainedMovementsSequence  => {
  let movementsSequence = new ConstrainedMovementsSequence(2);
  movementsSequence.length = 10;

  for(let i = 0, length = movementsSequence.length; i < length ; i++) {
    // let factor = ((i % 2) === 0) ? 1 : -1;
    // let factor = 1;
    let factor = (i >= 9) ? 0 : 1;
    // let factor = Math.random();
    let movesSequence: ConstrainedMovesSequence;
    for(let j = 0; j < movementsSequence.moves.length; j++) {
      movesSequence = movementsSequence.moves[j];
      movesSequence.values[i] = stepsPerTurn * factor;
      movesSequence.speedLimits[i] = CONFIG.steppers[j].speedLimit;
      movesSequence.accelerationLimits[i] = CONFIG.steppers[j].accelerationLimit;
      movesSequence.jerkLimits[i] = CONFIG.steppers[j].jerkLimit;
    }
  }

  return movementsSequence;
};


let main = new Main(CONFIG);

let movements = buildSimpleMovementsSequence();
console.log(movements.toString());

let reduced = main.reduceMovementsSequence(movements);

console.log(reduced.toString());

/**
 * /--\
 * |  |
 * \--/
 */
// movements = [
//   simpleMovement(stepsPerTurn, 0),
//   simpleMovement(stepsPerTurn, stepsPerTurn),
//   simpleMovement(0, stepsPerTurn),
//   simpleMovement(-stepsPerTurn, stepsPerTurn),
//   simpleMovement(-stepsPerTurn, 0),
//   simpleMovement(-stepsPerTurn, -stepsPerTurn),
//   simpleMovement(0, -stepsPerTurn),
//   simpleMovement(stepsPerTurn, -stepsPerTurn)
// ];


// let stepperMovements = main.optimizeMovementsSequence(movements);
//
// stepperMovements.forEach((movement: StepperMovement) => {
//   console.log(movement.toString());
// });




// let t1 = process.hrtime();
// main.optimizeMovementsSequence(movements);
// let t2 = process.hrtime(t1);
// console.log(t2[0] + t2[1] / 1e9);
// main.parseMovement(movements);

// let file = 'thin_tower';
// let file = 'fruit_200mm';
//
// let t1 = process.hrtime();
//
// main.parseFile('../assets/' + file + '.gcode').then((movements: ConstrainedMovement[]) => { ~20s
//
//   let t2 = process.hrtime(t1);
//   console.log('opened in', t2[0] + t2[1] / 1e9);
//
//   console.log('nb', movements.length);
//   let stepperMovements = main.optimizeMovementsSequence(movements);
//   console.log('nb final', stepperMovements.length);
//
//   t2 = process.hrtime(t2);
//   console.log('generated in', t2[0] + t2[1] / 1e9);
//
//   stepperMovements.splice(0, 10).forEach((movement: StepperMovement) => {
//     console.log(movement.toString());
//   });
// });




