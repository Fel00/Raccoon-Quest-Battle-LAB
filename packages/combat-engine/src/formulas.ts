import type { CombatantState, StatName } from "./types.js";

/** R-L17. Sem teto e sem piso. */
export function paGain(speed: number): number {
  return speed + 4;
}

export function stat(combatant: CombatantState, name: StatName): number {
  const base = combatant.base[name];
  const modifiers = combatant.effects.filter((effect) =>
    (effect.kind === "stat" || (effect.kind === "corrosion" && name === "defense"))
    && effect.stat === name,
  );
  const flat = modifiers
    .filter((effect) => !effect.percentage)
    .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
  const percent = modifiers
    .filter((effect) => effect.percentage)
    .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
  return base + flat + base * percent / 100;
}

/**
 * R-L20. Pontos já estão no número recebido.
 * `reduction` é a fração removida em seguida (0.15 remove 15%).
 * O teto de 90 só vale para defesa positiva. Defesa negativa usa 0,5% por ponto.
 * Crítico não chama esta função.
 */
export function defenseMultiplier(defensePoints: number, reduction = 0): number {
  const reduced = defensePoints * (1 - reduction);
  if (reduced >= 0) {
    const capped = Math.min(reduced, 90);
    return 1 - capped / 100;
  }
  return 1 + Math.abs(reduced) * 0.005;
}

/** R-L22. Taxa crítica e velocidade entram em pontos. Teto 100%. */
export function bleedCleanseChance(critRate: number, speed: number): number {
  return Math.min(100, 30 + critRate + speed) / 100;
}

/**
 * Precisão usada na rolagem, em pontos de 0 a 100.
 * R-L18 e R-L21.
 */
export function precisionForHit(
  combatant: CombatantState,
  options: { delta?: number; cannotReduce?: boolean } = {},
): number {
  const base = combatant.base.precision;
  const mods = combatant.effects
    .filter((effect) => effect.kind === "stat" && effect.stat === "precision")
  const flatMods = mods.filter((effect) => !effect.percentage).map((effect) => effect.amount ?? 0);
  const percentageMods = mods.filter((effect) => effect.percentage).map((effect) => effect.amount ?? 0);
  const usedFlatMods = options.cannotReduce ? flatMods.filter((amount) => amount > 0) : flatMods;
  const usedPercentageMods = options.cannotReduce
    ? percentageMods.filter((amount) => amount > 0)
    : percentageMods;
  const delta = options.delta ?? 0;
  const usedDelta = options.cannotReduce && delta < 0 ? 0 : delta;
  const raw = base
    + usedFlatMods.reduce((sum, amount) => sum + amount, 0)
    + base * usedPercentageMods.reduce((sum, amount) => sum + amount, 0) / 100
    + usedDelta;
  return Math.min(100, Math.max(0, raw));
}

export function critForHit(combatant: CombatantState, bonus = 0): number {
  return stat(combatant, "critRate") + bonus;
}

/** Dano de um golpe já sabido como acerto. Crítico ignora defesa e não multiplica. R-015, R-L02. */
export function strikeDamage(power: number, multiplier: number, defense: number, crit: boolean, defenseReduction = 0): number {
  const raw = power * multiplier;
  if (crit) return raw;
  return raw * defenseMultiplier(defense, defenseReduction);
}

/** R-026. Sangramento perde 5% da vida máxima após a ação do portador. */
export const BLEED_FRACTION_OF_MAX_HP = 0.05;

export function bleedDamage(maxHp: number): number {
  return maxHp * BLEED_FRACTION_OF_MAX_HP;
}
