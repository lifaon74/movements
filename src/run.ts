// https://github.com/websockets/ws
import * as WebSocket from 'ws';

import { config } from './config';

export class CyclicBuffer {

  public isLittleEndian: boolean;
  private _buffer: Uint8Array;
  private _readIndex: number;
  private _writeIndex: number;

  constructor(length: number) {
    this._buffer = new Uint8Array(length);
    this._readIndex = 0;
    this._writeIndex = 0;

    const buffer: ArrayBuffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    this.isLittleEndian = new Int16Array(buffer)[0] === 256;
  }

  get readable(): number {
    return ((this._writeIndex < this._readIndex) ? (this._writeIndex + this._buffer.length) : this._writeIndex) - this._readIndex;
  }

  get writable(): number {
    // return this._buffer.length - this.readable;
    return ((this._readIndex <= this._writeIndex) ? (this._readIndex + this._buffer.length) : this._readIndex) - this._writeIndex;
  }


  readOne(): number | null {
    if(this.readable > 0) {
      const value: number = this._buffer[this._readIndex];
      this._readIndex = (this._readIndex + 1) % this._buffer.length;
      return value;
    } else {
      return null;
    }
  }

  read(length: number = this.readable, copy: boolean = false): Uint8Array {
    if(length > this.readable) {
      throw new Error('Buffer overflow');
    } else {
      let buffer: Uint8Array;
      const newReadIndex: number = (this._readIndex + length) % this._buffer.length;
      if(newReadIndex < this._readIndex) {
        buffer = new Uint8Array(length);
        buffer.set(this._buffer.subarray(this._readIndex)); // from read index to the end
        buffer.set(this._buffer.subarray(0, newReadIndex), this._buffer.length - this._readIndex); // from 0 to newReadIndex
      } else {
        if(copy) {
          buffer = new Uint8Array(length);
          buffer.set(this._buffer.subarray(this._readIndex, newReadIndex));
        } else {
          buffer = this._buffer.subarray(this._readIndex, newReadIndex);
        }
      }
      this._readIndex = newReadIndex;
      return buffer;
    }
  }

  write(data: Uint8Array): void {
    if(data.length > this.writable) {
      throw new Error('Buffer overflow');
    } else {
      const newWriteIndex: number = (this._writeIndex + data.length) % this._buffer.length;
      if(newWriteIndex < this._writeIndex) {
        const remainingLength: number = this._buffer.length - this._writeIndex;
        this._buffer.set(data.subarray(0, remainingLength), this._writeIndex);
        this._buffer.set(data.subarray(remainingLength));
      } else {
        this._buffer.set(data, this._writeIndex);
      }
      this._writeIndex = newWriteIndex;
    }
  }



  readUInt8(): number {
    return this.readOne();
  }

  readInt8(): number {
    const value: number = this.readUInt8();
    return (value & 0b10000000) ? -value : value;
  }

  readUInt16BE(): number {
    const buffer: Uint8Array = this.read(2, true);
    if(this.isLittleEndian) buffer.reverse();
    return new Uint16Array(buffer.buffer)[0];
  }

  readUInt16LE(): number {
    const buffer: Uint8Array = this.read(2, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Int16Array(buffer.buffer)[0];
  }

  readInt16BE(): number {
    const buffer: Uint8Array = this.read(2, true);
    if(this.isLittleEndian) buffer.reverse();
    return new Uint16Array(buffer.buffer)[0];
  }

  readInt16LE(): number {
    const buffer: Uint8Array = this.read(2, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Int16Array(buffer.buffer)[0];
  }


  readUInt32BE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(this.isLittleEndian) buffer.reverse();
    return new Uint32Array(buffer.buffer)[0];
  }

  readUInt32LE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Uint32Array(buffer.buffer)[0];
  }

