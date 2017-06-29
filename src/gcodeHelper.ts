import * as Stream from 'stream';
import * as fs from 'fs';
import { Float } from './classes/float.class';



export class GCODECommand {
  static GCodeLineRegExp: RegExp = /^([^;]*)(?:;(.*)$|$)/;
  static GCodeParamRegExp: RegExp = /^([a-zA-Z])([0-9.\-]+)/;
  static precision: number = 1e-2;

  static fromString(gcodeLine: string): GCODECommand {
    const command: GCODECommand = new GCODECommand();

    const match = GCODECommand.GCodeLineRegExp.exec(gcodeLine.trim());
    if(match) {
      if(match[1]) {
        const split = match[1].split(' ');
        command.command = split[0].trim();
        command.params = {};
        let param: string;
        for(let i = 1; i < split.length; i++) {
          param = split[i].trim();
          if(param) {
            const paramMatch = GCODECommand.GCodeParamRegExp.exec(param);
            if(paramMatch) command.params[paramMatch[1].toLowerCase()] = parseFloat(paramMatch[2]);
          }
        }
      }

      if(match[2]) {
        command.comment = match[2].trim();
      }
    }

    return command;
  }

  constructor(
    public command: string = '',
    public params: { [key: string]: number } = {},
    public comment: string = ''
  ) {}

  isEmpty() {
    if((this.command !== '') || (this.comment !== '')) {
      return false;
    }

    for(const key in this.params) {
      return false;
    }

    return true
  }

  toString(precision: number = GCODECommand.precision): string {
    let commandLine: string = '';
    if(this.command) commandLine += this.command;
    for(const key in this.params) {
      if(commandLine !== '') commandLine += ' ';
      commandLine += key.toUpperCase() + Float.toString(this.params[key], precision);
    }

    if(this.comment) {
      if(commandLine !== '') commandLine += ' ';
      commandLine += '; ' + this.comment;
    }

    return commandLine;
  }
}

export class GCodeReaderStream extends Stream.Transform {
  private gcode: string = '';

  constructor() {
    super({ readableObjectMode: true });
  }

  _transform(gcode: Buffer | string, encoding: string, callback: () => void) {
    if(gcode instanceof Buffer) {
      this.parseGCODE(gcode.toString());
      callback();
    } else if(typeof gcode === 'string') {
      this.parseGCODE(gcode);
      callback();
    } else {
      this.emit('error', new Error('Invalid data : expected Buffer | string'));
      this.end();
    }
  }

  protected _flush(callback: () => void) {
    const commands: GCODECommand[] = GCODEHelper.parse(this.gcode);
    this.gcode = '';
    if(commands.length > 0) this.push(commands);
  }

  private parseGCODE(gcode: string) {
    this.gcode += gcode.replace('\r', '');
    let i = this.gcode.length - 1;
    for(;i >= 0; i--) {
      if(this.gcode[i] === '\n') {
        break;
      }
    }
    const commands: GCODECommand[] = GCODEHelper.parse(this.gcode.slice(0, i));
    this.gcode = this.gcode.slice(i, this.gcode.length);
    if(commands.length > 0) this.push(commands);
  }

}

export class GCodeWriterStream extends Stream.Transform {

  constructor() {
    super({ writableObjectMode: true });
  }

  _transform(commands: GCODECommand[], encoding: string, callback: () => void) {
    if(Array.isArray(commands)) {
      const gcode: string = GCODEHelper.stringify(commands);
      if(gcode) this.push(gcode + '\n');
      callback();
    } else {
      this.emit('error', new Error('Invalid data : expected GCODECommand[]'));
      this.end();
    }
  }

}


export class GCODEHelper {

  static parseFile(path: string): Stream {
    const readStream = fs.createReadStream(path);
    return readStream.pipe(new GCodeReaderStream());
  }

