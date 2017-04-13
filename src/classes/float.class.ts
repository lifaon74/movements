
export class Float {
  static EPSILON_32: number = Math.pow(2, -23);
  static EPSILON_64: number = Math.pow(2, -52);
  static EPSILON: number = Number.EPSILON || Float.EPSILON_64;

  static DEFAULT_PRECISION: number = Float.EPSILON;

  static isNaN    = Number.isNaN;
  static isFinite = Number.isFinite;

  // .exec('-1.2e+3') => ["-1.2e+3", "-", "1", "2", "+", "3"]
  // sign, integer part, fractional part, exponential sign, exponential integer
  static regExp = /^([+-])?([\d]+)?(?:\.([\d]+))?(?:[eE]([+-])?([\d]+))?$/;


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

  static digits(number: number, digits: number) {
    return Float.round(number, Math.pow(10, Math.floor(Math.log10(number)) - digits + 1));
  }

  static ceil(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Math.ceil(number / precision) * precision;
  }

  static toString(number: number, precision: number = Float.DEFAULT_PRECISION) {
    return Float.round(number, precision).toString()
      .replace(Float.regExp, (...match: string[]) => {
        let str = '';
        if(match[1]) str += match[1];
        if(match[2]) str += match[2];

        let exp = Math.log10(precision);
        if(exp < 0) {
          if(match[3]) str += '.' + match[3].slice(0, -exp);
        }

        if(match[4]) str += 'e' + match[4];
        if(match[5]) str += match[5];

        return str;
      });
  }
}