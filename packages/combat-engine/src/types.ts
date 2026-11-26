/** Versão do motor. Muda quando a resolução de uma regra muda. */
export const ENGINE_VERSION = "0.2.0";

/** Conjunto de decisões do registro usadas por este motor. */
export const RULES_VERSION = "2026-11-26";

export type SideId = "a" | "b";

export type StatName = "attack" | "imagination" | "defense" | "speed" | "precision" | "critRate";

export type EffectKind =
  | "bleed"
  | "stun"
  | "hidden"
  | "threat"
  | "stat"
  | "guard"
  | "corrosion"
  | "instability"
  | "serpent-mark"
  | "rules-of-pip"
  | "imagination-defense"
  | "camouflage"
  | "imaginary-barrier"
  | "stun-immunity"
  | "ability-seal"
  | "malediction"
  | "cooperation"
  | "grand-band";

/**
 * Duração em turnos cai na ação seguinte do portador (não na ação que aplicou).
 * Duração em rodadas cai no fim de cada rodada, e a rodada da aplicação conta.
 */
export interface EffectDef {
  kind: EffectKind;
  /** Chance de 0 a 1. Omitir = certeza, se o golpe acertou. */
  chance?: number;
  turns?: number;
  rounds?: number;
  stat?: StatName;
  amount?: number;
  percentage?: boolean;
  abilityId?: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  /** Substitui os 10 PA quando presente. R-L11. */
  cost?: number;
  target: "enemy" | "ally" | "any" | "self" | "enemies" | "allies" | "none";
  power?: "physical" | "imaginary";
  powerStat?: StatName;
  combineAttackAndImagination?: boolean;
  /** Multiplicador do atributo de dano. Cada golpe rola erro e crítico. */
  multiplier?: number;
  /** Quantidade de golpes. Cada um rola à parte. R-L02. */
  hits?: number;
  /** Soma na taxa crítica do personagem, em pontos percentuais. R-L19. */
  critBonus?: number;
  /** Alteração de precisão só deste uso, em pontos percentuais. */
  precisionDelta?: number;
  cannotMiss?: boolean;
  cannotMissTargetEffect?: EffectKind;
  /** Ignora penalidades que reduziriam a precisão deste uso. */
  precisionCannotBeReduced?: boolean;
  /** Fração da defesa, já somada em pontos, que este golpe remove antes do teto. R-L20. */
  defenseReduction?: number;
  heal?: { flat?: number; stat?: "attack" | "imagination" | "defense" | "speed"; multiplier?: number };
  effects?: EffectDef[];
  selfEffects?: EffectDef[];
  conditionalMultiplier?: { actorEffect?: EffectKind; targetEffect?: EffectKind; amount: number };
  conditionalEffects?: { targetEffect: EffectKind; effects: EffectDef[] };
  onCriticalSelfEffects?: EffectDef[];
  onNonCriticalSelfEffects?: EffectDef[];
  gainPA?: number;
  selfDamageFraction?: number;
  useBelowHealthFraction?: number;
  healFractionOfMaxHp?: number;
  copyLastAbility?: boolean;
  targetMustHaveEffect?: EffectKind;
  consumeTargetEffect?: EffectKind;
  removeTargetEffect?: EffectKind;
  condemnation?: boolean;
  allyTargetEffect?: {
    damageMultiplier?: number;
    healActor?: { stat: "attack" | "imagination" | "defense" | "speed"; multiplier: number };
    targetEffects?: EffectDef[];
    actorEffects?: EffectDef[];
    actorGainPA?: number;
  };
  nextAttackCritBonus?: number;
  prepareNextAttackMultiplier?: number;
  stunnedTurnHealingFractions?: number[];
  canTargetHidden?: boolean;
  ignoreThreat?: boolean;
  targetMustHaveClass?: string;
  targetSpeedGreaterThanActor?: boolean;
  passTurn?: boolean;
  copyTargetPassives?: boolean;
  camouflage?: { amount: number; turns: number; alliesBelowHealthFraction: number };
  fieldEffect?: {
    kind: "sala-brincadeira";
    rounds: number;
    description: string;
  };
  summon?: {
    templates: CombatantSetup[];
    count?: number;
    maxAlive?: number;
    teamMaxAlive?: number;
    initialEffects?: EffectDef[];
  };
}

