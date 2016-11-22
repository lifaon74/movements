declare const window: any;

export type hrtime = [number, number];

let polyfillProcess = () => {

  if(typeof window !== 'undefined') {

    if(typeof process === 'undefined') {
      process = <any>{};
    }

    if(typeof process.hrtime === 'undefined') {
      window.performance = window.performance || {};
      if(typeof window.performance.now === 'undefined') {
        window.performance.now = () => (new Date()).getTime();
      }

      process.hrtime = (time?: hrtime): hrtime => {
        let t = window.performance.now() * 1e6;
        if(time) {
          t -= time[0] * 1e9 + time[1];
        }
        return [Math.floor(t / 1e9), Math.floor(t % 1e9)];
      };
    }

    if(typeof process.nextTick === 'undefined') {
      if(typeof window.setImmediate === 'undefined') {
        window.setImmediate = (callback: Function, ...args: any[]): void => {
          window.setTimeout(() => {
            callback.apply(callback, args);
          }, 0);
        };
      }

      process.nextTick = window.setImmediate;
    }

    window.process = process;
  }

};
polyfillProcess();



export interface TimeUnit {
  [key: string]: number
}

export class Timer {
  public time: [number, number];

  static units: TimeUnit = {
    'j':  86400,
    'h':  3600,
    'min':  60,
    's':  1,
    'ms':  1e-3,
    'us':  1e-6,
    'ns':  1e-9
  };

  static convert(value: number, valueUnit: string, outUnit: string): number {
    return value * (Timer.units[valueUnit] / Timer.units[outUnit]);
  }

  static getTime(time: number = 0): number {
    let t = process.hrtime();
    return (t[0] * 1e9 + t[1]) - time;
  }

  constructor() {
    this.clear();
  }



  diff(): number {
    let diff = process.hrtime(this.time);
    return diff[0] * 1e9 + diff[1];
  }

  clear(): this {
    this.time = process.hrtime();
    return this;
  }

  disp(message?: string, unit: string = 's'): this {
    let diff = this.diff();
    message = message || '';
    console.log(message + ' ' + Timer.convert(diff, 'ns', unit) + unit);
    return this;
  };

}

