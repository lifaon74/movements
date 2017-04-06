export class StackLine {
  static fromStackLineString(stackLineString: string): StackLine {
    const stackLine: StackLine = new StackLine('', '', 0, 0);
    stackLineString = stackLineString.trim();

    // const reg = new RegExp('^([^\\s]+)[\\s]+\\(([^\\)]+)\\)$', 'gm');
    const reg = new RegExp('^([\\s\\S]+)[\\s]+\\(([^\\)]+)\\)$', 'gm');

    const match = reg.exec(stackLineString);
    if(match) {
      const spliced = match[2].split(':');
      stackLine.context = match[1];
      stackLine.file    = spliced.slice(0, -2).join(':');
      stackLine.line    = parseInt(spliced[spliced.length - 2]);
      stackLine.column  = parseInt(spliced[spliced.length - 1]);
    } else {
      const spliced = stackLineString.split(':');
      stackLine.context = '<global>';
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

  toString(indent: number = 0): string {
    let tab: string = '\t'.repeat(indent);
    return this.map((stackLine: StackLine) => {
      return tab + 'at ' + stackLine.toString() + '\n';
    }).join('');
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

  toString(): string {
    return this.name + ': ' + this.message + '\n' + (this.stack.toString(1));
  }
}


// console.log(StackLine.fromStackLineString('<anonymous>:1:5'));
// console.log(StackLine.fromStackLineString('Function.Shell.context (C:\\workspace\\tests\\stepper\\dist\\classes\\shell.class.js:126:41)'));

