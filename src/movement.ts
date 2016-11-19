import { GCODEParser, GCODECommand } from './gcodeParser';
import { Stepper, StepperMovement } from './classes/stepper';
import { ConstrainedMovement, ConstrainedMove, ConstrainedMovementsSequence, ConstrainedMovesSequence } from './classes/kinematics';
import { Float } from './classes/float.class';


let NanoTimer = require('nanotimer');


const stepsPerTurn = 6400;//6400

const ACCELERATION_LIMIT = stepsPerTurn / 4;
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




class MovementOptimizer {
  
  static parseFile(path: string, config: ICONFIG): Promise<ConstrainedMovementsSequence> {
    return GCODEParser.parseFile(path).then((data: GCODECommand[]) => {
      return MovementOptimizer.parseGCODECommand(data, config);
    });
  }

  static parseGCODECommand(commands: GCODECommand[], config: ICONFIG): ConstrainedMovementsSequence {
    let movementsSequence: ConstrainedMovementsSequence = new ConstrainedMovementsSequence(config.steppers.length);
    movementsSequence.allocated = commands.length;
    let movementsSequenceLength: number = 0;

    let stepper: Stepper;
    let command: GCODECommand;
    let movesSequence: ConstrainedMovesSequence;
 
    let localConfig: any = {
      unitFactor: 1, // 1 for millimeters, 25.4 for inches,
      absolutePosition: true,
      position: {}
    };

    for(let i = 0; i < config.steppers.length; i++) {
      localConfig.position[config.steppers[i].name] = 0;
    }

    for(let j = 0; j < commands.length; j++) {
      command = commands[j];
      if(j > 30) break;

      switch(command.command) {
        case 'G0':
        case 'G1':
          // console.log(command.params);

          for(let i = 0; i < config.steppers.length; i++) {
            stepper                   = config.steppers[i];
            movesSequence  = movementsSequence.moves[i];
            
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
            
            movesSequence.values[movementsSequenceLength]             = delta;
            movesSequence.speedLimits[movementsSequenceLength]        = stepper.speedLimit;
            movesSequence.accelerationLimits[movementsSequenceLength] = stepper.accelerationLimit;
            movesSequence.jerkLimits[movementsSequenceLength]         = stepper.jerkLimit;
          }

          movementsSequenceLength++;
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
          for(let i = 0; i < config.steppers.length; i++) {
            stepper = config.steppers[i];
            localConfig.position[stepper.name] = command.params[stepper.name] || 0;
          }
          break;
      }
    }

    movementsSequence.length = movementsSequenceLength;

    return movementsSequence;
  }


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


  optimizeMovementsSequence(movements: ConstrainedMovement[]) {
    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.speedLimit, move.accelerationLimit);
    // });

    this.reduceMovementsSequence(movements);

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

  reduceMovementsSequence(movements: ConstrainedMovement[]) {
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


let simpleMovement = (movementsSequence: ConstrainedMovementsSequence, values: number[]) => {

  let index: number = movementsSequence.length;
  movementsSequence.length = index + 1;

  let movesSequence: ConstrainedMovesSequence;
  for(let i = 0; i < movementsSequence.moves.length; i++) {
    movesSequence = movementsSequence.moves[i];

    movesSequence.values[index] = values[i];
    movesSequence.speedLimits[index] = CONFIG.steppers[i].speedLimit;
    movesSequence.accelerationLimits[index] = CONFIG.steppers[i].accelerationLimit;
    movesSequence.jerkLimits[index] = CONFIG.steppers[i].jerkLimit;
  }
};

let buildSimpleMovementsSequence = (): ConstrainedMovementsSequence  => {
  let movementsSequence = new ConstrainedMovementsSequence(2);
  movementsSequence.length = 10;

  for(let i = 0, length = movementsSequence.length; i < length ; i++) {
    // let factor = ((i % 2) === 0) ? 1 : -1;
    let factor = 1;
    // let factor = (i >= 7 || i < 2) ? 0 : 1;
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


let getSomeData = ():Promise<ConstrainedMovementsSequence> => {

  return new Promise((resolve: any, reject: any) => {
    resolve(buildSimpleMovementsSequence());
  });

  // return new Promise((resolve: any, reject: any) => {
  //   let movements = new ConstrainedMovementsSequence(2)
  //   simpleMovement(movements, [stepsPerTurn, 0]);
  //   simpleMovement(movements, [stepsPerTurn, stepsPerTurn]);
  //   simpleMovement(movements, [0, stepsPerTurn]);
  //   simpleMovement(movements, [-stepsPerTurn, stepsPerTurn]);
  //   simpleMovement(movements, [-stepsPerTurn, 0]);
  //   simpleMovement(movements, [-stepsPerTurn, -stepsPerTurn]);
  //   simpleMovement(movements, [0, -stepsPerTurn]);
  //   simpleMovement(movements, [stepsPerTurn, -stepsPerTurn]);
  //   resolve(movements);
  // });


  // return MovementOptimizer.parseFile('../assets/' + 'thin_tower' + '.gcode', CONFIG);
  // return MovementOptimizer.parseFile('../assets/' + 'fruit_200mm' + '.gcode', CONFIG);
};


let t1 = process.hrtime();
getSomeData().then((movementsSequence: ConstrainedMovementsSequence) => {
  let t2 = process.hrtime(t1);
  console.log('opened in', t2[0] + t2[1] / 1e9);

  // console.log(movementsSequence.toString());

  t2 = process.hrtime();
  // movementsSequence.reduce();
  t2 = process.hrtime(t2);
  console.log('reduced in', t2[0] + t2[1] / 1e9);

  t2 = process.hrtime();
  movementsSequence.optimizeTransitionSpeeds();
  t2 = process.hrtime(t2);
  console.log('optimized in', t2[0] + t2[1] / 1e9);

  console.log(movementsSequence.toString());
  // console.log(movementsSequence.toString(-1, 'speeds'));
});







//
// main.optimizeMovementsSequence(movements);
// let t2 = process.hrtime(t1);
// console.log(t2[0] + t2[1] / 1e9);
// main.parseMovement(movements);


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




