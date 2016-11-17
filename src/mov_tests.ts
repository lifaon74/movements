class Vector3D {
  constructor(public x: number = 0,
              public y: number = 0,
              public z: number = 0) {

  }

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}


export class Kinematic {
  // public position: number = 0;
  // public acceleration: number = 0;
  // public jerk: number = 0;

  public initialJerk: number = 0;
  public initialVelocity: number = 0;
  public initialAcceleration: number = 0;

  constructor() {

  }

  getAcceleration(time: number): number {
    return this.initialJerk * time + this.initialAcceleration;
  }

  getVelocity(time: number): number {
    return 0.5 * this.initialJerk * time * time + this.initialAcceleration * time;
  }

  getPosition(time: number): number {
    return (1 / 6) * this.initialJerk * time * time * time + 0.5 * this.initialAcceleration * time * time + this.initialVelocity * time;
  }


  getDuration(position: number): number {
    return 0;
  }
}




class Move {

  static computeDuration(distance: number, initialSpeed: number, acceleration: number): number {
    return (acceleration === 0) ?
      (distance / initialSpeed) : ((Move.computeFinalSpeed(distance, initialSpeed, acceleration) - initialSpeed) / acceleration);
  }

  static computeFinalSpeed(distance: number, initialSpeed: number, acceleration: number): number {
    return (acceleration === 0) ?
      initialSpeed : Math.sqrt(initialSpeed * initialSpeed + 2 * acceleration * distance);
  }

}


// let speedTest1 = () => {
//   let moves: StepperMove[] = [];
//   for(let i = 0; i < 1000000; i++) {
//     moves.push(new StepperMove(CONFIG.steppers[0], Math.random() * 1e6));
//     moves[i].t = Math.random();
//   }
//
//   var timerObject = new NanoTimer();
//   let a = 0;
//   var microsecs = timerObject.time(() => {
//     for(let move of moves) {
//       a += 0.5 * move.stepper.accelerationLimit * move.t * move.t + move.stepper.speedLimit * move.t; // 73.76ns
//     }
//   }, '', 'n');
//   console.log(microsecs / moves.length, a);
// };

let speedTest2 = () => {
  let timerObject = new NanoTimer();
  let a = 0;
  let time = timerObject.time(() => {
    for(let i = 0; i < 1000000; i++) {
      let acc = (Math.random() > 0.5) ? 0 : Math.random();
      a += Move.computeFinalSpeed(Math.random(), Math.random(), acc);
    }
  }, '', 'n');
  console.log(time / 1000000, a);
};
// speedTest2();