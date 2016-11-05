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
setInterval(() => {
  let value: number;
  var time = timerObject.time(() => {
    value = mcp3201.read();
  }, '', 'n');
  console.log(time, value);
  // status = (status === rpio.HIGH) ? rpio.LOW : rpio.HIGH;
  // console.log('status', status.toString());
  // rpio.write(3, status);
}, 100);






