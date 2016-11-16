
export class Float {
  static EPSILON_32: number = Math.pow(2, -23);
  static EPSILON_64: number = Math.pow(2, -52);
  static EPSILON: number = Number.EPSILON || Float.EPSILON_64;

  static DEFAULT_PRECISION: number = Float.EPSILON;

  static isNull(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.abs(number) < precision;
  }

  static equals(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.abs(number_0 - number_1) < precision;
  }

  static lessThan(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.round(number_0, precision) < Float.round(number_1, precision);
  }

  static lessThanOrEquals(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.round(number_0, precision) <= Float.round(number_1, precision);
  }

  static greaterThan(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.round(number_0, precision) > Float.round(number_1, precision);
  }

  static greaterThanOrEquals(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.round(number_0, precision) >= Float.round(number_1, precision);
  }

  static floor(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.floor(a / precision) * precision;
  }

  static round(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.round(a / precision) * precision;
  }

  static ceil(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.ceil(a / precision) * precision;
  }
}