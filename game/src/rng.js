// A small seeded random number generator (splitmix32): the same seed gives the
// same game, which is what makes the screenshot scenes repeatable.

export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}
