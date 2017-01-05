import * as rpio from 'rpio';


/**
 * DOC: https://cdn-shop.adafruit.com/datasheets/MCP3008.pdf
 **/

export class SPIController {

  static maxClockFrequency: number = 200e6; // 2Mhz

  static getMaxSPIClockDivider(): number {
    // return Math.pow(2, Math.ceil(Math.log(400e6 / SPIController.maxClockFrequency) / Math.log(2)));
    return 16;
  }


  static initSPI() {
    rpio.spiBegin();
    rpio.spiSetClockDivider(SPIController.getMaxSPIClockDivider());
  }

  public outBuffer: Buffer;
  public inBuffer: Buffer;

  constructor(public csPin: number) {
    this.initCSPin();
  }

  initCSPin() {
    rpio.open(this.csPin, rpio.OUTPUT, rpio.HIGH);
  }

  initBuffers(size: number) {
    this.outBuffer = new Buffer(size);
    this.inBuffer = new Buffer(size);
  }

  flush() {
    rpio.write(this.csPin, rpio.LOW);
    rpio.spiTransfer(this.outBuffer, this.inBuffer, this.outBuffer.length);
    rpio.write(this.csPin, rpio.HIGH);
  }
}