import { ConstrainedMovement, ConstrainedMove } from './kinematics';
import { GCODECommand, GCODEParser } from '../../gcodeParser';

export class StepperMove {

  public direction: number; // 1 or -1
  public steps: number;

  public initialSpeed: number;
  public acceleration: number;

  public stepped: number = 0;


  constructor() {
  }

  get value(): number {
    return this.steps * this.direction;
  }

  set value(value: number) {
    this.steps = Math.abs(value);
    this.direction = Math.sign(value) || 1;
  }

  toString(): string {
    return '{ d: ' + this.value + ', v: ' + this.initialSpeed + ', a: ' + this.acceleration + ' }';
  }
}


export class StepperMovement {
  constructor(public moves: StepperMove[] = []) {
  }

  ended(): boolean {
    for(let i = 0, l = this.moves.length; i < l; i++) {
      if(this.moves[i].stepped < this.moves[i].steps) {
        return false;
      }
    }
    return true;
  }

  tick(time: number): number {
    let accelerationFactor: number = 0.5 * time * time;
    let move: StepperMove;
    let stepsByte: number = 0 | 0;
    for(let i = 0, length = this.moves.length; i < length; i++) {
      move = this.moves[i];
      let steps = Math.min(move.steps, Math.round(move.acceleration * accelerationFactor + move.initialSpeed * time));
      let deltaSteps = (steps - move.stepped) ? 1 : 0;
      stepsByte |= deltaSteps << i;
      move.stepped += deltaSteps;
    }

    return stepsByte;
  }

  toString(): string {
    return this.moves.map((move) => { return move.toString(); }).join(', ');
  }
}


class MovementOptimizer {

  constructor(private config: any) {
  }

  parseFile(path: string): Promise<ConstrainedMovement[]> {
    return GCODEParser.parseFile(path).then(this.parseGCODECommand.bind(this));
  }

  parseGCODECommand(commands: GCODECommand[]): ConstrainedMovement[] {
    let movements: ConstrainedMovement[] = [];

    let localConfig: any = {
      unitFactor: 1, // 1 for millimeters, 25.4 for inches,
      absolutePosition: true,
      position: {}
    };

    for(let stepper of this.config.steppers) {
      localConfig.position[stepper.name] = 0;
    }

    for(let command of commands) {
      // if(movements.length > 10) break;

      switch(command.command) {
        case 'G0':
        case 'G1':
          let moves: ConstrainedMove[] = [];
          // console.log(command.params);

          for(let stepper of this.config.steppers) {
            let move: ConstrainedMove = new ConstrainedMove();
            let value: number = command.params[stepper.name];
            let delta: number = 0;

            if(typeof value === 'number') {
              value = value * localConfig.unitFactor * stepper.stepsPerMm; // convert value to steps

              if(localConfig.absolutePosition) {
                delta = (value - localConfig.position[stepper.name]);
                localConfig.position[stepper.name] = value;
              } else {
                delta = value;
                localConfig.position[stepper.name] += value;
              }
            }

            move.speedLimit         = stepper.speedLimit;
            move.accelerationLimit  = stepper.accelerationLimit;
            move.jerkLimit          = stepper.jerkLimit;
            move.value              = delta;

            moves.push(move);
          }

          movements.push(new ConstrainedMovement(moves));
          break;

        case 'G20': // unit = inches
          localConfig.unitFactor = 25.4;
          break;
        case 'G21': // unit = millimeters
          localConfig.unitFactor = 1;
          break;

        case 'G90': // absolute position
          localConfig.absolutePosition = true;
          break;
        case 'G91': // relative position
          localConfig.absolutePosition = false;
          break;
        case 'G92': // define position
          for(let stepper of this.config.steppers) {
            localConfig.position[stepper.name] = command.params[stepper.name] || 0;
          }
          break;
      }
    }

    return movements;
  }


  optimizeMovementsSequence(movements: ConstrainedMovement[]) {
    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.speedLimit, move.accelerationLimit);
    // });

    this.reduceMovementsSequence(movements);

    let t1 = process.hrtime();
    this.computeTransitionSpeedsOfMovementsSequence(movements);
    let t2 = process.hrtime(t1);
    console.log('optimized in', t2[0] + t2[1] / 1e9);

    // movements.forEach((move: ConstrainedMovement) => {
    //   console.log('---');
    //   console.log(move.toString());
    // });


    return this.decomposeToStepperMovements(movements);

  }

  reduceMovementsSequence(movements: ConstrainedMovement[]) {
    for(let i = 0; i < movements.length; i++) {
      if(movements[i].isNull()) {
        movements.splice(i, 1);
        i--;
      }
    }

    let currentMovement: ConstrainedMovement, nextMovement: ConstrainedMovement;
    for(let i = 0; i < movements.length - 1; i++) {
      currentMovement = movements[i];
      nextMovement    = movements[i + 1];

      if(ConstrainedMovement.areCorrelated(currentMovement, nextMovement)) {
        movements.splice(i, 2, ConstrainedMovement.merge(currentMovement, nextMovement));
        i--;
      }
    }
  }

  /**
   * Compute best initial and finals speeds of ConstrainedMovement
   * @param movements
   */
  computeTransitionSpeedsOfMovementsSequence(movements: ConstrainedMovement[]) {
    movements[0].initialSpeed = 0;
    for(let i = 0, length = movements.length - 1; i < length; i++) {
      movements[i].optimizeTransitionSpeeds(movements[i + 1]);
    }

    movements.forEach((movement) => movement.swapTransitionSpeeds());

    movements[movements.length - 1].initialSpeed = 0;
    for(let i = movements.length - 1; i > 1; i--) {
      movements[i].optimizeTransitionSpeeds(movements[i - 1]);
    }

    movements.forEach((movement) => movement.swapTransitionSpeeds());
  }

  decomposeToStepperMovements(movements: ConstrainedMovement[]): StepperMovement[] {
    let stepperMovements: StepperMovement[] = [];
    for(let movement of movements) {
      movement.decomposeToStepperMovements(stepperMovements);
    }
    return stepperMovements;
  }
}