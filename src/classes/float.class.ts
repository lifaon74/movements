
export class Float {
  static EPSILON_32: number = Math.pow(2, -23);
  static EPSILON_64: number = Math.pow(2, -52);
  static EPSILON: number = Number.EPSILON || Float.EPSILON_64;

  static DEFAULT_PRECISION: number = Float.EPSILON;

  static isNaN    = Number.isNaN;
  static isFinite = Number.isFinite;

  static isNull(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.abs(number) < precision;
  }

  static equalsNaN(number_0: number, number_1: number) {
    return Number.isNaN(number_0) && Number.isNaN(number_1);
  }

  static equals(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return (number_0 === number_1) || (Math.abs(number_0 - number_1) < precision);
  }

  static nonStrictEquals(number_0: number, number_1: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.equals(number_0, number_1, precision) || Float.equalsNaN(number_0, number_1);
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
    return Math.floor(number / precision) * precision;
  }

  static round(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.round(number / precision) * precision;
  }

  static ceil(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.ceil(number / precision) * precision;
  }
}