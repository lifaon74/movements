
export class CyclicArray<T> {

  public _data: T[];
  private _index: number;
  private _length: number;

  constructor(length: number, type: any = Array) {
    this._length = length;
    this._index = this._length - 1;
    this._data = new type(this._length);
  }

  get length(): number {
    return this._length;
  }

  get data(): any {
    return this._data;
  }


  push(...values: T[]): this {
    for(let i = 0; i < values.length; i++) {
      this.jump(1);
      this._data[this._index] = values[i];
    }
    return this;
  }

  pop(replaceBy?: T): T {
    const value: T = this._data[this._index];
    this._data[this._index] = replaceBy;
    this.jump(-1);
    return value;
  }

  get(index: number = 0): T {
    return this._data[this.getRelativeIndex(index)];
  }

  set(value: T, index: number = 0): this {
    this._data[this.getRelativeIndex(index)] = value;
    return this;
  }

  jump(index: number = 0): this {
    this._index = this.getRelativeIndex(index);
    return this;
  }

  fill(value: T): this {
    let i = this._length;
    while(i--) {
      this._data[i] = value;
    }
    return this;
  }

  forEach(callback: (value: T) => T): void {
    for(let i = 0; i < this._length; i++) {
      let index: number = this.getRelativeIndex(-i);
      let value: T = callback.call(this, this._data[index]);
      if(value !== void 0) {
        this._data[index] = value;
      }
    }
  }

  private getRelativeIndex(index: number): number {
    index = (this._index + index) % this._length;
    return (index < 0) ? (index + this._length) : index;
  }

}
