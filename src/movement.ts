import { GCODEParser, GCODECommand } from './gcodeParser';
import { Stepper } from './classes/stepper';
import {
  ConstrainedMovementsSequence, ConstrainedMovesSequence, StepperMovementsSequence,
  StepperMovesSequence
} from './classes/kinematics';
import { Timer } from './classes/timer.class';

// node --inspect --debug-brk movement.js

// let NanoTimer = require('nanotimer');

const MOTOR_STEPS = 200;
const MICROSTEPS = 16;
const stepsPerTurn = MOTOR_STEPS * MICROSTEPS;//6400  => /160

const ACCELERATION_LIMIT = stepsPerTurn / (1 / 4);
const SPEED_LIMIT = stepsPerTurn / (1/2); // 1 turn / s | max 6.25
const JERK_LIMIT = stepsPerTurn / (16/1);

const IS_BROWSER = (typeof window !== 'undefined');



export class PWMController {
  constructor(public analogChannel: number,
              public pwmChannel: number,
              public getPWM: (analogValue: number, targetValue: number, currentPWMValue: number) => number) {
  }
}

export interface ICONFIG {
  steppers: Stepper[],
  PWMControllers: PWMController[]
}

export const CONFIG: ICONFIG = <ICONFIG>{
  steppers: [
    new Stepper('x', 0, 0, 1, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 160 / 6400 * stepsPerTurn), // 160
    new Stepper('y', 1, 2, 3, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 160 / 6400 * stepsPerTurn),
    new Stepper('z', 2, 4, 5, ACCELERATION_LIMIT, SPEED_LIMIT, JERK_LIMIT, 160 / 6400 * stepsPerTurn), // 3316.36
    new Stepper('e', 3, null, null, 1e10, SPEED_LIMIT, JERK_LIMIT, 160 / 6400 * stepsPerTurn),
  ],
  PWMControllers: [
    new PWMController(0, 0, (analogValue: number, targetValue: number, currentPWMValue: number) => {
      return (targetValue / analogValue) * currentPWMValue;
    })
  ]
};

class CommandsGrouper {
}

export class CNCController {

  static parseFile(path: string, config: ICONFIG): Promise<ConstrainedMovementsSequence> {
    return GCODEParser.parseFile(path).then((data: GCODECommand[]) => {
      return CNCController.parseGCODECommand(data, config);
    });
  }

