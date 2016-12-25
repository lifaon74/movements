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
  spi.initBuffers(0);

  let dir: number = 0b00000000;
  let value: number = 0;
  let time = process.hrtime();
  let loop = () => {
    value++;
    if(value >= 6400) {
      let t = process.hrtime(time);
      value = 0;
      dir = dir ? 0b00000000 : 0b11111111;
      console.log(t[0] * 1e6 + t[1] / 1e3 );
      time = process.hrtime();
    }

    spi.outBuffer = new Buffer([
      dir,
      0b00001111, // steps
      0b00000000  // enable // active low
    ]);

    spi.flush();
    rpio.usleep(25);

    spi.outBuffer = new Buffer([
      dir,
      0b00000000, // steps
      0b00000000
    ]);
    spi.flush();
    rpio.usleep(25);

    process.nextTick(loop);
  };

  loop();

};


driverTest();




