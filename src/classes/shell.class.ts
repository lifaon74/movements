

export class StackLine {
  static fromStackLineString(stackLineString: string): StackLine {
    const stackLine: StackLine = new StackLine('', '', 0, 0);
    stackLineString = stackLineString.trim();

    const reg = new RegExp('^([^\\s]+)[\\s]+\\(([^\\)]+)\\)$', 'gm');

    const match = reg.exec(stackLineString);
    if(match) {
      stackLine.context = match[1];
      const spliced = match[2].split(':');
      stackLine.file    = spliced.slice(0, -2).join(':');
      stackLine.line    = parseInt(spliced[spliced.length - 2]);
      stackLine.column  = parseInt(spliced[spliced.length - 1]);
    } else {
      const spliced = stackLineString.split(':');
      stackLine.file    = spliced.slice(0, -2).join(':');
      stackLine.line    = parseInt(spliced[spliced.length - 2]);
      stackLine.column  = parseInt(spliced[spliced.length - 1]);
    }

    return stackLine;
  }

  constructor(
    public context: string,
    public file: string,
    public line: number,
    public column: number
  ) {}

  toString(): string {
    return this.context + ' (' + this.file + ':' + this.line + ':' + this.column + ')';
  }
}

// console.log(StackLine.fromStackLineString('<anonymous>:1:5'));
// console.log(StackLine.fromStackLineString('Function.Shell.context (C:\\workspace\\tests\\stepper\\dist\\classes\\shell.class.js:126:41)'));

export class StackTrace extends Array<StackLine> {
  static fromStackString(stack: string): StackTrace {
    const stackTrace = new StackTrace();

    let lines = stack.split(new RegExp('[\\s]+at ', 'gm'));
    // console.log(stack, lines);
    for(let i = 1; i < lines.length; i++) {
      stackTrace.push(StackLine.fromStackLineString(lines[i]));
    }

    return stackTrace;
  }

  constructor() {
    super();
  }
}

export class DetailedError {
  static fromError(error: Error): DetailedError {
    return new DetailedError(error.name, error.message, StackTrace.fromStackString(error.stack));
  }

  constructor(
    public name: string,
    public message: string,
    public stack: StackTrace
  ) {}
}


export class ShellColor {
  constructor(
    public foreground: number,
    public background: number
  ){}
}

export class Shell {
  static readonly isWin: boolean = /^win/.test(process.platform);
  static childProcess: any = require('child_process');
  static console: Console = console;

  static colors: any = {
    black:    new ShellColor(30, 40),
    red:      new ShellColor(31, 41),
    green:    new ShellColor(32, 42),
    yellow:   new ShellColor(33, 43),
    blue:     new ShellColor(34, 44),
    magenta:  new ShellColor(35, 35),
    cyan:     new ShellColor(36, 46),
    white:    new ShellColor(37, 47)
  };

  static setColor(color: any) {
    let args: number[] = [];

    if(typeof color === 'string') {
      if(color in Shell.colors) {
        args.push(Shell.colors[color].foreground);
      }
    } else if(typeof color === 'number') {
      args.push(color);
    } else if(color === null) {
      args.push(0);
    } else if(color instanceof ShellColor) {
      args.push(color.foreground);
      args.push(color.background);
    }

    if(args.length > 0) {
      process.stdout.write('\x1b[' + args.join(';') + 'm');
    } else {
      throw new Error('Undetermined color : ' + color.toString());
    }
  }

  static listColors() {
    for(let i = 0; i < 256; i++) {
      console.log('\x1b[' + i + 'm', 'test: ' + i);
    }
  }

  static clear() {
    console.clear();
  }

  static log(...args: any[]) {
    Shell.console.log.apply(Shell.console, args);
  }

  static info(...args: any[]) {
    Shell.setColor(Shell.colors.blue.foreground);
    Shell.log.apply(this, args);
    Shell.setColor(null);
  }

  static warn(...args: any[]) {
    Shell.setColor(Shell.colors.yellow.foreground);
    Shell.log.apply(this, args);
    Shell.setColor(null);
  }

  static error(...args: any[]) {
    Shell.setColor(Shell.colors.red.foreground);
    Shell.log.apply(this, args);
    Shell.setColor(null);
  }


  static context() {
    return DetailedError.fromError(new Error()).stack[1];
  }

  static execute(commandName: string, args: string[] = []): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
      Shell.childProcess.exec(
        commandName + ' ' + args.join(' '),
        { encoding: 'buffer' },
        (error: Error, stdout: Buffer, stderr: Buffer) => {
          const _stdout = stdout.toString('utf8').trim();
          const _stderr = stderr.toString('utf8').trim();
          if(_stderr) {
            reject(_stderr);
          } else {
            resolve(_stdout);
          }
        }
      );
    });
  }
}