  readInt32BE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(this.isLittleEndian) buffer.reverse();
    return new Int32Array(buffer.buffer)[0];
  }

  readInt32LE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Int32Array(buffer.buffer)[0];
  }

  
  readFloatBE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Float32Array(buffer.buffer)[0];
  }

  readFloatLE(): number {
    const buffer: Uint8Array = this.read(4, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Float32Array(buffer.buffer)[0];
  }

  readDoubleBE(): number {
    const buffer: Uint8Array = this.read(8, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Float64Array(buffer.buffer)[0];
  }

  readDoubleLE(): number {
    const buffer: Uint8Array = this.read(8, true);
    if(!this.isLittleEndian) buffer.reverse();
    return new Float64Array(buffer.buffer)[0];
  }




  async waitReadable(length: number): Promise<void> {
    while(this.readable < length) {
      await this.delay(10);
    }
  }

  async asyncRead(length: number): Promise<Uint8Array> {
    await this.waitReadable(length);
    return this.read(length);
  }

  async asyncReadOne(): Promise<number> {
    await this.waitReadable(1);
    return this.readOne();
  }


  async asyncReadUInt8(): Promise<number> {
    await this.waitReadable(1);
    return this.readUInt8();
  }

  async asyncReadInt8(): Promise<number> {
    await this.waitReadable(1);
    return this.readInt8();
  }


  async asyncReadUInt16BE(): Promise<number> {
    await this.waitReadable(2);
    return this.readUInt16BE();
  }

  async asyncReadUInt16LE(): Promise<number> {
    await this.waitReadable(2);
    return this.readUInt16LE();
  }

  async asyncReadInt16BE(): Promise<number> {
    await this.waitReadable(2);
    return this.readInt16BE();
  }

  async asyncReadInt16LE(): Promise<number> {
    await this.waitReadable(2);
    return this.readInt16LE();
  }


  async asyncReadUInt32BE(): Promise<number> {
    await this.waitReadable(4);
    return this.readUInt32BE();
  }

  async asyncReadUInt32LE(): Promise<number> {
    await this.waitReadable(4);
    return this.readUInt32LE();
  }

  async asyncReadInt32BE(): Promise<number> {
    await this.waitReadable(4);
    return this.readInt32BE();
  }

  async asyncReadInt32LE(): Promise<number> {
    await this.waitReadable(4);
    return this.readInt32LE();
  }


  async asyncReadFloatBE(): Promise<number> {
    await this.waitReadable(4);
    return this.readFloatBE();
  }

  async asyncReadFloatLE(): Promise<number> {
    await this.waitReadable(4);
    return this.readFloatLE();
  }

  async asyncReadDoubleBE(): Promise<number> {
    await this.waitReadable(8);
    return this.readDoubleLE();
  }

  async asyncReadDoubleLE(): Promise<number> {
    await this.waitReadable(8);
    return this.readDoubleLE();
  }




  delay(timeout: number): Promise<void> {
    return new Promise<void>((resolve: any, reject: any) => {
       setTimeout(resolve, timeout);
    });
  }

}

enum COMMANDS {
  NOOP,
  GET_VERSION,
  GET_CONFIG,
  MOVE,
}

/**
 * [ CMD, PARAMS]
 *
 * Version: [GET_VERSION] => [number]
 *
 * Move : [ MOVE, StepperUsed, Duration (f64), InitialSpeed (f64), Acceleration(f64), values...(uint32[])]
 *   ex: [ COMMANDS.MOVE, 0b00000111, 1e-3, 4, 5, 1234, 5678, 9101]
 */

class StepperMove {

  constructor(public pin: number,
              public target: number,
              public current: number = 0) {

  }

  get sign(): number {
    return Math.sign(this.target);
  }

  get distance(): number {
    return Math.abs(this.target);
  }

  get finished(): boolean {
    return Math.abs(this.current) >= Math.abs(this.target);
  }
}

class StepperMovement {
  static async fromCommand(buffer: CyclicBuffer): Promise<StepperMovement> {
    const stepperMovement: StepperMovement = new StepperMovement();
    const steppersUsed: number = await buffer.asyncReadUInt8();
    stepperMovement.duration = buffer.readDoubleLE();
    stepperMovement.initialSpeed = buffer.readDoubleLE();
    stepperMovement.acceleration = buffer.readDoubleLE();

    for(let i = 0; i < 8; i++) {
      if(steppersUsed & (1 << i)) {
        stepperMovement.moves.push(new StepperMove(i, await buffer.asyncReadUInt32LE()));
      }
    }

    return stepperMovement;
  }

  public moves: StepperMove[];
  public duration: number;
  public initialSpeed: number;
  public acceleration: number;
  public initialTime: number;

  constructor() {
    this.moves = [];
    const time: [number, number] = process.hrtime();
    this.initialTime = time[0] + time[1] / 1e9;
  }

  toBuffer(buffer: CyclicBuffer): void {

  }
}



export class AGCODERunner {
  static STEPPERS_STEP_REG: number = 0;
  static STEPPERS_DIRECTION_REG: number = 1;
  static STEPPERS_ENABLED_REG: number = 2;

  public server: WebSocket.Server;
  public config: any;

  public time: number;

  public commandsBuffer: CyclicBuffer;

  public outBuffer: Uint8Array;
  public inBuffer: Uint8Array;

  private currentMove: StepperMovement | null;


  constructor(config: any) {
    this.config = config;
    this.time = this.getTime();

    this.commandsBuffer = new CyclicBuffer(1e6);

    this.outBuffer = new Uint8Array(6);
    this.inBuffer = new Uint8Array(6);

    this.outBuffer[AGCODERunner.STEPPERS_ENABLED_REG] = 0b11111111;

    this.currentMove = null;

    // this.commandsBuffer.write(new Uint8Array([0, 1, 2]));
    // console.log(this.commandsBuffer.read());
    // this.commandsBuffer.write(new Uint8Array([3, 4, 5]));
    // console.log(this.commandsBuffer.read());
    // console.log(this.commandsBuffer._buffer);


    this.startServer();
    this.mainLoop();
  }

  startServer() {
    this.server = new WebSocket.Server({ port: 1234 });

    this.server.on('connection', (websocket: WebSocket) => {
      websocket.on('message', (message: string | Buffer) => {
        this.commandsBuffer.write(message as Uint8Array);
        // console.log(this.commandsBuffer.read());
        // this.commandsBuffer.push.apply(this.commandsBuffer, message);
        // console.log(this.commandsBuffer.data.slice(0, 10));
      });
    });

    const wsClient = new WebSocket('ws://localhost:1234');
    wsClient.on('open', () => {
      function sendMove() {
        const buffer: Buffer = Buffer.alloc(10000);
        let i: number = 0;
        i = buffer.writeInt8(COMMANDS.MOVE, i);
        i = buffer.writeInt8(0b00000111, i);
        i = buffer.writeDoubleLE(1, i);
        i = buffer.writeDoubleLE(0, i);
        i = buffer.writeDoubleLE(1, i);

        i = buffer.writeInt32LE(6400, i);
        i = buffer.writeInt32LE(3200, i);
        i = buffer.writeInt32LE(1600, i);

        wsClient.send(buffer.slice(0, i));
      }
      sendMove();
      // setInterval(() => {
      //   sendMove();
      // }, 1000);
    });

  }

  mainLoop() {
    let time: number = this.getTime();
    const loopTime: number = time - this.time;

    if(this.currentMove !== null) {
      // const accelerationFactor: number = elapsedTime * elapsedTime * 0.5;
      const elapsedTime: number = time - this.currentMove.initialTime;
      const positionFactor: number = Math.min(1,
        this.currentMove.acceleration * elapsedTime * elapsedTime * 0.5 +
        this.currentMove.initialSpeed * elapsedTime
      );

      let stepsByte: number = 0 | 0;
      let directionByte: number = 0 | 0;

      let finished: boolean = true;
      let deltaValue: number;

      let move: StepperMove;
      for(let i = 0, l = this.currentMove.moves.length; i < l; i++) {
        move = this.currentMove.moves[i];

        if(!move.finished) {
          finished = false;
          if(elapsedTime > this.currentMove.duration) {
            // this.runOutOfTime++; // debug only
            deltaValue = 1;
          } else {
            deltaValue = (Math.round(positionFactor * move.target) - move.current);
            // if(deltaValue > 1) this.missedSteps++;
          }

          move.current += deltaValue;
          stepsByte |= ((deltaValue === 0) ? 0 : 1) << i;
          directionByte |= ((Math.sign(deltaValue) < 0) ? 0 : 1) << i;
        }
      }


      this.outBuffer[AGCODERunner.STEPPERS_STEP_REG] = stepsByte;
      this.outBuffer[AGCODERunner.STEPPERS_DIRECTION_REG] = directionByte;

      if(finished) {
        this.currentMove = null;
        console.log('done');
      }
    } else {
      this.decodeCommand();
    }

    this.updateIO();

    this.time = time;
    setImmediate(() => this.mainLoop());
  }

  updateIO(): void {
    // console.log(this.outBuffer[AGCODERunner.STEPPERS_STEP_REG].toString(2), this.outBuffer[AGCODERunner.STEPPERS_DIRECTION_REG].toString(2));
  }


  async decodeCommand(): Promise<any> {
    if(this.commandsBuffer.readable) {
      // if((time - this.time) > (1e-6 * 200)) {
      //   console.log('too much time', time - this.time);
      //   time = this.getTime() + 1;
      // }

      switch(this.commandsBuffer.readUInt8()) {
        case COMMANDS.MOVE:
          this.currentMove = await StepperMovement.fromCommand(this.commandsBuffer);
          break;
      }
    }
  }

  // return time in seconds
  private getTime(): number {
    const t = process.hrtime();
    return t[0] + t[1] * 1e-9;
  }
}

const runner = new AGCODERunner(config);