export interface ItemDef {
  id: string;
  name: string;
  charges: number;
  target: AbilityDef["target"];
  heal?: AbilityDef["heal"];
  effects?: EffectDef[];
}

export interface CombatantSetup {
  id: string;
  spriteId?: string;
  spriteFolder?: "characters" | "enemies";
  name: string;
  side: SideId;
  combatClass?: string;
  maxHp: number;
  hp?: number;
  attack: number;
  imagination: number;
  defense: number;
  /** Velocidade de ficha. Também é a Velocidade base do desempate. */
  speed: number;
  precision?: number;
  critRate?: number;
  abilities?: AbilityDef[];
  passives?: string[];
  usesProof?: boolean;
  extraFlasks?: number;
  items?: ItemDef[];
  /** Permanece com 0 de vida e cai no fim do próximo turno. R-L23, Rígido. */
  rigido?: boolean;
  /** Uma vez por batalha, dano letal deixa com 1 de vida e Escondido por 1 rodada. */
  surviveLethalOnce?: boolean;
  summonSourceId?: string;
  summonTemplateId?: string;
}

export interface BattleSetup {
  seed: number;
  combatants: CombatantSetup[];
}

export interface ActiveEffect {
  id: string;
  kind: EffectKind;
  turnsLeft?: number;
  roundsLeft?: number;
  stat?: StatName;
  amount?: number;
  percentage?: boolean;
  abilityId?: string;
  /** A rodada em que Escondido foi ganho. R-025. */
  gainedRound?: number;
  sourceId?: string;
  sequence?: number;
}

export interface CombatantState {
  id: string;
  spriteId: string;
  spriteFolder?: "characters" | "enemies";
  name: string;
  side: SideId;
  combatClass?: string;
  maxHp: number;
  hp: number;
  alive: boolean;
  base: {
    attack: number;
    imagination: number;
    defense: number;
    speed: number;
    precision: number;
    critRate: number;
  };
  pa: number;
  abilities: AbilityDef[];
  passives: string[];
  usesProof: boolean;
  extraFlasks: number;
  items: ItemDef[];
  effects: ActiveEffect[];
  borrowedPassives: string[];
  rigido: boolean;
  /** Verdadeiro no início do turno em que Rígido deve cair. */
  fallsAfterNextAction: boolean;
  surviveLethalOnce: boolean;
  surviveLethalUsed: boolean;
  lastHiddenGainRound?: number;
  nextAttackCritBonus: number;
  pendingAttack?: { abilityId: string; targetId: string; multiplier: number };
  stunnedTurnHealingFractions: number[];
  slowSteadyPassCount: number;
  neutralizeStatusModsAfterNextAction: boolean;
  summonSourceId?: string;
  summonTemplateId?: string;
}

export type Phase = "round-start" | "awaiting" | "ended";

export interface BattleEvent {
  type: string;
  [key: string]: unknown;
}

export interface BattleState {
  engineVersion: string;
  rulesVersion: string;
  seed: number;
  rng: number;
  round: number;
  phase: Phase;
  combatants: CombatantState[];
  fieldEffects: ActiveFieldEffect[];
  /** Ordem fixa desta rodada. Não é reordenada no meio do esgotamento. R-L13. */
  queue: string[];
  queueIndex: number;
  activeId: string | null;
  winner: SideId | "draw" | null;
  endReason: string | null;
  /** Shared, once-per-round count while a living Prova user is present. */
  proof: number;
  lastAbility: AbilityDef | null;
  effectSequence: number;
  events: BattleEvent[];
  actions: PlayerAction[];
}

export interface TurnForecastEntry {
  combatantId: string;
  round: number;
  roundBoundaryBefore: boolean;
}

export interface ActiveFieldEffect {
  kind: "sala-brincadeira";
  roundsLeft: number;
  description: string;
}

export interface PlayerAction {
  combatantId: string;
  kind: "ability" | "item" | "pass";
  abilityId?: string;
  itemId?: string;
  targetId?: string;
}

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}
