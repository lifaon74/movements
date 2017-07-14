import * as rpio from 'rpio';


/**
 * DOC: https://cdn-shop.adafruit.com/datasheets/MCP3008.pdf
 **/

export class MCP3008 {

  static maxClockFrequency: number = 2e6; // 2Mhz

  static getMaxSPIClockDivider(): number {
    return Math.pow(2, Math.ceil(Math.log(250e6 / MCP3008.maxClockFrequency) / Math.log(2)));
  }

  static spi:any;
  static initSPI() {
    rpio.spiBegin();
    rpio.spiSetClockDivider(MCP3008.getMaxSPIClockDivider());
    // MCP3008.spi = new SPI.Spi('/dev/spidev0.0', {'mode': SPI.MODE['MODE_0']});
    // MCP3008.spi.maxSpeed(MCP3008.maxClockFrequency); // in Hz
    // MCP3008.spi.open();
  }


  constructor(public csPin: number) {
    this.initCSPin();
  }

  initCSPin() {
    rpio.open(this.csPin, rpio.OUTPUT, rpio.HIGH);
  }

  // 2828889 => rpio
  // 3024565 => spi
  read(chanel: number, callback: ((result: number) => any)) { //1461969us / 100000 = 14.61u
    // data structure: [ sample, sample, null, b11, b10, b9, ..., b0]
    rpio.write(this.csPin, rpio.LOW);

    let txbuf = new Buffer([0x0, 0x0]);
    let rxbuf = new Buffer(txbuf.length);

    // MCP3008.spi.transfer(txbuf, rxbuf, (device, buf) => {
    //   rpio.write(this.csPin, rpio.HIGH);
    //   callback(1);
    // });

    rpio.spiTransfer(txbuf, rxbuf, txbuf.length);
    rpio.write(this.csPin, rpio.HIGH);
    callback(1);
    return ((rxbuf[0] & 0b00011111) << 7) | (rxbuf[1] >> 1);
  }
}
