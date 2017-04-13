import * as fs from 'fs';
import { GCODEHelper, GCODECommand } from './gcodeHelper';
import { Stepper } from './classes/stepper';
import {
  ConstrainedMovementsSequence, ConstrainedMovesSequence, StepperMovementsSequence,
  StepperMovesSequence, DynamicSequence, OptimizedMovementsSequence
} from './classes/kinematics';
import { Timer } from './classes/timer.class';
import { Shell } from './classes/shell.class';


// node --inspect --debug-brk movement.js

// let NanoTimer = require('nanotimer');

const MOTOR_STEPS = 200;
const MICROSTEPS = 16;
const stepsPerTurn = MOTOR_STEPS * MICROSTEPS;//6400  => /160


const ACCELERATION_LIMIT = stepsPerTurn / (1 / 16);
const SPEED_LIMIT = stepsPerTurn / (1 / 4); // 1 turn / s | max 6.25
const JERK_LIMIT = stepsPerTurn / (16 / 1);

const IS_BROWSER = (typeof window !== 'undefined');

export const MoveType = {
  UNDEFINED: 'undefined',
  MOVE: 'move',
  SKIRT: 'skirt',
  WALL_OUTER: 'wall-outer',
  WALL_INNER: 'wall-inner',
  FILL: 'fill',
  SUPPORT: 'support',
  BRIDGE: 'bridge'
};

export const MatterSliceMoveTypes: { [key: string]: string } = {
  'SKIRT': MoveType.SKIRT,
  'WALL-OUTER': MoveType.WALL_OUTER,
  'WALL-INNER': MoveType.WALL_INNER,
  'FILL': MoveType.FILL,
  'SUPPORT': MoveType.SUPPORT,
  'BRIDGE': MoveType.BRIDGE
};


export class PWMController {
  constructor(public analogChannel: number,
              public pwmChannel: number,
              public getPWM: (analogValue: number, targetValue: number, currentPWMValue: number) => number) {
  }
}

const STEPPERS: Stepper[] = [
  new Stepper('x', 0, 0, 1, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, stepsPerTurn / 40), // 160
  new Stepper('y', 1, 2, 3, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, stepsPerTurn  / 40),
  new Stepper('z', 2, 4, 5, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, (stepsPerTurn * 5.21)  / 40), // 3316.36
  new Stepper('e', 3, null, null, 1e10, SPEED_LIMIT, JERK_LIMIT, 160 / 6400 * stepsPerTurn),
];

export interface ICONFIG {
  indexSpeedOn: string;
  steppers: Stepper[];
  PWMControllers: PWMController[];
}

export const CONFIG: ICONFIG = {
  indexSpeedOn: 'max',
  steppers: STEPPERS,
  PWMControllers: [
    new PWMController(0, 0, (analogValue: number, targetValue: number, currentPWMValue: number) => {
      return (targetValue / analogValue) * currentPWMValue;
    })
  ]
};


export class GCODEOptimizer {

  static typeRegExp: RegExp = new RegExp('^TYPE:(.+)$');

  static getMatterSliceMoveType(command: GCODECommand): any {
    if(command.comment) {
      let match = this.typeRegExp.exec(command.comment);
      if(match) {
        let type: string = match[1];
        if(type in MatterSliceMoveTypes) {
          return MatterSliceMoveTypes[type];
        } else {
          Shell.warn('Unknown type : ' + type);
          return MoveType.UNDEFINED;
        }
      }
    }
    return null;
  }

  static layerRegExp: RegExp = new RegExp('^LAYER:(\\d+)$');

  static getMatterSliceLayer(command: GCODECommand): any {
    if(command.comment) {
      let match = this.layerRegExp.exec(command.comment);
      if(match) {
        let layer: number = parseInt(match[1]);
        if(isNaN(layer)) {
          Shell.warn('Unknown layer : ' + layer);
        } else {
          return layer;
        }
      }
    }
    return null;
  }

  static optimizeFile(path: string, config: ICONFIG): Promise<any> {
    let timer = new Timer();
    return GCODEHelper.parseFilePromise(path)
      .then((data: GCODECommand[]) => {
        timer.disp('opened in', 'ms');

        timer.clear();
        const movementsSequence: ConstrainedMovementsSequence = this.parseGCODECommands(data, config);
        timer.disp('converted in', 'ms');

        let optimizedMovementsSequence: OptimizedMovementsSequence = this.optimizeConstrainedMovementsSequence(movementsSequence);

        let time = 0, x = 0, y = 0;
        for(let i = 0, length = optimizedMovementsSequence._buffers.times.length; i < length; i++) {
          time += optimizedMovementsSequence._buffers.times[i];
          x += optimizedMovementsSequence.moves[0]._buffers.values[i];
          y += optimizedMovementsSequence.moves[1]._buffers.values[i];
        }

        console.log(optimizedMovementsSequence.toString());
        // console.log(optimizedMovementsSequence.toString(-1, 'times'));
        console.log('length', optimizedMovementsSequence.length, 'time', time, 'x', x, 'y', y);
        // console.log(optimizedMovementsSequence.times);

      });
  }

