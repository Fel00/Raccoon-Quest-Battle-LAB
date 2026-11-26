/** Gerador determinístico. O estado cabe num inteiro e vai para o registro da batalha. */
export function nextRandom(state: number): { value: number; state: number } {
  let next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next >>> 0 };
}

export function roll(state: number, chance: number): { hit: boolean; state: number } {
  if (chance <= 0) return { hit: false, state };
  if (chance >= 1) return { hit: true, state };
  const rolled = nextRandom(state);
  return { hit: rolled.value < chance, state: rolled.state };
}
