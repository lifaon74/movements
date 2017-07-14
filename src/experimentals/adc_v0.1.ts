import * as rpio from 'rpio';

import { MCP3201 } from './components/MCP3201';
import { DeferredPromise } from '../classes/deferredPromise';

let Worker:any = require('webworker-threads').Worker;
declare let self:any;

let NanoTimer:any = require('nanotimer');


rpio.init({gpiomem: false});



export interface ADCConfig {
  pins: {
    cs: number,
    byte0: number;
    byte1: number;
    byte2: number;
  }
}

export class ADC {
  private worker: any;

  private deferredMap = new Map<number, DeferredPromise<any>>();
  private counter: number = 0;

  constructor(public config: ADCConfig) {
    this.initMCP3201();
    this.initWorker();
  }

  read(chanel: number): Promise<number> {
    let deferred = new DeferredPromise<any>();
    let id = this.counter++;
    this.deferredMap.set(id, deferred);
    this.worker.postMessage({
      action: 'read',
      id: id,
      chanel: chanel
    });
    return deferred.promise;
  }

  destroy() {
    this.worker.terminate();
  }


  private initMCP3201() {
    MCP3201.initSPI();
    //this.mcp3201 = new MCP3201(5);
  }

  private initWorker() {
    this.worker = new Worker(function() {
      self.addEventListener('message', (event:any) => {
        switch(event.data.action) {
          case 'read':
            self.postMessage({
              action: 'read',
              id: event.data.id,
              value: Math.random()
            });
            break;
        }
      });
    });

    this.worker.addEventListener('message', (event:any) => {
      this.resolve(event.data.id, event.data.value);
    });
  }

  private resolve(id: number, value: any) {
    let deferred = this.deferredMap.get(id);
    if(deferred) {
      this.deferredMap.delete(id);
      deferred.resolve(0);
      setImmediate(() => {
        deferred.resolve(0);
      });
    }
  }

}

let adc = new ADC({
  pins: {
    cs: 5,
    byte0: 33,
    byte1: 35,
    byte2: 37
  }
});

// adc.read();

setTimeout(() => {
  let t1 = new Date().getTime();
  Promise.all([
    adc.read(0),
    adc.read(1),
    adc.read(2),
    adc.read(3)
  ]).then((results: number[]) => {
    let t2 = new Date().getTime();
    console.log(t2 - t1, results);

    adc.destroy();
  });
}, 1000);


console.log('its ok');
//
// rpio.init({gpiomem: false});
// MCP3201.initSPI();
// // rpio.spiChipSelect(0);
// // rpio.spiSetCSPolarity(0, rpio.LOW);
// // (<any>rpio).spiSetDataMode(0);
//
// let mcp3201 = new MCP3201(5);
//
// let status: number = rpio.HIGH;
// rpio.open(3, rpio.OUTPUT, status);
//
// let timerObject = new NanoTimer();
// setInterval(() => {
//   let value: number;
//   var time = timerObject.time(() => {
//     value = mcp3201.read();
//   }, '', 'n');
//   console.log(time, value);
//   // status = (status === rpio.HIGH) ? rpio.LOW : rpio.HIGH;
//   // console.log('status', status.toString());
//   // rpio.write(3, status);
// }, 100);






