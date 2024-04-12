function gcd(a: number, b: number) {
  if (!a) return b;
  if (!b) return a;
  while (true) {
    a %= b;
    if (!a) return b;
    b %= a;
    if (!b) return a;
  }
}

/*********
 * This is a port of the bare minimum functionality from the 'fraction.js'
 * npm package to suit the needs of dealing with fractional beat offsets.
 * The original package has types written in a strange way that doesn't make
 * typescript happy when in pure ESM mode.
 *
 * This file and the original implementation are available under the MIT license.
 * See: https://github.com/infusion/Fraction.js/blob/master/fraction.js
 *********/
export class Fraction {
  constructor(
    public n: number,
    public d: number = 1,
  ) {}

  add(f: Fraction) {
    if (f.d === this.d) {
      return new Fraction(this.n + f.n, this.d);
    }
    return new Fraction(this.n * f.d + this.d * f.n, this.d * f.d).simplify();
  }

  sub(f: Fraction) {
    if (f.d === this.d) {
      return new Fraction(this.n - f.n, this.d);
    }
    return new Fraction(this.n * f.d - this.d * f.n, this.d * f.d).simplify();
  }

  mult(f: Fraction) {
    return new Fraction(this.n * f.n, this.d * f.d).simplify();
  }

  mod(f: Fraction) {
    return new Fraction((f.d * this.n) % (f.n * this.d), f.d * this.d);
  }

  simplify() {
    const reduceBy = gcd(this.n, this.d);
    return new Fraction(this.n / reduceBy, this.d / reduceBy);
  }

  valueOf() {
    return this.n / this.d;
  }

  toFixed(digits?: number) {
    return this.valueOf().toFixed(digits);
  }

  toString() {
    return this.valueOf().toString();
  }
}
