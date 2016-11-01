const fs = require('fs');


export class GCODEParser {
  static parseFile(path: string): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
      fs.readFile(path, 'utf8', (error: Error, data: string) => {
        if(error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    }).then(GCODEParser.parse);

  }

  static parse(gcode: string): any[] {
    let commands:string[] = gcode.split(/\r?\n/);
    return commands.map((command: string) => {
      let commandObject:any = {};

      let commentMatch = /;(.*)$/.exec(command);
      if(commentMatch) {
        commandObject.comment = commentMatch[1].trim();
      }


      let commandMatch = /^([^;]+)(;|$)/.exec(command);
      if(commandMatch) {
        let splited = commandMatch[1].split(' ');
        commandObject.command = splited[0].trim();
        commandObject.params = {};
        let param:string;
        for(let i = 1; i < splited.length; i++) {
          param = splited[i].trim();
          if(param) {
            let paramMatch = /^([a-zA-Z])([0-9.\-]+)/.exec(param);
            if(paramMatch) {
              commandObject.params[paramMatch[1].toLowerCase()] = parseFloat(paramMatch[2]);
            }
          }
        }
      }

      return commandObject;
    });
  }
}