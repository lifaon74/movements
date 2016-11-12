import * as rpio from 'rpio';

// import { MCP3201 } from './components/MCP3201';
import { MCP3008 } from './components/MCP3008';

let NanoTimer:any = require('nanotimer');


rpio.init({gpiomem: false});


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






