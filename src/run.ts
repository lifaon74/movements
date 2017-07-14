// https://github.com/websockets/ws
import * as WebSocket from 'ws';

import { config } from './config';

export class CyclicBuffer {

  private _buffer: Uint8Array;
  private _readIndex: number;
  private _writeIndex: number;

  constructor(length: number) {
    this._buffer = new Uint8Array(length);
    this._readIndex = 0;
    this._writeIndex = 0;
  }

  get readable(): number {
    return ((this._writeIndex < this._readIndex) ? (this._writeIndex + this._buffer.length) : this._writeIndex) - this._readIndex;
  }

  get writable(): number {
    // return this._buffer.length - this.readable;
    return ((this._readIndex <= this._writeIndex) ? (this._readIndex + this._buffer.length) : this._readIndex) - this._writeIndex;
  }


  read(length: number = this.readable): Uint8Array {
    if(length > this.readable) {
      throw new Error('Buffer overflow');
    } else {
      const buffer: Uint8Array = new Uint8Array(length);
      const newReadIndex: number = (this._readIndex + length) % this._buffer.length;
      if(newReadIndex < this._readIndex) {
        buffer.set(this._buffer.subarray(this._readIndex)); // from read index to the end
        buffer.set(this._buffer.subarray(0, newReadIndex), this._buffer.length - this._readIndex); // from 0 to newReadIndex
      } else {
        buffer.set(this._buffer.subarray(this._readIndex, newReadIndex));
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




  // private getRelativeIndex(index: number): number {
  //   index = (this._index + index) % this._length;
  //   return (index < 0) ? (index + this._length) : index;
  // }

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

  constructor(config: any) {
    this.config = config;
    this.time = this.getTime();

    this.commandsBuffer = new CyclicBuffer(5);

    this.outBuffer = new Uint8Array(6);
    this.inBuffer = new Uint8Array(6);

    this.outBuffer[AGCODERunner.STEPPERS_ENABLED_REG] = 0b11111111;


    // this.commandsBuffer.write(new Uint8Array([0, 1, 2]));
    // console.log(this.commandsBuffer.read());
    // this.commandsBuffer.write(new Uint8Array([3, 4, 5]));
    // console.log(this.commandsBuffer.read());
    // console.log(this.commandsBuffer._buffer);


    this.startServer();
    // this.mainLoop();
  }

  startServer() {
    this.server = new WebSocket.Server({ port: 1234 });


    this.server.on('connection', (websocket: WebSocket) => {
      websocket.on('message', (message: string | Buffer) => {
        this.commandsBuffer.write(message as Uint8Array);
        console.log(this.commandsBuffer.read());
        // this.commandsBuffer.push.apply(this.commandsBuffer, message);
        // console.log(this.commandsBuffer.data.slice(0, 10));
      });
    });

    const wsClient = new WebSocket('ws://localhost:1234');
    wsClient.on('open', () => {

      wsClient.send(new Uint8Array([1, 2, 3]));

      // setInterval(() => {
      //
      // }, 1000);
    });

  }

  mainLoop() {
    let time: number = this.getTime();
    const elapsedTime: number = time - this.time;

    // if(this._warmUpRound) {
    //   if(elapsedTime > 1) {
    //     this._warmUpRound = false;
    //     this.time = time;
    //   }
    // } else {
    //   if((time - this.time) > (1e-6 * 200)) {
    //     console.log('too much time', time - this.time);
    //     time = this.getTime() + 1;
    //   }
    //
    //   this.time = time;
    // }


    setImmediate(() => this.mainLoop());
  }

  updateIO(): void {

  }

  // return time in seconds
  private getTime(): number {
    const t = process.hrtime();
    return t[0] + t[1] * 1e-9;
  }
}

const runner = new AGCODERunner(config);

