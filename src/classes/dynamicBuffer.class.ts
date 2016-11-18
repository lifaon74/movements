

export class DynamicBuffer {
  buffer: Buffer;

  startIndex: number;
  endIndex: number;

  margin: number;

  allocated: number;

  constructor(allocated: number = 1e3) {
    this.startIndex = 0;
    this.endIndex = 0;
    this.allocated = allocated;
  }


  optimize() {

  }

}
