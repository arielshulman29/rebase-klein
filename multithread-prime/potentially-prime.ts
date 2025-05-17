function powerAndMod(base: number, exponent: number, mod: number): number {
  let result = 1;
  base = base % mod;
  while (exponent > 0) {
    if (exponent % 2 === 1) {
      result = (result * base) % mod;
    }
    exponent = Math.floor(exponent / 2);
    base = (base * base) % mod;
  }
  return result;
}

function getPowerAndOddMultiply(oddCandidate: number): [number, number] {
  let power = 0;
  let oddMultiply = oddCandidate - 1;
  while (oddMultiply % 2 === 0) {
    oddMultiply /= 2;
    power++;
  }
  return [oddMultiply, power];
}

function getRandomBase(num: number): number {
/* random base a such that 2 <= base <= n - 2 */
  return 2 + Math.floor(Math.random() * (num - 3));
}

const maxItterationCount = 10;
export function isProbablyPrime(candidate: number): boolean {
  if (candidate === 2 || candidate === 3) return true;
  if (candidate < 2 || candidate % 2 === 0 || candidate % 3 === 0) return false;
  /* candidate - 1 = 2^power * oddMultiply */
  const [oddMultiply, power] = getPowerAndOddMultiply(candidate);
  let isComposite = true;
  for (let i = 0; i < maxItterationCount; i++) {
    const randomBase = getRandomBase(candidate);
    let x = powerAndMod(randomBase, oddMultiply, candidate);
    if (x === 1 || x === candidate - 1) continue;

    for (let r = 1; r < power; r++) {
      x = powerAndMod(x, 2, candidate);
      if (x === candidate - 1) {
        isComposite = false;
        break;
      }
    }

    if (isComposite) return false; // definitely composite
  }

  return true; // probably prime
}

// console.log(isProbablyPrime(1_000_001)) //not prime
// console.log(isProbablyPrime(10_000_019)) //prime
// console.log(isProbablyPrime(1_000_003)) //prime