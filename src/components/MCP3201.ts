import * as rpio from 'rpio';

/**
 * DOC: http://ww1.microchip.com/downloads/en/DeviceDoc/21290D.pdf
 *
 * Pinout :
 *
 *  Vref		  Vdd
 *  IN+			  SCK
 *  IN-			  MISO
 *  Vss			  CS
 *
 *
 *  MISO -> 21
 *  SCK -> 23
 **/

export class MCP3201 {

  static maxClockFrequency: number = 1.6e6; // 1.6Mhz

  static getMaxSPIClockDivider(): number {
    return Math.pow(2, Math.ceil(Math.log(250e6 / MCP3201.maxClockFrequency) / Math.log(2)));
  }

  static initSPI() {
    rpio.spiBegin();
    rpio.spiSetClockDivider(MCP3201.getMaxSPIClockDivider());
  }


  constructor(public csPin: number) {
    this.initCSPin();
  }

  initCSPin() {
    rpio.open(this.csPin, rpio.OUTPUT, rpio.HIGH);
  }

  read(): number {
    // data structure: [ sample, sample, null, b11, b10, b9, ..., b0]
    rpio.write(this.csPin, rpio.LOW);

    let txbuf = new Buffer([0x0, 0x0]);
    let rxbuf = new Buffer(txbuf.length);

    rpio.spiTransfer(txbuf, rxbuf, txbuf.length);

    rpio.write(this.csPin, rpio.HIGH);

    return ((rxbuf[0] & 0b00011111) << 7) | (rxbuf[1] >> 1);
  }
}
