const MOTOR_STEPS = 200;
const MICROSTEPS = 16;
const stepsPerTurn = MOTOR_STEPS * MICROSTEPS;//6400  => /160

const ACCELERATION_LIMIT = stepsPerTurn / (1 / 16);
const SPEED_LIMIT = stepsPerTurn / (1 / 4); // 1 turn / s | max 6.25
const JERK_LIMIT = stepsPerTurn / (16 / 1);


export const config: any = {
  pwm: [
    {
      usage: 'extruder:1'
    },
    {
      usage: 'bed:1'
    }
  ],
  steppers: [
    {
      usage: 'axis:x',
      accelerationLimit: ACCELERATION_LIMIT,
      speedLimit: SPEED_LIMIT,
      jerkLimit: JERK_LIMIT,
      stepsPerMm: stepsPerTurn / 40
    },
    {
      usage: 'axis:y',
      accelerationLimit: ACCELERATION_LIMIT,
      speedLimit: SPEED_LIMIT,
      jerkLimit: JERK_LIMIT,
      stepsPerMm: stepsPerTurn / 40
    },
    {
      usage: 'axis:z',
      accelerationLimit: ACCELERATION_LIMIT,
      speedLimit: SPEED_LIMIT,
      jerkLimit: JERK_LIMIT,
      stepsPerMm: (stepsPerTurn * 5.21)  / 40
    },
    {
      usage: 'extruder:1',
      accelerationLimit: 1e10,
      speedLimit: SPEED_LIMIT,
      jerkLimit: JERK_LIMIT,
      stepsPerMm: stepsPerTurn / 31.4
    },
  ],
  inputs: [
    {
      usage: 'axis:x:min',
      active: 1 // state if which the input is 'active'
    },
    {
      usage: 'axis:x:max',
      active: 1 // state if which the input is 'active'
    }
  ],
  adc: [
    {
      usage: 'extruder:1:temperature'
    }
  ]
};
