import * as rpio from 'rpio';

import { MCP3201 } from './components/MCP3201';

let NanoTimer:any = require('nanotimer');


rpio.init({gpiomem: false});


MCP3201.initSPI();
// rpio.spiChipSelect(0);
// rpio.spiSetCSPolarity(0, rpio.LOW);
// (<any>rpio).spiSetDataMode(0);

let mcp3201 = new MCP3201(5);

let status: number = rpio.HIGH;
rpio.open(3, rpio.OUTPUT, status);

let timerObject = new NanoTimer();

let loop = () => {
  let value: number;
  let time = timerObject.time(() => {
    value = mcp3201.read();
  }, '', 'u');
  console.log(time, value);
  // (<any>rpio).msleep(100);
  process.nextTick(loop);
};


loop();






