import * as rpio from 'rpio';

// import { MCP3201 } from './components/MCP3201';
import { MCP3008 } from './components/MCP3008';
import { SPIController } from './components/SPIController';

import { ConstrainedMovementsSequence, StepperMovementsSequence, StepperMovesSequence } from './classes/kinematics';
import { CNCController, CONFIG } from './movement';
import { Timer } from './classes/timer.class';

let NanoTimer:any = require('nanotimer');


rpio.init({gpiomem: false});


let ADCTest = () => {
  MCP3008.initSPI();
  // rpio.spiChipSelect(0);
  // rpio.spiSetCSPolarity(0, rpio.LOW);
  // (<any>rpio).spiSetDataMode(0);

  let adc = new MCP3008(7);

  let status: number = rpio.HIGH;
  rpio.open(3, rpio.OUTPUT, status);

  let timerObject = new NanoTimer();

  let loop = () => {
    let value: number;
    let t1 = process.hrtime();
    adc.read(0, () => {
      let t2 = process.hrtime(t1);
      console.log(t2[0] / 1e9 + t2[1]);
    });
    // let time = timerObject.time(() => {
    //   for(let i = 0; i < 100000; i++) {
    //     value += adc.read();
    //   }
    // }, '', 'u');
    // console.log(time, value);
    // (<any>rpio).msleep(100);
    // process.nextTick(loop);
  };


  loop();
};

let SPISpeedTest = () => {

  SPIController.initSPI();
  let spi = new SPIController(7);
  spi.initBuffers(3);

  let t1 = process.hrtime();
  for(let i = 0; i < 1000000; i++) { // 11.47 => 2Mhz, 7 => 10Mhz, 5 => 20Mhz, 3.47 => 200Mhz
    // div64 => 7209 vs 5234
    // div32 => 5145 vs 3060
    // div16 => 4032 vs 2139
    // variable clock divider 16~256 => 4918
    rpio.spiSetClockDivider(16);
    spi.flush();
    rpio.spiSetClockDivider(256);
  }
  let t2 = process.hrtime(t1);
  let nano = t2[0] * 1e9 + t2[1];
  console.log(nano / 1e6);
};

let driverTest = () => {
  console.log('enter');
  SPIController.initSPI();
  let spi = new SPIController(7);
  spi.initBuffers(3);
  spi.outBuffer[0] = 0b00000000;
  spi.outBuffer[1] = 0b11111111;
  spi.outBuffer[2] = 0b00000000;

  let dir: number = 0b00000000;
  let stepping: boolean = false;
  let value: number = 0;

  // spi.outBuffer => dir, steps, enable (active low)
  let time = process.hrtime();
  let loop = () => {
    if(stepping) {
      spi.outBuffer[1] = 0b11111111;
      stepping = false;
      spi.flush();
    } else {
      value++;
      if(value >= 3200) {
        let t = process.hrtime(time);
        value = 0;
        dir = dir ? 0b00000000 : 0b11111111;
        let elapsed = t[0] * 1e6 + t[1] / 1e3;
        console.log(elapsed / 3200);
        time = process.hrtime();
      }

      spi.outBuffer[0] = dir;
      spi.outBuffer[1] = 0b00000000;
      stepping = true;

      spi.flush();
    }

    rpio.usleep(10);
    process.nextTick(loop);
  };

  process.nextTick(loop);

};

class RASPController {
  public startTime: number;
  public stepperMovementsSequence: StepperMovementsSequence;
  public index: number;
  public spi: SPIController;
  public onEndCallback: (() => any);
  public stepping: boolean;

  runOutOfTime = 0;
  missedSteps = 0;

  constructor() {}

  run(stepperMovementsSequence: StepperMovementsSequence, onEndCallback: (() => any) = (() => { /* noop*/ }) ) {
    this.stepperMovementsSequence = stepperMovementsSequence;
    this.index  = 0;
    this.spi = new SPIController(7);
    this.spi.initBuffers(3);
    this.spi.outBuffer[0] = 0b00000000;
    this.spi.outBuffer[1] = 0b11111111;
    this.spi.outBuffer[2] = 0b00000000;
    this.spi.flush();
    this.stepping = false;

    this.onEndCallback = onEndCallback;

    let time = process.hrtime();
    this.startTime = time[0] + time[1] / 1e9;
    this.loop();
  }

  private loop() {
    while(true) {
      if(this.stepping) {
        this.spi.outBuffer[1] = 0b11111111;
        this.stepping = false;
        this.spi.flush();
      } else {
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


        this.spi.outBuffer[0] = directionByte;
        // this.spi.outBuffer[1] = 0b11111111;
        this.spi.outBuffer[1] = stepsByte ^ 0b11111111;
        this.stepping = true;

        this.spi.flush();

        if(finished) {
          this.index++;
          this.startTime = currentTime;
        }
      }

      if(this.index < this.stepperMovementsSequence._length) {
        // process.nextTick(() => this.loop());
      } else {
        // debug only
        console.log('missed', this.missedSteps);
        console.log('run out of time', this.runOutOfTime);

        this.onEndCallback();
        break;
      }
    }
  }
}

let moves = () => {
  let timer = new Timer();

  let getMovements = (): Promise<StepperMovementsSequence> => {
    // let file = 'thin_tower';
    // let file = 'fruit_200mm';
    // let file = 'foots';
    // let file = 'CircleCalibrationSmallDetail';
    let file = 'CalibrationBridge3';

    return CNCController.parseFile('../assets/' + file + '.gcode', CONFIG)
      .then((movementsSequence: ConstrainedMovementsSequence) => {
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

        return stepperMovementsSequence;
      });
  };

  getMovements().then((stepperMovementsSequence: StepperMovementsSequence) => {
    let controller = new RASPController();
    controller.run(stepperMovementsSequence);
  });
};

// SPISpeedTest();
moves();
// driverTest();