  static parseGCODECommands(commands: GCODECommand[], config: ICONFIG): ConstrainedMovementsSequence {
    let movementsSequence: ConstrainedMovementsSequence = new ConstrainedMovementsSequence(config.steppers.length);
    movementsSequence.require(commands.length);
    let movementsSequenceLength: number = 0;

    let stepper: Stepper;
    let command: GCODECommand;
    let movesSequence: ConstrainedMovesSequence;

    let localConfig: any = {
      unitFactor: 1, // 1 for millimeters, 25.4 for inches,
      absolutePosition: true,
      position: {},
      speed: 1e4, // mm/s
      type: MoveType.UNDEFINED,
      layer: 0
    };

    for(let i = 0; i < config.steppers.length; i++) {
      localConfig.position[config.steppers[i].name] = 0;
    }

    for(let j = 0; j < commands.length; j++) {
      command = commands[j];
      // console.log(command);
      // if(j > 30) break;

      let type: string = this.getMatterSliceMoveType(command);
      if(type) localConfig.type = type;

      switch(command.command) {
        case 'G0':
        case 'G1':
          // console.log(command.params);
          if(command.params['f']) {
            localConfig.speed = (command.params['f'] * localConfig.unitFactor) / 60;
          }

          for(let i = 0; i < config.steppers.length; i++) {
            stepper = config.steppers[i];
            movesSequence = <ConstrainedMovesSequence>movementsSequence.moves[i];

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

            movesSequence._buffers.values[movementsSequenceLength] = delta;
            movesSequence._buffers.speedLimits[movementsSequenceLength] = Math.min(stepper.speedLimit, localConfig.speed * stepper.stepsPerMm);
            movesSequence._buffers.accelerationLimits[movementsSequenceLength] = stepper.accelerationLimit;
            movesSequence._buffers.jerkLimits[movementsSequenceLength] = stepper.jerkLimit;
          }
          movementsSequence._buffers.indices[movementsSequenceLength] = j;
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

  static optimizeConstrainedMovementsSequence(movementsSequence: ConstrainedMovementsSequence): OptimizedMovementsSequence {
    let timer = new Timer();
    timer.clear();
    movementsSequence.reduce();
    timer.disp('reduced in', 'ms');

    timer.clear();
    let optimizedMovementsSequence: OptimizedMovementsSequence = movementsSequence.optimize();
    timer.disp('optimized in', 'ms');

    // optimizedMovementsSequence.compact();
    optimizedMovementsSequence.roundValues();
    optimizedMovementsSequence.reduce();

    return optimizedMovementsSequence;
  }


  static createAGCODEFile(path: string, movementsSequence: OptimizedMovementsSequence, options: any = {}): Promise<any> {
    return new Promise((resolve: any, reject: any) => {

      const file = fs.openSync(path, 'w+');

      // let buf = Buffer.from([0x10]);
      // for(let i = 0; i < 1e9; i++) {
      //   fs.write(file, buf);
      // }
      // console.log('write all');
      //
      // return;

      let movesLength: number = movementsSequence.moves.length;

      if(options.binary) {
        let times = Buffer.from(movementsSequence._buffers.times.buffer);
        let initialSpeeds = Buffer.from(movementsSequence._buffers.initialSpeeds.buffer);
        let accelerations = Buffer.from(movementsSequence._buffers.accelerations.buffer);

        let moves: Buffer[] = [];
        for(let j = 0; j < movesLength; j++) {
          moves[j] = Buffer.from(movementsSequence.moves[j]._buffers.values.buffer);
        }

        for(let i = 0, length = movementsSequence.length; i < length; i++) {
          let a = i * 8;
          let b = a + 8;

          fs.writeSync(file, Buffer.from([0x10]));
          fs.writeSync(file, times.slice(a, b));
          fs.writeSync(file, initialSpeeds.slice(a, b));
          fs.writeSync(file, accelerations.slice(a, b));

          a = i * 4;
          b = a + 4;
          for(let j = 0; j < movesLength; j++) {
            fs.writeSync(file, moves[j].slice(a, b));
          }
        }
      } else {
        for(let i = 0, length = movementsSequence.length; i < length; i++) {
          fs.writeSync(file, 'G0 ');
          // fs.writeSync(file, 'I' + stepperMovementsSequence._buffers.indices[i] + ' ');
          fs.writeSync(file, 'T' + movementsSequence._buffers.times[i] + ' ');
          fs.writeSync(file, 'S' + movementsSequence._buffers.initialSpeeds[i] + ' ');
          fs.writeSync(file, 'A' + movementsSequence._buffers.accelerations[i] + ' ');

          let move: DynamicSequence;
          for(let j = 0; j < movesLength; j++) {
            move = movementsSequence.moves[j];
            fs.writeSync(file, CONFIG.steppers[j].name.toUpperCase() + move._buffers.values[i] + ' ');
          }
          fs.writeSync(file, '\n');
        }
      }
      console.log('write all');
      resolve();
    });
  }

}


let start = () => {
  GCODEOptimizer.optimizeFile('../assets/' + 'circle' + '.gcode', CONFIG);
};


if(IS_BROWSER) {
  window.onload = start;
} else {
  start();
}







