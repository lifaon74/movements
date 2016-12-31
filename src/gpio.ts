import * as rpio from 'rpio';

// import { MCP3201 } from './components/MCP3201';
import { MCP3008 } from './components/MCP3008';
import { SPIController } from './components/SPIController';

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


let driverTest = () => {
  console.log('enter');
  SPIController.initSPI();
  let spi = new SPIController(7);
  spi.initBuffers(3);

  let dir: number = 0b00000000;
  let stepping: boolean = false;
  let value: number = 0;

  // spi.outBuffer => dir, steps, enable (active low)
  let time = process.hrtime();
  let loop = () => {
    if(stepping) {
      spi.outBuffer[1] = 0b00000000;
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
      spi.outBuffer[1] = 0b11111111;
      stepping = true;

      spi.flush();
    }

    rpio.usleep(10);
    process.nextTick(loop);
  };

  process.nextTick(loop);

};


driverTest();




