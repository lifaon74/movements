enum COMMANDS {
  NONE,
  CONFIG,
  MOVEMENT,
  HOME,
  PWM,
  TEMPERATURE_FUNCTION,
  TEMPERATURE
}


declare type WriteStream = (value: number) => any;
declare type ReadStream = () => number;


export class Conversion {
  static float32ToStream(float: number, write: WriteStream): Uint8Array {
    let array: Uint8Array = new Uint8Array(new Float32Array([float]).buffer);
    for(let i = 0; i < array.length; i++) {
      write(array[i]);
    }
    return array;
  }

  static streamToFloat32(read: ReadStream): number {
    let array: Uint8Array = new Uint8Array(4);
    for(let i = 0; i < array.length; i++) {
      array[i] = read();
    }

    return new Float32Array(array.buffer)[0];
  }


  static uint32ToStream(uint: number, write: WriteStream) {
    for(let i = 0; i < 4; i++) {
      write((uint >> (i * 4)) & 0b11111111);
    }
  }

  static streamToUint32(read: ReadStream): number {
    let uint: number = 0;
    for(let i = 0; i < 4; i++) {
      uint |= read() << (i * 4);
    }
    return uint;
  }

  static getAxis(array: any): number {
    let axis: number = 0;
    for(let i = 0; i < array.length; i++) {
      axis |= <any>(array[i] !== 0) << i;
    }
    return axis;
  }

  static hasAxis(axis: number, index: any): boolean {
    return <any>((axis >> index) & 1);
  }

  static readStream(stream: Uint8Array): any[] {
    let writeIndex = 0;
    let readIndex = 0;

    let write = (value: number) => {
      stream[writeIndex++] = value;
      // console.log(value.toString(2));
    };

    let read = () => {
      return stream[readIndex++];
    };


    let result: any[] = [];
    for(let i = 0; i < stream.length; i++) {
      let command = read();
      switch(command) {
        case COMMANDS.MOVEMENT:
          result.push(Movement.fromStream(read));
          break;
        case COMMANDS.PWM:
          result.push(PWM.fromStream(read));
          break;
      }
    }

    return result;
  }

  static writeStream(commands: any[]): Uint8Array {
    let stream = new Uint8Array(100);
    let writeIndex = 0;
    let readIndex = 0;

    let write = (value: number) => {
      stream[writeIndex++] = value;
      // console.log(value.toString(2));
    };

    let read = () => {
      return stream[readIndex++];
    };

    for(let i = 0; i < commands.length; i++) {
      commands[i].toStream(write);
    }

    return stream;
  }

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
    let movement = new Movement(
      Conversion.streamToFloat32(read),
      Conversion.streamToFloat32(read),
      Conversion.streamToFloat32(read)
    );
    let axis: number = read();
    for(let i = 0; i < movement.values.length; i++) {
      if(Conversion.hasAxis(axis, i)) {
        movement.values[i] = Conversion.streamToUint32(read);
      }
    }
    return movement;
  }

  constructor(public time: number = 0,
              public initialSpeed: number = 0,
              public acceleration: number = 0,
              public values: Int32Array = new Int32Array(8),
              public positions: Uint32Array = new Uint32Array(8)) {
  }


  toStream(write: WriteStream) {
    write(COMMANDS.MOVEMENT);
    Conversion.float32ToStream(this.time, write);
    Conversion.float32ToStream(this.initialSpeed, write);
    Conversion.float32ToStream(this.acceleration, write);
    let axis: number = Conversion.getAxis(this.values);
    write(axis);
    for(let i = 0; i < this.values.length; i++) {
      if(Conversion.hasAxis(axis, i)) {
        Conversion.uint32ToStream(this.values[i], write);
      }
    }
  }
}

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
export class PWM {
  static fromStream(read: ReadStream): PWM {
    let pwm = new PWM();
    let axis: number = read();
    for(let i = 0; i < pwm.values.length; i++) {
      if(Conversion.hasAxis(axis, i)) {
        pwm.values[i] = read();
      }
    }
    return pwm;
  }

  constructor(public values: Uint8Array = new Uint8Array(8),
              public done: Uint8Array = new Uint8Array(8)) {
  }

  toStream(write: WriteStream) {
    write(COMMANDS.PWM);
    let axis: number = Conversion.getAxis(this.values);
    write(axis);
    for(let i = 0; i < this.values.length; i++) {
      if(Conversion.hasAxis(axis, i)) {
        write(this.values[i]);
      }
    }
  }
}


let mov = new Movement(1.1, 0.1, 0.2, new Int32Array([0, 1, 0, 10, 0, 0, 0, 0]));
let pwm = new PWM(new Uint8Array([0, 255, 48, 0, 0, 0, 0, 0]));

let stream = Conversion.writeStream([mov, pwm]);
console.log(stream.slice(0, 30));

let commands = Conversion.readStream(stream);
console.log(commands);

/**
 * CONFIG
 *
 * [CONFIG, IPrinterConfig{string}]
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