  static parseGCODECommand(commands: GCODECommand[], config: ICONFIG): ConstrainedMovementsSequence {
    let movementsSequence: ConstrainedMovementsSequence = new ConstrainedMovementsSequence(config.steppers.length);
    movementsSequence.require(commands.length);
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
      // if(j > 30) break;

      switch(command.command) {
        case 'G0':
        case 'G1':
          // console.log(command.params);
          for(let i = 0; i < config.steppers.length; i++) {
            stepper        = config.steppers[i];
            movesSequence  = <ConstrainedMovesSequence>movementsSequence.moves[i];
            
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

            movesSequence._buffers.values[movementsSequenceLength]             = delta;
            movesSequence._buffers.speedLimits[movementsSequenceLength]        = stepper.speedLimit;
            movesSequence._buffers.accelerationLimits[movementsSequenceLength] = stepper.accelerationLimit;
            movesSequence._buffers.jerkLimits[movementsSequenceLength]         = stepper.jerkLimit;
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

  static buildTemperaturePWMController(): PWMController { // TODO
    return new PWMController(0, 0, (analogValue: number, targetValue: number, currentPWMValue: number) => {
      return (targetValue / analogValue) * currentPWMValue;
    });
  }

  public startTime: number;
  public stepperMovementsSequence: StepperMovementsSequence;
  public index: number;
  public buffer: Uint8Array;
  public onEndCallback: (() => any);

  public times: Float64Array;
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public imageData: ImageData;
  public color: [number, number, number];
  public directDraw: boolean = true;


  public position: any = {
    x: 0,
    y: 0
  };

  runOutOfTime = 0;
  missedSteps = 0;

  constructor(public config: ICONFIG) {
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 800;
    this.canvas.style.backgroundColor = 'black';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'red';
    this.color = [255, 255, 255];

    if(this.directDraw) {
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    } else {
      this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

  }
  
  drawPoint(x: number, y: number) {
    if(this.directDraw) {
      this.ctx.fillRect(x, y, 1, 1);
    } else {
      x -= this.canvas.width / 2;
      y += this.canvas.height / 2;
      let i = (Math.round(x) + Math.round(y) * this.imageData.width) * 4;
      this.imageData.data[i + 0] = this.color[0];
      this.imageData.data[i + 1] = this.color[1];
      this.imageData.data[i + 2] = this.color[2];
      this.imageData.data[i + 3] = 255;
    }
  }

  
  run(stepperMovementsSequence: StepperMovementsSequence, onEndCallback: (() => any) = (() => { /* noop*/ }) ) {
    this.stepperMovementsSequence = stepperMovementsSequence;
    this.index  = 0;
    this.buffer = new Uint8Array([
      0b00000000, // steps
      0b00000000, // directions
      0b11111111, // enable
      0b00000000, // pwm
    ]);

    this.onEndCallback = onEndCallback;


    // debug only
    this.times = new Float64Array(stepperMovementsSequence.length);

    // debug only
    if(IS_BROWSER) {
      this.initCanvas();
    }

    let time = process.hrtime();
    this.startTime = time[0] + time[1] / 1e9;
    this.loop();
  }

  private loop() {
    let time = process.hrtime();
    let currentTime: number = time[0] + time[1] / 1e9;
    let elapsedTime: number = (currentTime - this.startTime);

    let accelerationFactor: number = elapsedTime * elapsedTime * 0.5;
    let move: StepperMovesSequence;
    let value: number;
    let distance: number;
    let position: number;
    let expectedPosition: number;
    let deltaSteps: number;
    let stepsByte: number = 0 | 0;
    let directionByte: number = 0 | 0;
    let finished: boolean = true;


    for(let i = 0; i < this.stepperMovementsSequence.moves.length; i++) {
      move      = this.stepperMovementsSequence.moves[i];
      value     = move._buffers.values[this.index];
      distance  = Math.abs(value);
      position  = move._buffers.positions[this.index];

      if(position < distance) {
        finished = false;

        if(elapsedTime > this.stepperMovementsSequence._buffers.times[this.index]) {
          this.runOutOfTime++; // debug only
          deltaSteps = 1;
        } else {
          expectedPosition = Math.floor(Math.min(1,
            this.stepperMovementsSequence._buffers.accelerations[this.index] * accelerationFactor +
            this.stepperMovementsSequence._buffers.initialSpeeds[this.index] * elapsedTime
          ) * distance);

            // debug only
          if(expectedPosition - position > 2) {
            this.missedSteps++;
          }

          deltaSteps = (expectedPosition - position) ? 1 : 0;
        }
      } else {
        deltaSteps = 0;
      }

      move._buffers.positions[this.index] += deltaSteps;
      stepsByte |= deltaSteps << i;
      directionByte |= ((Math.sign(value) < 0) ? 0 : 1)  << i;
      // console.log(steps, value, position, deltaSteps);

    }

    this.buffer[0] = stepsByte;
    this.buffer[1] = directionByte;


    // debug only
    if(stepsByte & 0b00000001) {
      this.position.x += (directionByte & 0b00000001) ? 1 : - 1;
    }

    // debug only
    if(stepsByte & 0b00000010) {
      this.position.y += (directionByte & 0b00000010) ? 1 : - 1;
    }

    // debug only
    if(stepsByte & 0b00000100) {
      if(IS_BROWSER && this.directDraw) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    if(finished) {
      this.times[this.index] = elapsedTime; // debug only
      this.index++;
      this.startTime = currentTime;

      // debug only
      this.color = [Math.floor(Math.random() * 255),  Math.floor(Math.random() * 255),  Math.floor(Math.random() * 255)];

      // debug only
      if(IS_BROWSER && this.directDraw) {
        this.ctx.fillStyle = 'rgb(' +
          this.color[0] + ', ' +
          this.color[1] + ', ' +
          this.color[2] + ')';
      }
    }

    // debug only
    if(IS_BROWSER && stepsByte) {
      // console.log(this.position);
      this.drawPoint(this.position.x / stepsPerTurn * 40, this.position.y / stepsPerTurn * 40);
    }

    if(this.index < this.stepperMovementsSequence._length) {
      if(IS_BROWSER && this.directDraw) { // debug only
        setTimeout(() => this.loop(), 0);
      } else {
        process.nextTick(() => this.loop());
      }
    } else {
      // debug only
      if(IS_BROWSER && !this.directDraw) {
        this.ctx.putImageData(this.imageData, 0, 0);
      }

      // debug only
      console.log('missed', this.missedSteps);
      console.log('run out of time', this.runOutOfTime);
      console.log('pos', this.position);

      // debug only
      let time = 0;
      for(let i = 0, length = this.times.length; i < length; i++) {
        time += this.times[i];
      }
      console.log('time', time);
      // console.log(this.times);

      this.onEndCallback();
    }
  }

  private stepLoop() {

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
    movesSequence = <ConstrainedMovesSequence>movementsSequence.moves[i];

    movesSequence._buffers.values[index] = values[i];
    movesSequence._buffers.speedLimits[index] = CONFIG.steppers[i].speedLimit;
    movesSequence._buffers.accelerationLimits[index] = CONFIG.steppers[i].accelerationLimit;
    movesSequence._buffers.jerkLimits[index] = CONFIG.steppers[i].jerkLimit;
  }
};

let buildLinearMovementsSequence = (): ConstrainedMovementsSequence  => {
  let movementsSequence = new ConstrainedMovementsSequence(2);
  movementsSequence.length = 5;

  for(let i = 0, length = movementsSequence.length; i < length ; i++) {
    // let factor = ((i % 2) === 0) ? 1 : -1;
    let factor = 1;
    // let factor = (i >= 7 || i < 2) ? 0 : 1;
    // let factor = (i >= 5) ? -1 : 1;
    // let factor = Math.random();
    let movesSequence: ConstrainedMovesSequence;
    for(let j = 0; j < movementsSequence.moves.length; j++) {
      movesSequence = <ConstrainedMovesSequence>movementsSequence.moves[j];
      movesSequence._buffers.values[i] = stepsPerTurn * factor;
      movesSequence._buffers.speedLimits[i] = CONFIG.steppers[j].speedLimit;
      movesSequence._buffers.accelerationLimits[i] = CONFIG.steppers[j].accelerationLimit;
      movesSequence._buffers.jerkLimits[i] = CONFIG.steppers[j].jerkLimit;
    }
  }

  return movementsSequence;
};

let buildCircleMovementsSequence = (): ConstrainedMovementsSequence  => {
  let movementsSequence = new ConstrainedMovementsSequence(2);
  movementsSequence.length = 100;
  let radius = stepsPerTurn * 2;

  for(let i = 0, length = movementsSequence.length; i < length ; i++) {
    let a0 = (Math.PI * 2 * i / length);
    let a1 = (Math.PI * 2 * (i + 1) / length);

    let movesSequence: ConstrainedMovesSequence;
    for(let j = 0; j < movementsSequence.moves.length; j++) {
      movesSequence = <ConstrainedMovesSequence>movementsSequence.moves[j];
      movesSequence._buffers.values[i] = radius * ((j === 0) ? (Math.cos(a1) - Math.cos(a0)) : (Math.sin(a1) - Math.sin(a0)));
      movesSequence._buffers.speedLimits[i] = CONFIG.steppers[j].speedLimit;
      movesSequence._buffers.accelerationLimits[i] = CONFIG.steppers[j].accelerationLimit;
      movesSequence._buffers.jerkLimits[i] = CONFIG.steppers[j].jerkLimit;
    }
  }

  return movementsSequence;
};


let getSomeData = ():Promise<ConstrainedMovementsSequence> => {

  // return new Promise((resolve: any, reject: any) => {
  //   resolve(buildLinearMovementsSequence());
  // });

  // return new Promise((resolve: any, reject: any) => {
  //   resolve(buildCircleMovementsSequence());
  // });

  // return new Promise((resolve: any, reject: any) => {
  //   let movements = new ConstrainedMovementsSequence(2);
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


  return CNCController.parseFile('../assets/' + 'thin_tower' + '.gcode', CONFIG);
  // return CNCController.parseFile('../assets/' + 'fruit_200mm' + '.gcode', CONFIG);

  // return new Promise((resolve: any, reject: any) => {
  //   let dropElement = document.body;
  //
  //   dropElement.addEventListener('dragover', (event: DragEvent) => {
  //     event.stopPropagation();
  //     event.preventDefault();
  //     event.dataTransfer.dropEffect = 'copy';
  //     return false;
  //   });
  //
  //   dropElement.addEventListener('drop', (event: DragEvent) => {
  //     event.stopPropagation();
  //     event.preventDefault();
  //
  //     let files: FileList = event.dataTransfer.files;
  //     if(files.length > 0) {
  //       let file: File = files[0];
  //       let reader = new FileReader();
  //       reader.addEventListener('load', (event: any) => {
  //         resolve(CNCController.parseGCODECommand(GCODEParser.parse(event.target.result), CONFIG));
  //       });
  //
  //       reader.addEventListener('error', (error: any) => {
  //         reject(error);
  //       });
  //
  //       reader.readAsText(file);
  //     }
  //
  //     return false;
  //   });
  //
  // });
};


let start = () => {
  let timer = new Timer();
  getSomeData().then((movementsSequence: ConstrainedMovementsSequence) => {
    timer.disp('opened in', 'ms');

    // console.log(movementsSequence.toString());

    timer.clear();
    movementsSequence.reduce();
    timer.disp('reduced in', 'ms');

    timer.clear();
    let optimizedMovementsSequence = movementsSequence.optimize();
    timer.disp('optimized in', 'ms');

    // console.log(optimizedMovementsSequence._buffers.indices.subarray(0, 30));

    // optimizedMovementsSequence.compact();

    let time = 0, x = 0, y = 0;
    for(let i = 0, length = optimizedMovementsSequence._buffers.times.length; i < length; i++) {
      time += optimizedMovementsSequence._buffers.times[i];
      x += optimizedMovementsSequence.moves[0]._buffers.values[i];
      y += optimizedMovementsSequence.moves[1]._buffers.values[i];
    }

    // console.log(optimizedMovementsSequence.toString());
    // console.log(optimizedMovementsSequence.toString(-1, 'times'));
    console.log('length', optimizedMovementsSequence.length, 'time', time, 'x', x, 'y', y);
    // console.log(optimizedMovementsSequence.times);

    timer.clear();
    let stepperMovementsSequence = optimizedMovementsSequence.toStepperMovementsSequence();

    stepperMovementsSequence.reduce();
    stepperMovementsSequence.compact();

    timer.disp('converted in', 'ms');

    // console.log(stepperMovementsSequence.toString());
    // console.log(stepperMovementsSequence.times);

    // let controller = new CNCController(CONFIG);
    // controller.run(stepperMovementsSequence);

    // console.log(movementsSequence.toString(-1, 'speeds'));
  });
};


// if(IS_BROWSER) {
//   window.onload = start;
// } else {
//   start();
// }