  static parseFilePromise(path: string): Promise<GCODECommand[]> {
    return new Promise<GCODECommand[]>((resolve: any, reject: any) => {
      const commands: GCODECommand[] = [];
      const parser: Stream = this.parseFile(path);
      parser.on('data', (_commands: GCODECommand[]) => {
        _commands.forEach((command: any) => {
          commands.push(command);
        });
      });

      parser.on('finish', () => {
        resolve(commands);
      });

      parser.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  static parse(gcode: string): GCODECommand[] {
    const gcodeLines: string[] = gcode.split(/\r?\n/);
    const commands: GCODECommand[] = [];
    gcodeLines.forEach((gcodeLine: string) => {
      const command: GCODECommand = GCODECommand.fromString(gcodeLine);
      if(!command.isEmpty()) {
        commands.push(command);
      }
    });
    return commands;
  }

  static stringify(commands: GCODECommand[]): string {
    return commands.map((command: GCODECommand) => command.toString()).join('\n');
  }



  static moveTo(commands: GCODECommand[], x: number, y: number, z?: number, e?: number): GCODECommand[] {
    const params: any = {};
    if(x !== void 0) params.x = x;
    if(y !== void 0) params.y = y;
    if(z !== void 0) params.x = z;
    if(e !== void 0) params.e = e;
    commands.push(new GCODECommand('G0', params));
    return commands;
  }

  static arc(
    commands: GCODECommand[],
    x: number, y: number, radius: number,
    startAngle: number = 0, angle: number = Math.PI * 2,
    steps: number = 100
  ): GCODECommand[] {
    if(steps > 1) {
      for(let i = 0; i < steps; i++) {
        const a: number = startAngle - angle * i / (steps - 1);
        this.moveTo(
          commands,
          x + Math.cos(a) * radius,
          y + Math.sin(a) * radius
        );
      }
    } else { // TODO : not tested
      this.moveTo(commands,
        x + Math.cos(startAngle) * radius,
        y + Math.sin(startAngle) * radius
      );

      commands.push(new GCODECommand((angle < 0) ? 'G3' : 'G2', {
        x: x + Math.cos(startAngle + angle) * radius,
        y: y + Math.sin(startAngle + angle) * radius,
        i: x,
        j: y
      }));
    }
    return commands;
  }

  static circle(commands: GCODECommand[], x: number, y: number, radius: number, steps: number = 100): GCODECommand[] {
    GCODEHelper.arc(commands, x, y, radius, 0, 2 * Math.PI, steps);
    return commands;
  }

  static pause(commands: GCODECommand[], ms: number): GCODECommand[] {
    commands.push(new GCODECommand('G4', { p : ms }));
    return commands;
  }

}


const createCircle = (path: string): Promise<void> => {
  return new Promise<void>((resolve: any, reject: any) => {
    const writer = new Stream.Readable({objectMode: true});
    const fileWriter = fs.createWriteStream(path);

    fileWriter.on('finish', () => {
      resolve();
    });

    fileWriter.on('error', (error: Error) => {
      reject(error);
    });

    writer.pipe(new GCodeWriterStream()).pipe(fileWriter);

    // writer.push(GCODEHelper.arc([], 0, 0, 100, 1 / 4 * Math.PI, 3 / 4 * Math.PI, true, 100));
    writer.push(GCODEHelper.circle([], 0, 0, 1000, 1000000));
    // writer.push(GCODEHelper.circle([], 0, 0, 100, 100));
    writer.push(GCODEHelper.moveTo([], 0, 0));

    writer.push(null);
  });
};

// createCircle('../assets/circle.gcode');

// console.log(GCODEHelper.moveTo([], 10, 10)[0].toString());
// console.log(GCODEHelper.arc([], 0, 0, 100, 1 / 4 * Math.PI, 3 / 4 * Math.PI, true, 100).map(a => a.toString()).join('\n'));

// GCODEHelper.parseFilePromise('../assets/' + 'thin_tower' + '.gcode');
// GCODEHelper.parseFile('../assets/' + 'fruit_200mm' + '.gcode');

