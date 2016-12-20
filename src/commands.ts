enum COMMANDS {
  NONE,
  CONFIG,
  MOVEMENT,
  HOME,
  PWM,
  TEMPERATURE_FUNCTION,
  TEMPERATURE
}

export interface ITemperatureController {
  analogChannel: number;
  pwmChannel: number;
  getTemperature: (analogValue: number) => number;
}

export interface IPrinterConfig {
  temperaturesControllers: ITemperatureController[];
}

declare type WriteStream = (value: number) => any;
declare type ReadStream = () => number;

export function float32ToStream(float: number, write: WriteStream) {
  let array: Uint8Array = new Uint8Array(new Float32Array([float]).buffer);
  for(let i = 0; i < array.length; i++) {
    write(array[i]);
  }
}

export function streamToFloat32(read: ReadStream): number {
  let array: Uint8Array = new Uint8Array(4);
  for(let i = 0; i < array.length; i++) {
    array[i] = read();
  }

  return new Float32Array(array.buffer)[0];
}


export function uint32ToStream(uint: number, write: WriteStream) {
  for(let i = 0; i < 4; i++) {
    write((uint >> (i * 4)) & 0b11111111);
  }
}

export function streamToUint32(read: ReadStream): number {
  let uint: number = 0;
  for(let i = 0; i < 4; i++) {
    uint |= read() << (i * 4);
  }
  return uint;
}


/**
 * MOVEMENT
 *
 * [
 *    MOVEMENT{uint8}, time{float32}, initialSpeed{float32}, acceleration{float32}, axis{uint8},
 *    steps{int32},
 *    ...
 * ]
 *
 * Example:
 * [
 *    MOVEMENT, 0.1, 0, 1, 0b00001010,
 *    6400, => axis 2
 *    -6400, => axis 4
 * ]
 *
 **/
export class Movement {

  static fromStream(read: ReadStream): Movement {
    let movement = new Movement();
    movement.time = streamToFloat32(read);
    movement.initialSpeed = streamToFloat32(read);
    movement.acceleration = streamToFloat32(read);
    let axis: number = read();
    movement.values = new Int32Array(8);
    for(let i = 0; i < movement.values.length; i++) {
      if((axis >> i) & 1) {
        movement.values[i] = streamToUint32(read);
      }
    }
    movement.positions = new Uint8Array(8);
    return movement;
  }

  time: number;
  initialSpeed: number;
  acceleration: number;
  values: Int32Array;
  positions: Uint32Array;

  toStream(write: WriteStream) {
    write(COMMANDS.MOVEMENT);
    float32ToStream(this.time, write);
    float32ToStream(this.initialSpeed, write);
    float32ToStream(this.acceleration, write);
    let axis: number = 0;
    for(let i = 0; i < this.values.length; i++) {
      axis |= <any>(this.values[i] !== 0) << i;
    }
    write(axis);
    for(let i = 0; i < this.values.length; i++) {
      if((axis >> i) & 1) {
        uint32ToStream(this.values[i], write);
      }
    }
  }
}

export class PWM {
  values: Uint8Array;
}


let mov = new Movement();
mov.time = 1.1;
mov.initialSpeed = 0.1;
mov.acceleration = 0.2;
mov.values = new Int32Array([0, 1, 0, 10, 0, 0, 0, 0]);

let stream = new Uint8Array(1000);
let writeIndex = 0;
let readIndex = 1;
mov.toStream((value: number) => {
  stream[writeIndex++] = value;
  console.log(value.toString(2));
});


console.log(Movement.fromStream(() => {
  return stream[readIndex++];
}));

console.log('writeIndex', writeIndex);

/**
 * CONFIG
 *
 * [CONFIG, IPrinterConfig{string}]
 *
 **/



/**
 * PWM
 *
 * [
 *    PWM{int8}
 *    channels{uint8},
 *    value{uint8},
 *    ...
 * ]
 *
 * Example:
 * [
 *    PWM,
 *    0b00001010,
 *    255, => axis 2
 *    128, => axis 4
 * ]
 *
 **/

/**
 * TEMPERATURE_FUNCTION
 *
 * [
 *    TEMPERATURE_FUNCTION{int8}, axis{uint8},
 *    pwmFunction:{string},
 *    ...
 * ]
 *
 * Example:
 * [
 *    TEMPERATURE_FUNCTION, 0b00000010,
 *    (analogValue) => {
 *      return analogValue * 2; // PWMValue
 *    }
 * ]
 *
 **/