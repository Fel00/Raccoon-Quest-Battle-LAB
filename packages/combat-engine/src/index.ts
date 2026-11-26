import { critForHit, defenseMultiplier, paGain, precisionForHit, stat, strikeDamage } from "./formulas.js";
import { nextRandom, roll } from "./rng.js";
import {
  ActiveFieldEffect,
  AbilityDef,
  ActiveEffect,
  BattleSetup,
  BattleState,
  CombatantSetup,
  CombatantState,
  EffectDef,
  IllegalActionError,
  PlayerAction,
  SideId,
  TurnForecastEntry,
} from "./types.js";

export * from "./formulas.js";
export * from "./rng.js";
export * from "./types.js";

function addEvent(state: BattleState, type: string, payload: Record<string, unknown> = {}): void {
  state.events.push({ type, ...payload });
}

function resolveProphecy(state: BattleState): void {
  if (state.proof < 13 || state.activeId !== "falso-profeta") return;
  const prophet = state.combatants.find((combatant) => combatant.id === "falso-profeta");
  if (!prophet || !alive(prophet)) return;
  for (const opponent of state.combatants) {
    if (opponent.side === prophet.side) continue;
    opponent.hp = 0;
    opponent.alive = false;
    opponent.pa = 0;
  }
  addEvent(state, "prophecy-fulfilled", { combatantId: prophet.id, proof: state.proof });
  removeKOs(state);
}

function alive(combatant: CombatantState): boolean {
  return combatant.alive && combatant.hp > 0;
}

function hasPassive(combatant: CombatantState, passiveId: string): boolean {
  return combatant.passives.includes(passiveId) || combatant.borrowedPassives.includes(passiveId);
}

function canUseExtraFlask(combatant: CombatantState): boolean {
  return hasPassive(combatant, "setup-laboratorio") && combatant.extraFlasks > 0;
}

function endFieldEffectsOnKnockout(state: BattleState): void {
  if (state.fieldEffects.length === 0 || !state.combatants.some((combatant) => !alive(combatant))) return;
  for (const effect of state.fieldEffects) {
    addEvent(state, "field-effect-ended", { effect: effect.kind, reason: "combatant-defeated" });
  }
  state.fieldEffects = [];
}

function removeKOs(state: BattleState): void {
  for (const combatant of state.combatants) {
    if (!combatant.rigido && combatant.hp <= 0) {
      combatant.hp = 0;
      combatant.alive = false;
      combatant.pa = 0;
    }
  }
  endFieldEffectsOnKnockout(state);
  const sides = ["a", "b"] as const;
  for (const side of sides) {
    if (!state.combatants.some((combatant) => combatant.side === side && alive(combatant))) {
      if (state.winner === null) {
        const winner = side === "a" ? "b" : "a";
        state.winner = winner;
        state.phase = "ended";
        state.activeId = null;
        state.endReason = "team-defeat";
        addEvent(state, "battle-ended", { winner, endReason: state.endReason });
      }
    }
  }
}

function setupCombatant(setup: CombatantSetup): CombatantState {
  const maxHp = setup.maxHp;
  return {
    id: setup.id,
    spriteId: setup.spriteId ?? setup.id,
    spriteFolder: setup.spriteFolder,
    name: setup.name,
    side: setup.side,
    combatClass: setup.combatClass,
    maxHp,
    hp: setup.hp ?? maxHp,
    alive: (setup.hp ?? maxHp) > 0,
    base: {
      attack: setup.attack,
      imagination: setup.imagination,
      defense: setup.defense,
      speed: setup.speed,
      precision: setup.precision ?? 100,
      critRate: setup.critRate ?? 10,
    },
    pa: 0,
    abilities: setup.abilities ?? [],
    passives: setup.passives ?? [],
    borrowedPassives: [],
    usesProof: setup.usesProof ?? false,
    extraFlasks: setup.extraFlasks ?? (setup.passives?.includes("setup-laboratorio") ? 2 : 0),
    items: setup.items ?? [],
    effects: [],
    rigido: setup.rigido ?? (setup.passives?.includes("rigido") ?? false),
    fallsAfterNextAction: false,
    surviveLethalOnce: setup.surviveLethalOnce ?? false,
    surviveLethalUsed: false,
    nextAttackCritBonus: 0,
    stunnedTurnHealingFractions: [],
    slowSteadyPassCount: 0,
    neutralizeStatusModsAfterNextAction: false,
    summonSourceId: setup.summonSourceId,
    summonTemplateId: setup.summonTemplateId,
  };
}

function availableSummonSlots(state: BattleState, actor: CombatantState, ability: AbilityDef): number {
  const summon = ability.summon;
  if (!summon) return 0;
  const sourceId = `${actor.id}:${ability.id}`;
  const sourceCount = state.combatants.filter((combatant) =>
    combatant.side === actor.side
    && combatant.alive
    && combatant.summonSourceId === sourceId,
  ).length;
  const teamTemplateIds = new Set(summon.templates.map((template) => template.spriteId ?? template.id));
  const teamCount = state.combatants.filter((combatant) =>
    combatant.side === actor.side
    && combatant.alive
    && teamTemplateIds.has(combatant.summonTemplateId ?? combatant.spriteId),
  ).length;
  return Math.max(
    0,
    Math.min(
      summon.count ?? 1,
      (summon.maxAlive ?? Infinity) - sourceCount,
      (summon.teamMaxAlive ?? Infinity) - teamCount,
    ),
  );
}

function addSummonedCombatants(state: BattleState, actor: CombatantState, ability: AbilityDef): void {
  const summon = ability.summon;
  if (!summon) return;
  let remaining = Math.min(summon.count ?? 1, availableSummonSlots(state, actor, ability));
  const sourceId = `${actor.id}:${ability.id}`;
  let index = 0;
  while (remaining > 0) {
    let template = summon.templates[0];
    if (summon.templates.length > 1) {
      const random = nextRandom(state.rng);
      state.rng = random.state;
      template = summon.templates[Math.floor(random.value * summon.templates.length)];
    }
    if (!template) break;
    const summoned = setupCombatant({
      ...template,
      id: `${actor.id}-summon-${ability.id}-${state.actions.length}-${index}`,
      spriteId: template.spriteId ?? template.id,
      side: actor.side,
      summonSourceId: sourceId,
      summonTemplateId: template.spriteId ?? template.id,
    });
    state.combatants.push(summoned);
    for (const effect of summon.initialEffects ?? []) {
      const applied = applyCombatEffect(
        state,
        summoned,
        effect,
        state.round,
        ability.id,
        ++state.effectSequence,
        actor.side,
      );
      if (applied) addEvent(state, "effect-applied", { targetId: summoned.id, effect: applied.kind });
    }
    addEvent(state, "combatant-summoned", {
      combatantId: actor.id,
      targetId: summoned.id,
      name: summoned.name,
      abilityId: ability.id,
    });
    remaining -= 1;
    index += 1;
  }
}

export function createBattle(setup: BattleSetup): BattleState {
  if (setup.combatants.length < 2) throw new IllegalActionError("A battle needs at least two combatants.");
  const combatants = setup.combatants.map(setupCombatant);
  for (const ratKing of combatants.filter((combatant) => hasPassive(combatant, "mestre-ruas"))) {
    const alliedRogues = combatants.filter((combatant) =>
      combatant.side === ratKing.side
      && combatant.id !== ratKing.id
      && combatant.combatClass === "Ladino",
    );
    ratKing.base.attack += alliedRogues.length * 10;
    const knownAbilityIds = new Set(ratKing.abilities.map((ability) => ability.id));
    for (const rogue of alliedRogues) {
      for (const ability of rogue.abilities) {
        if (knownAbilityIds.has(ability.id)) continue;
        ratKing.abilities.push(ability);
        knownAbilityIds.add(ability.id);
      }
    }
  }
  const state: BattleState = {
    engineVersion: "0.2.0",
    rulesVersion: "2026-11-26",
    seed: setup.seed,
    rng: setup.seed >>> 0,
    round: 0,
    phase: "awaiting",
    combatants,
    fieldEffects: [],
    queue: [],
    queueIndex: 0,
    activeId: null,
    winner: null,
    endReason: null,
    proof: 0,
    lastAbility: null,
    effectSequence: 0,
    events: [],
    actions: [],
  };
  for (const side of ["a", "b"] as const) {
    const sideCombatants = state.combatants.filter((combatant) => combatant.side === side && alive(combatant));
    const bardCount = sideCombatants.filter((combatant) => combatant.combatClass === "Bardo").length;
    if (bardCount >= 2 && sideCombatants.some((combatant) => hasPassive(combatant, "uma-banda-grandiosa"))) {
      for (const combatant of sideCombatants) {
        applyEffect(combatant, { kind: "stat", stat: "speed", amount: 1 }, state.round, "uma-banda-grandiosa");
      }
    }
    if (bardCount >= 2) {
      for (const combatant of sideCombatants.filter((candidate) => hasPassive(candidate, "duetos-amigaveis"))) {
        applyEffect(combatant, { kind: "stat", stat: "speed", amount: 2 }, state.round, "duetos-amigaveis");
      }
    }
  }
  refreshThreatPassives(state);
  addEvent(state, "battle-started", { seed: setup.seed });
  return state;
}

function fieldStat(state: BattleState, combatant: CombatantState, name: Parameters<typeof stat>[1]): number {
  const base = stat(combatant, name);
  return name === "imagination" && state.fieldEffects.some((effect) => effect.kind === "sala-brincadeira")
    ? base + 10
    : base;
}

function applyFieldEffect(state: BattleState, ability: AbilityDef): void {
  if (!ability.fieldEffect) return;
  const existing = state.fieldEffects.find((effect) => effect.kind === ability.fieldEffect?.kind);
  const applied: ActiveFieldEffect = {
    kind: ability.fieldEffect.kind,
    roundsLeft: ability.fieldEffect.rounds,
    description: ability.fieldEffect.description,
  };
  if (existing) {
    existing.roundsLeft = applied.roundsLeft;
    existing.description = applied.description;
  } else {
    state.fieldEffects.push(applied);
  }
  addEvent(state, "field-effect-applied", { effect: applied.kind, roundsLeft: applied.roundsLeft });
}

function sumTeamSpeed(
  combatants: CombatantState[],
  side: BattleState["combatants"][number]["side"],
): number {
  return combatants
    .filter((combatant) => combatant.side === side && alive(combatant))
    .reduce((sum, combatant) => sum + stat(combatant, "speed"), 0);
}

function orderEligible(
  combatants: CombatantState[],
  initialRng: number,
): { ordered: CombatantState[]; rng: number } {
  const eligible = combatants.filter((combatant) =>
    alive(combatant) && (combatant.pa >= 10 || canUseExtraFlask(combatant)),
  );
  const randomRanks = new Map<string, number>();
  let rng = initialRng;
  for (const combatant of eligible) {
    const tieRoll = roll(rng, 0.5);
    rng = tieRoll.state;
    randomRanks.set(combatant.id, tieRoll.hit ? 1 : 0);
  }
  eligible.sort((left, right) => {
    if (right.pa !== left.pa) return right.pa - left.pa;
    if (stat(right, "speed") !== stat(left, "speed")) return stat(right, "speed") - stat(left, "speed");
    const teamDifference = sumTeamSpeed(combatants, right.side) - sumTeamSpeed(combatants, left.side);
    if (teamDifference !== 0) return teamDifference;
    return (randomRanks.get(left.id) ?? 0) - (randomRanks.get(right.id) ?? 0);
  });
  return { ordered: eligible, rng };
}

export function previewNextTurns(state: BattleState, count = 7): TurnForecastEntry[] {
  if (state.phase === "ended" || count <= 0) return [];

  const combatants = state.combatants.map((combatant) => ({ ...combatant }));
  let queue = [...state.queue];
  let queueIndex = state.activeId === null ? queue.length : state.queueIndex;
  let round = state.round;
  let rng = state.rng;
  let roundBoundaryPending = false;
  const forecast: TurnForecastEntry[] = [];

  while (forecast.length < count) {
    if (queueIndex >= queue.length) {
      round += 1;
      for (const combatant of combatants) {
        if (alive(combatant)) combatant.pa += paGain(stat(combatant, "speed"));
      }
      const nextQueue = orderEligible(combatants, rng);
      rng = nextQueue.rng;
      queue = nextQueue.ordered.map((combatant) => combatant.id);
      queueIndex = 0;
      roundBoundaryPending = true;

      if (queue.length === 0) {
        if (!combatants.some((combatant) => alive(combatant) && paGain(stat(combatant, "speed")) > 0)) break;
        continue;
      }
    }

    const combatantId = queue[queueIndex];
    const actor = combatants.find((combatant) => combatant.id === combatantId);
    if (!actor || !alive(actor) || actor.pa < 10) {
      queueIndex += 1;
      continue;
    }

    forecast.push({
      combatantId: actor.id,
      round,
      roundBoundaryBefore: roundBoundaryPending && forecast.length > 0,
    });
    roundBoundaryPending = false;
    if (actor.pa >= 10) actor.pa -= 10;
    else actor.extraFlasks -= 1;
    if (actor.pa < 10 && !canUseExtraFlask(actor)) queueIndex += 1;
  }

  return forecast;
}

export function settleRound(state: BattleState): BattleState {
  if (state.phase === "ended") return state;
  for (const combatant of state.combatants) {
    if (!alive(combatant)) continue;
    for (const effect of combatant.effects) {
      if (effect.roundsLeft !== undefined) effect.roundsLeft -= 1;
    }
    combatant.effects = combatant.effects.filter((effect) =>
      effect.roundsLeft === undefined || effect.roundsLeft > 0,
    );
  }
  for (const effect of state.fieldEffects) effect.roundsLeft -= 1;
  const expiredFieldEffects = state.fieldEffects.filter((effect) => effect.roundsLeft <= 0);
  state.fieldEffects = state.fieldEffects.filter((effect) => effect.roundsLeft > 0);
  for (const effect of expiredFieldEffects) {
    addEvent(state, "field-effect-ended", { effect: effect.kind, reason: "duration-expired" });
  }
  addEvent(state, "round-ended", { round: state.round });
  return state;
}

export function startRound(state: BattleState): BattleState {
  if (state.phase === "ended") return state;
  if (state.round > 0) {
    settleRound(state);
  }
  state.round += 1;
  for (const combatant of state.combatants) {
    if (!alive(combatant)) continue;
    combatant.pa += paGain(stat(combatant, "speed"));
  }
  if (state.round > 1
    && state.combatants.some((combatant) => alive(combatant) && combatant.usesProof)) {
    state.proof += 1;
    addEvent(state, "proof-increased", { amount: state.proof, round: state.round });
  }
  removeKOs(state);
  if (state.winner !== null) return state;

  const { ordered, rng } = orderEligible(state.combatants, state.rng);
  state.rng = rng;
  state.queue = ordered.map((combatant) => combatant.id);
  state.queueIndex = 0;
  state.activeId = state.queue[0] ?? null;
  state.phase = "awaiting";
  resolveProphecy(state);
  addEvent(state, "round-started", { round: state.round, queue: [...state.queue] });
  return state;
}

function getCombatant(state: BattleState, id: string): CombatantState {
  const combatant = state.combatants.find((candidate) => candidate.id === id);
  if (!combatant) throw new IllegalActionError(`Unknown combatant: ${id}`);
  return combatant;
}

function isStunned(combatant: CombatantState): boolean {
  return combatant.effects.some((effect) => effect.kind === "stun");
}

function payPA(combatant: CombatantState, cost: number): void {
  combatant.pa -= cost;
  if (combatant.pa < 0) {
    // Negative PA is preserved; the rule intentionally allows costly abilities to overspend.
  }
}

function payActionCost(state: BattleState, actor: CombatantState, cost: number): void {
  if (canUseExtraFlask(actor) && actor.pa < cost) {
    actor.extraFlasks -= 1;
    addEvent(state, "resource-spent", {
      combatantId: actor.id,
      resource: "extra-flasks",
      amount: 1,
    });
    return;
  }
  payPA(actor, cost);
}

function applyDefenses(state: BattleState, combatant: CombatantState, amount: number): number {
  if (combatant.rigido && combatant.hp <= 0) {
    endFieldEffectsOnKnockout(state);
    return 0;
  }
  const guard = combatant.effects.findIndex((effect) => effect.kind === "guard");
  if (amount > 0 && guard >= 0) {
    combatant.effects.splice(guard, 1);
    return 0;
  }
  const oldHp = combatant.hp;
  let applied = amount;
  if (combatant.surviveLethalOnce && !combatant.surviveLethalUsed && oldHp - applied <= 0) {
    combatant.surviveLethalUsed = true;
    applied = oldHp - 1;
    combatant.hp = 1;
    combatant.alive = true;
    combatant.effects = combatant.effects.filter((effect) => effect.kind !== "hidden");
    combatant.effects.push({
      id: `${combatant.id}-hidden-survival`,
      kind: "hidden",
      turnsLeft: 1,
    });
    return applied;
  }
  combatant.hp = Math.max(combatant.rigido && oldHp === 0 ? 0 : 0, oldHp - applied);
  if (combatant.hp <= 0 && !combatant.rigido) combatant.alive = false;
  if (combatant.hp <= 0 && combatant.rigido) combatant.fallsAfterNextAction = true;
  if (combatant.surviveLethalUsed && combatant.hp <= 0) {
    combatant.hp = 1;
    combatant.alive = true;
    combatant.effects = combatant.effects.filter((effect) => effect.kind !== "hidden");
    combatant.effects.push({
      id: `${combatant.id}-hidden-survival`,
      kind: "hidden",
      turnsLeft: 1,
    });
  }
  endFieldEffectsOnKnockout(state);
  return applied;
}

function applyEffect(
  combatant: CombatantState,
  effect: EffectDef,
  round: number,
  sourceId?: string,
  sequence?: number,
): ActiveEffect | null {
  if (effect.kind === "stun"
    && (combatant.effects.some((current) => current.kind === "stun-immunity")
      || hasPassive(combatant, "sono-eterno"))) {
    return null;
  }
  if (effect.kind === "ability-seal") {
    const index = combatant.effects.findIndex((current) =>
      current.kind === "ability-seal" && current.abilityId === effect.abilityId,
    );
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  if (effect.kind === "malediction") {
    const index = combatant.effects.findIndex((current) =>
      current.kind === "malediction" && current.sourceId === sourceId,
    );
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        amount: effect.amount,
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  const nonStackingStat = effect.kind === "stat"
    && sourceId !== undefined
    && (effect.stat === "speed" || effect.stat === "critRate" || sourceId === "maldicao");
  if (nonStackingStat) {
    const index = combatant.effects.findIndex((current) =>
      current.kind === "stat"
      && current.sourceId === sourceId
      && current.stat === effect.stat
      && current.percentage === effect.percentage,
    );
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        amount: effect.amount,
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  if (effect.kind === "hidden") {
    const canGain = combatant.lastHiddenGainRound === undefined || combatant.lastHiddenGainRound + 1 < round;
    if (!canGain) return null;
    combatant.lastHiddenGainRound = round;
  }
  if (effect.kind === "threat") {
    const index = combatant.effects.findIndex((current) => current.kind === "threat");
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  if (effect.kind === "bleed") {
    const index = combatant.effects.findIndex((current) => current.kind === "bleed");
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        amount: Math.max(combatant.effects[index].amount ?? 0, effect.amount ?? 0),
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  if (effect.kind === "camouflage"
    || effect.kind === "imagination-defense"
    || effect.kind === "imaginary-barrier") {
    const index = combatant.effects.findIndex((current) => current.kind === effect.kind);
    if (index >= 0) {
      const refreshed: ActiveEffect = {
        ...combatant.effects[index],
        turnsLeft: effect.turns,
        roundsLeft: effect.rounds,
        amount: effect.amount,
        percentage: effect.percentage,
        sourceId,
        sequence,
      };
      combatant.effects[index] = refreshed;
      return refreshed;
    }
  }
  const active: ActiveEffect = {
    id: `${combatant.id}-${effect.kind}-${combatant.effects.length}`,
    kind: effect.kind,
    turnsLeft: effect.turns,
    roundsLeft: effect.rounds,
    stat: effect.stat,
    amount: effect.amount,
    percentage: effect.percentage,
    abilityId: effect.abilityId,
    gainedRound: effect.kind === "hidden" ? round : undefined,
    sourceId,
    sequence,
  };
  if (effect.kind === "corrosion") {
    active.stat = "defense";
    active.amount = -10;
    active.turnsLeft = effect.turns ?? 2;
  }
  if (effect.kind === "hidden") {
    combatant.effects = combatant.effects.filter((current) => current.kind !== "hidden");
  }
  combatant.effects.push(active);
  return active;
}

function applyCombatEffect(
  state: BattleState,
  combatant: CombatantState,
  effect: EffectDef,
  round: number,
  sourceId?: string,
  sequence?: number,
  sourceSide?: SideId,
): ActiveEffect | null {
  if (effect.kind !== "bleed" || sourceSide === undefined) {
    return applyEffect(combatant, effect, round, sourceId, sequence);
  }

  const existingBleed = combatant.effects.find((current) => current.kind === "bleed");
  if (!existingBleed) return applyEffect(combatant, effect, round, sourceId, sequence);

  const sourceTeam = state.combatants.filter((ally) => ally.side === sourceSide && alive(ally));
  const adventureCount = sourceTeam.filter((ally) => ally.combatClass === "Aventureiro").length;
  const hasCooperation = sourceTeam.some((ally) => hasPassive(ally, "cooperacao-aditiva"));
  const upgradedAmount = hasCooperation
    ? adventureCount >= 3 ? 5 : adventureCount >= 2 ? 3 : existingBleed.amount ?? 0
    : existingBleed.amount ?? 0;
  const applied = applyEffect(combatant, { ...effect, amount: upgradedAmount }, round, sourceId, sequence);
  if (applied && hasCooperation && adventureCount >= 2) {
    for (const owner of sourceTeam.filter((ally) => hasPassive(ally, "cooperacao-aditiva"))) {
      const marker = owner.effects.find((current) => current.kind === "cooperation");
      if (marker) marker.amount = (marker.amount ?? 0) + 1;
      else applyEffect(owner, { kind: "cooperation", amount: 1 }, round, "cooperacao-aditiva");
      addEvent(state, "passive-triggered", {
        combatantId: owner.id,
        passiveId: "cooperacao-aditiva",
        stacks: marker ? marker.amount : 1,
      });
    }
  }
  return applied;
}

function targetCandidates(state: BattleState, actor: CombatantState, target: AbilityDef["target"]): CombatantState[] {
  if (target === "enemy" || target === "enemies") {
    return state.combatants.filter((candidate) =>
      candidate.side !== actor.side &&
      alive(candidate) &&
      !candidate.effects.some((effect) => effect.kind === "hidden"),
    );
  }
  if (target === "ally" || target === "allies") {
    return state.combatants.filter((candidate) => candidate.side === actor.side && alive(candidate));
  }
  if (target === "any") {
    return state.combatants.filter((candidate) =>
      alive(candidate) && !candidate.effects.some((effect) => effect.kind === "hidden"),
    );
  }
  if (target === "self") return [actor];
  return [];
}

function clearSerpentMark(combatant: CombatantState): void {
  combatant.effects = combatant.effects.filter((effect) =>
    effect.kind !== "serpent-mark"
    && effect.sourceId !== "fruto-tentacao"
    && effect.sourceId !== "beijo-judas",
  );
}

function heal(state: BattleState, combatant: CombatantState, amount: number, healer: CombatantState): void {
  const oldHp = combatant.hp;
  let healing = amount;
  let critical = false;
  if (hasPassive(healer, "voz-divina")) {
    const criticalRoll = roll(state.rng, Math.min(100, Math.max(0, stat(healer, "critRate"))) / 100);
    state.rng = criticalRoll.state;
    critical = criticalRoll.hit;
    if (critical) healing *= 2;
  }
  const hpBeforeCap = oldHp + healing;
  const overflow = Math.max(0, hpBeforeCap - combatant.maxHp);
  combatant.hp = Math.min(combatant.maxHp, hpBeforeCap);
  combatant.alive = true;
  const actual = combatant.hp - oldHp;
  clearSerpentMark(combatant);
  addEvent(state, "healed", {
    targetId: combatant.id,
    healerId: healer.id,
    amount: actual,
    critical,
    overflow,
  });
  if (overflow > 0 && hasPassive(healer, "fe-transbordante")) {
    const attackBonus = applyEffect(
      combatant,
      { kind: "stat", stat: "attack", amount: overflow * 0.2, rounds: 1 },
      state.round,
      "fe-transbordante",
    );
    if (attackBonus) {
      addEvent(state, "effect-applied", { targetId: combatant.id, effect: "stat" });
      addEvent(state, "passive-triggered", { combatantId: healer.id, passiveId: "fe-transbordante" });
    }
  }
  const chance = Math.min(1, (30 + healer.base.critRate + healer.base.speed) / 100);
  if (actual > 0) {
    const cleanse = roll(state.rng, chance);
    state.rng = cleanse.state;
    if (cleanse.hit) {
      combatant.effects = combatant.effects.filter((effect) => effect.kind !== "bleed");
    }

  }
}

function endOfActorAction(
  state: BattleState,
  actor: CombatantState,
  effectsAtActionStart: ReadonlySet<ActiveEffect>,
): void {
  if (actor.effects.some((effect) => effect.kind === "bleed")) {
    const bleedBonus = actor.effects
      .filter((effect) => effect.kind === "bleed")
      .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
    const curseBonus = actor.effects
      .filter((effect) => effect.kind === "malediction")
      .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
    const damage = actor.maxHp * (0.05 + bleedBonus / 100) + curseBonus;
    applyDefenses(state, actor, damage);
    addEvent(state, "bleed-damage", { combatantId: actor.id, amount: damage });
  }
  removeKOs(state);
  for (const effect of actor.effects) {
    if (!effectsAtActionStart.has(effect)) continue;
    if (effect.kind === "corrosion" && (effect.amount ?? 0) > -20) {
      effect.amount = Math.max(-20, (effect.amount ?? 0) - 10);
    }
    if (effect.turnsLeft !== undefined) effect.turnsLeft -= 1;
  }
  actor.effects = actor.effects.filter((effect) =>
    effect.turnsLeft === undefined || effect.turnsLeft > 0,
  );
  if (actor.neutralizeStatusModsAfterNextAction) {
    actor.effects = actor.effects.filter((effect) => effect.kind !== "stat");
    actor.neutralizeStatusModsAfterNextAction = false;
  }
}

function resetSlowAndSteady(state: BattleState, side: SideId): void {
  for (const combatant of state.combatants) {
    combatant.effects = combatant.effects.filter((effect) => effect.sourceId !== "devagar-sempre");
    if (combatant.side === side && hasPassive(combatant, "devagar-sempre")) {
      combatant.slowSteadyPassCount = 0;
    }
  }
}

function refreshThreatPassives(state: BattleState): void {
  for (const combatant of state.combatants.filter((candidate) => hasPassive(candidate, "constante-ameaca"))) {
    const sourceId = "constante-ameaca";
    const hasPassiveThreat = combatant.effects.some((effect) => effect.kind === "threat" && effect.sourceId === sourceId);
    if (!alive(combatant) || combatant.hp / combatant.maxHp <= 0.75) {
      combatant.effects = combatant.effects.filter((effect) => effect.sourceId !== sourceId);
      continue;
    }
    if (hasPassiveThreat || combatant.effects.some((effect) => effect.kind === "threat")) continue;
    const applied = applyEffect(combatant, { kind: "threat" }, state.round, sourceId);
    if (applied) addEvent(state, "effect-applied", { targetId: combatant.id, effect: applied.kind });
  }
}

function onAllyPassed(state: BattleState, passer: CombatantState): void {
  const oliver = state.combatants.find((combatant) =>
    combatant.side === passer.side && alive(combatant) && hasPassive(combatant, "devagar-sempre"),
  );
  if (oliver) {
    oliver.slowSteadyPassCount += 1;
    if (oliver.slowSteadyPassCount >= 1
      && !oliver.effects.some((effect) => effect.kind === "stat" && effect.stat === "defense" && effect.sourceId === "devagar-sempre")) {
      applyEffect(oliver, { kind: "stat", stat: "defense", amount: 20 }, state.round, "devagar-sempre");
    }
    if (oliver.slowSteadyPassCount === 2) {
      applyEffect(oliver, { kind: "threat" }, state.round, "devagar-sempre");
    }
    if (oliver.slowSteadyPassCount >= 3) {
      for (const ally of state.combatants.filter((combatant) => combatant.side === passer.side && alive(combatant))) {
        if (!ally.effects.some((effect) => effect.kind === "stat" && effect.stat === "defense" && effect.sourceId === "devagar-sempre")) {
          applyEffect(ally, { kind: "stat", stat: "defense", amount: 20 }, state.round, "devagar-sempre");
        }
      }
    }
    addEvent(state, "passive-triggered", {
      combatantId: oliver.id,
      passiveId: "devagar-sempre",
      passCount: oliver.slowSteadyPassCount,
    });
  }

  for (const dazy of state.combatants.filter((combatant) =>
    combatant.side === passer.side && alive(combatant) && hasPassive(combatant, "momento-paz"),
  )) {
    heal(state, dazy, dazy.maxHp * 0.15, dazy);
    addEvent(state, "passive-triggered", { combatantId: dazy.id, passiveId: "momento-paz" });
  }
  for (const hazard of state.combatants.filter((combatant) =>
    combatant.side !== passer.side && alive(combatant) && hasPassive(combatant, "oportunista-hazard"),
  )) {
    hazard.pa += 10;
    addEvent(state, "pa-gained", { targetId: hazard.id, amount: 10, sourceId: "oportunista-hazard" });
    addEvent(state, "passive-triggered", { combatantId: hazard.id, passiveId: "oportunista-hazard" });
  }
}

export function applyAction(state: BattleState, action: PlayerAction): BattleState {
  if (state.phase === "ended") throw new IllegalActionError("The battle has ended.");
  if (action.combatantId !== state.activeId) {
    throw new IllegalActionError(`It is not ${action.combatantId}'s turn.`);
  }
  const actor = getCombatant(state, action.combatantId);
  if (!alive(actor)) throw new IllegalActionError("A defeated combatant cannot act.");
  const pendingTarget = actor.pendingAttack
    ? state.combatants.find((combatant) => combatant.id === actor.pendingAttack?.targetId)
    : undefined;
  if (actor.pendingAttack
    && (!pendingTarget?.alive || pendingTarget.effects.some((effect) => effect.kind === "hidden"))) {
    addEvent(state, "pending-attack-cancelled", {
      combatantId: actor.id,
      abilityId: actor.pendingAttack.abilityId,
      reason: pendingTarget?.alive ? "target-hidden" : "target-defeated",
    });
    actor.pendingAttack = undefined;
  }
  if (actor.pendingAttack && !isStunned(actor)
    && (action.kind !== "ability"
      || action.abilityId !== actor.pendingAttack.abilityId
      || action.targetId !== actor.pendingAttack.targetId)) {
    throw new IllegalActionError("This combatant must complete its prepared attack before taking another action.");
  }
  if (action.targetId && !alive(getCombatant(state, action.targetId))) {
    throw new IllegalActionError("Defeated combatants cannot be targeted.");
  }
  const effectsAtActionStart = new Set(actor.effects);
  const actorStartedHidden = actor.effects.some((effect) => effect.kind === "hidden");
  const actionAbility = action.kind === "ability"
    ? actor.abilities.find((ability) => ability.id === action.abilityId)
    : undefined;
  const passesTurn = action.kind === "pass" || actionAbility?.passTurn === true;
  let itemContinuesTurn = false;
  state.actions.push({ ...action });
  if (hasPassive(actor, "devagar-sempre") && !passesTurn) {
    resetSlowAndSteady(state, actor.side);
  }

  if (isStunned(actor)) {
    const cost = 10;
    payPA(actor, cost);
    const healFraction = actor.stunnedTurnHealingFractions.shift();
    if (healFraction) heal(state, actor, actor.maxHp * healFraction, actor);
    addEvent(state, "turn-stunned", { combatantId: actor.id });
  } else if (action.kind === "pass") {
    const passCost = canUseExtraFlask(actor) && actor.pa < 10
      ? Math.max(0, actor.pa)
      : 10;
    payPA(actor, passCost);
    addEvent(state, "turn-passed", { combatantId: actor.id });
    onAllyPassed(state, actor);
  } else if (action.kind === "item") {
    const item = actor.items.find((candidate) => candidate.id === action.itemId);
    if (!item) throw new IllegalActionError(`Unknown item: ${action.itemId}`);
    if (item.charges <= 0) throw new IllegalActionError("The item has no charges.");
    item.charges -= 1;
    payActionCost(state, actor, 10);
    if (hasPassive(actor, "acao-imediata")) {
      itemContinuesTurn = true;
      addEvent(state, "passive-triggered", { combatantId: actor.id, passiveId: "acao-imediata" });
    }
    const targets = action.targetId
      ? [getCombatant(state, action.targetId)]
      : targetCandidates(state, actor, item.target);
    for (const target of targets) {
      if (item.heal?.flat) heal(state, target, item.heal.flat, actor);
      for (const effect of item.effects ?? []) {
        if (effect.chance !== undefined) {
          const rolled = roll(state.rng, effect.chance);
          state.rng = rolled.state;
          if (!rolled.hit) continue;
        }
        applyCombatEffect(state, target, effect, state.round, undefined, undefined, actor.side);
      }
    }
    addEvent(state, "item-used", { combatantId: actor.id, itemId: item.id, targetId: action.targetId });
  } else {
    const selectedAbility = actor.abilities.find((candidate) => candidate.id === action.abilityId);
    if (!selectedAbility) throw new IllegalActionError(`Unknown ability: ${action.abilityId}`);
    let ability = selectedAbility;
    const sealedAbility = actor.effects.find((effect) =>
      effect.kind === "ability-seal" && effect.abilityId === selectedAbility.id,
    );
    if (sealedAbility) throw new IllegalActionError("This ability is disabled for this turn.");
    const resolvingPendingAttack = actor.pendingAttack;
    if (resolvingPendingAttack) {
      ability = {
        ...selectedAbility,
        power: "physical",
        multiplier: resolvingPendingAttack.multiplier,
        prepareNextAttackMultiplier: undefined,
        selfEffects: undefined,
      };
      actor.pendingAttack = undefined;
    }
    if (selectedAbility.copyLastAbility) {
      if (!state.lastAbility?.power || !state.lastAbility.multiplier) {
        throw new IllegalActionError("There is no previous damage ability to copy.");
      }
      ability = {
        ...selectedAbility,
        power: state.lastAbility.power,
        multiplier: state.lastAbility.multiplier * 0.5,
        effects: state.lastAbility.effects,
      };
    }
    if (ability.power && state.fieldEffects.some((effect) => effect.kind === "sala-brincadeira")) {
      ability = {
        ...ability,
        power: "imaginary",
        powerStat: "imagination",
        combineAttackAndImagination: false,
      };
    }
    if (ability.useBelowHealthFraction !== undefined
      && actor.hp / actor.maxHp >= ability.useBelowHealthFraction) {
      throw new IllegalActionError("This ability can only be used below its health threshold.");
    }
    if (ability.summon && availableSummonSlots(state, actor, ability) === 0) {
      throw new IllegalActionError("This ability cannot summon any more combatants.");
    }
    payActionCost(state, actor, ability.cost ?? 10);
    if (ability.nextAttackCritBonus) {
      actor.nextAttackCritBonus = Math.max(actor.nextAttackCritBonus, ability.nextAttackCritBonus);
    }
    if (ability.stunnedTurnHealingFractions) {
      actor.stunnedTurnHealingFractions = [...ability.stunnedTurnHealingFractions];
    }
    if (ability.prepareNextAttackMultiplier && action.targetId) {
      actor.pendingAttack = {
        abilityId: ability.id,
        targetId: action.targetId,
        multiplier: ability.prepareNextAttackMultiplier,
      };
    }
    if (ability.condemnation) {
      const livingCombatants = state.combatants.filter(alive);
      const removedEffects = livingCombatants.reduce((total, combatant) => total + combatant.effects.length, 0);
      for (const combatant of livingCombatants) combatant.effects = [];
      ability = { ...ability, hits: removedEffects };
      for (let index = 0; index < removedEffects; index += 1) {
        heal(state, actor, actor.maxHp * 0.1, actor);
      }
    }
    if (!action.targetId
      && ability.target !== "allies"
      && ability.target !== "enemies"
      && ability.target !== "none"
      && ability.target !== "self") {
      throw new IllegalActionError("A target is required.");
    }
    if (action.targetId) {
      const selectedTarget = getCombatant(state, action.targetId);
      if (ability.target === "enemy" && selectedTarget.side === actor.side) {
        throw new IllegalActionError("This ability can only target an opponent.");
      }
      if (ability.target === "ally" && selectedTarget.side !== actor.side) {
        throw new IllegalActionError("This ability can only target an ally.");
      }
      if (ability.target === "self" && selectedTarget.id !== actor.id) {
        throw new IllegalActionError("This ability can only target its user.");
      }
      if (ability.targetMustHaveClass && selectedTarget.combatClass !== ability.targetMustHaveClass) {
        throw new IllegalActionError(`This ability can only target a ${ability.targetMustHaveClass}.`);
      }
      if (!ability.canTargetHidden
        && (ability.target === "enemy" || ability.target === "ally" || ability.target === "any")
        && selectedTarget.effects.some((effect) => effect.kind === "hidden")) {
        throw new IllegalActionError("Hidden combatants cannot be targeted.");
      }
    }
    let targets = action.targetId
      ? [getCombatant(state, action.targetId)]
      : targetCandidates(state, actor, ability.target);
    if (ability.targetSpeedGreaterThanActor) {
      targets = targets.filter((target) => stat(target, "speed") > stat(actor, "speed"));
    }
    if (ability.targetMustHaveClass
      && targets.some((target) => target.combatClass !== ability.targetMustHaveClass)) {
      throw new IllegalActionError(`This ability can only target a ${ability.targetMustHaveClass}.`);
    }
    if (!ability.canTargetHidden
      && (ability.target === "enemy" || ability.target === "enemies" || ability.target === "any")
      && targets.some((target) => target.effects.some((effect) => effect.kind === "hidden"))) {
      throw new IllegalActionError("Hidden combatants cannot be direct targets.");
    }
    if (ability.target === "enemy" || ability.target === "enemies" || ability.target === "any") {
      if (ability.power === "imaginary" && targets.some((target) =>
        hasPassive(target, "enganadora")
        && actor.side !== target.side
        && actor.effects.some((effect) => effect.kind === "serpent-mark"),
      )) {
        throw new IllegalActionError("The Serpent's passive prevents this marked attacker from targeting her with imaginary damage.");
      }
      if (ability.target === "enemy" && !ability.ignoreThreat) {
        const threatened = state.combatants.filter((target) =>
          target.side !== actor.side &&
          alive(target) &&
          target.effects.some((effect) => effect.kind === "threat"),
        );
        if (threatened.length > 0) {
          targets = targets.filter((target) => target.effects.some((effect) => effect.kind === "threat"));
        }
      }
    }
    if (ability.targetMustHaveEffect
      && targets.some((target) => !target.effects.some((effect) => effect.kind === ability.targetMustHaveEffect))) {
      throw new IllegalActionError("The selected target does not have the required status.");
    }
    if (ability.target === "enemy" && targets.length === 0) {
      throw new IllegalActionError("A threatened combatant must be targeted.");
    }
    if (ability.copyTargetPassives && targets[0]) {
      actor.borrowedPassives = [...new Set([
        ...targets[0].passives,
        ...targets[0].borrowedPassives,
      ])];
      addEvent(state, "passives-copied", {
        combatantId: actor.id,
        targetId: targets[0].id,
        passiveIds: [...actor.borrowedPassives],
      });
    }
    const actorHasConditionalEffect = Boolean(
      ability.conditionalMultiplier?.actorEffect
      && actor.effects.some((effect) => effect.kind === ability.conditionalMultiplier?.actorEffect),
    );
    if (actor.effects.some((effect) => effect.kind === "hidden")) {
      actor.effects = actor.effects.filter((effect) => effect.kind !== "hidden");
      addEvent(state, "effect-ended", { combatantId: actor.id, effect: "hidden" });
    }

    const pipRulesReady = Boolean(
      ability.power && actor.effects.some((effect) => effect.kind === "rules-of-pip"),
    );
    if (pipRulesReady) {
      actor.effects = actor.effects.filter((effect) => effect.kind !== "rules-of-pip");
      addEvent(state, "effect-ended", { combatantId: actor.id, effect: "rules-of-pip" });
    }
    let criticalHit = false;
    const nextAttackCritBonus = ability.power ? actor.nextAttackCritBonus : 0;
    if (ability.power) actor.nextAttackCritBonus = 0;
    for (const target of targets) {
      let connected = !ability.power;
      const targetsAlly = ability.target === "any" && target.side === actor.side;
      const allyBehavior = targetsAlly ? ability.allyTargetEffect : undefined;
      if (ability.id === "fruto-tentacao" && target.effects.some((effect) => effect.kind === "serpent-mark")) {
        clearSerpentMark(target);
      }
      if (ability.gainPA) {
        target.pa += ability.gainPA;
        addEvent(state, "pa-gained", { targetId: target.id, amount: ability.gainPA });
      }
      if (ability.power && ability.multiplier) {
        const hitCount = ability.condemnation ? (ability.hits ?? 0) : ability.hits ?? 1;
        for (let hit = 0; hit < hitCount; hit += 1) {
          const camouflagePenalty = ability.precisionCannotBeReduced
            ? 0
            : target.effects
              .filter((effect) => effect.kind === "camouflage")
              .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
          const dancePenalty = ability.precisionCannotBeReduced || !hasPassive(target, "dancinha") ? 0 : 40;
          const precision = ability.cannotMiss
            || pipRulesReady
            || (ability.cannotMissTargetEffect
              && target.effects.some((effect) => effect.kind === ability.cannotMissTargetEffect))
            ? 100
            : Math.max(0, precisionForHit(actor, {
              delta: ability.precisionDelta,
              cannotReduce: ability.precisionCannotBeReduced,
            }) - camouflagePenalty - dancePenalty);
          const accuracy = roll(state.rng, precision / 100);
          state.rng = accuracy.state;
          if (!accuracy.hit) {
            addEvent(state, "attack-missed", { attackerId: actor.id, targetId: target.id, abilityId: ability.id });
            continue;
          }
          connected = true;
          const alchemyBonus = hasPassive(actor, "alquimia-avancada")
            && target.effects.some((effect) => effect.kind === "corrosion")
            && target.effects.some((effect) => effect.kind === "instability")
              ? 30
              : 0;
          const critChance = pipRulesReady ? 100 : Math.min(100, Math.max(0, critForHit(
            actor,
            (ability.critBonus ?? 0) + alchemyBonus + nextAttackCritBonus,
          ))) / 100;
          const targetCritChance = targetsAlly ? Math.min(100, Math.max(0, critForHit(actor, alchemyBonus))) / 100 : critChance;
          const critical = roll(state.rng, targetCritChance);
          state.rng = critical.state;
          criticalHit ||= critical.hit;
          if (critical.hit && hasPassive(actor, "poder-excesso")) {
            for (const ally of state.combatants.filter((combatant) =>
              combatant.side === actor.side && alive(combatant),
            )) {
              const applied = applyEffect(
                ally,
                { kind: "stat", stat: "critRate", amount: 10, percentage: true, turns: 2 },
                state.round,
                "poder-excesso",
              );
              if (applied) addEvent(state, "effect-applied", { targetId: ally.id, effect: "stat" });
            }
            addEvent(state, "passive-triggered", { combatantId: actor.id, passiveId: "poder-excesso" });
          }
          if (critical.hit) {
            for (const rufus of state.combatants.filter((combatant) =>
              combatant.side === actor.side && alive(combatant) && hasPassive(combatant, "luz-guia"),
            )) {
              heal(state, rufus, rufus.maxHp * 0.1, rufus);
              addEvent(state, "passive-triggered", { combatantId: rufus.id, passiveId: "luz-guia" });
            }
          }
          if (critical.hit && hasPassive(actor, "setup-laboratorio")) {
            actor.extraFlasks = Math.min(3, actor.extraFlasks + 1);
            addEvent(state, "resource-gained", { combatantId: actor.id, resource: "extra-flasks", amount: 1 });
          }
          const power = ability.combineAttackAndImagination
            ? fieldStat(state, actor, "attack") + fieldStat(state, actor, "imagination")
            : fieldStat(state, actor, ability.powerStat ?? (ability.power === "physical" ? "attack" : "imagination"));
          const defense = target.effects.some((effect) => effect.kind === "imagination-defense")
            ? fieldStat(state, target, "imagination")
            : fieldStat(state, target, "defense");
          let damage = strikeDamage(
            power,
            ability.multiplier * (allyBehavior?.damageMultiplier ?? 1) + (
              ability.conditionalMultiplier
              && (
                (ability.conditionalMultiplier.actorEffect && actorHasConditionalEffect)
                || (ability.conditionalMultiplier.targetEffect
                  && target.effects.some((effect) => effect.kind === ability.conditionalMultiplier?.targetEffect))
              )
                ? ability.conditionalMultiplier.amount
                : 0
            ),
            defense,
            critical.hit,
            ability.defenseReduction,
          );
          if (ability.power === "imaginary") {
            const barrier = target.effects.find((effect) => effect.kind === "imaginary-barrier");
            if (barrier) damage *= Math.max(0, 1 - (barrier.amount ?? 20) / 100);
          }
          if (hasPassive(actor, "sangue-deus") || hasPassive(actor, "sangue-deus-chefe")) {
            if (target.effects.some((effect) => effect.kind === "bleed")) damage *= 1.2;
          }
          const targetHpBefore = target.hp;
          applyDefenses(state, target, damage);
          const damageReceived = targetHpBefore - target.hp;
          if (damageReceived > 0) {
            for (const henrietta of state.combatants.filter((combatant) =>
              combatant.side === target.side
              && alive(combatant)
              && hasPassive(combatant, "mae-furiosa")
              && target.hp / target.maxHp < 0.3,
            )) {
              const precisionEffect = henrietta.effects.find((effect) =>
                effect.kind === "stat"
                && effect.stat === "precision"
                && effect.sourceId === "mae-furiosa",
              );
              if (precisionEffect) precisionEffect.turnsLeft = 1;
              else applyEffect(
                henrietta,
                { kind: "stat", stat: "precision", amount: 20, turns: 1 },
                state.round,
                "mae-furiosa",
              );
              addEvent(state, "passive-triggered", { combatantId: henrietta.id, passiveId: "mae-furiosa" });
            }
          }
          if (damageReceived > 0
            && target.alive
            && target.id !== actor.id
            && targets.length === 1
            && hasPassive(target, "fofoqueiro-vulneravel")) {
            const attackReduction = applyEffect(
              target,
              { kind: "stat", stat: "attack", amount: -20 },
              state.round,
              "fofoqueiro-vulneravel",
              ++state.effectSequence,
            );
            if (attackReduction) addEvent(state, "effect-applied", { targetId: target.id, effect: "stat" });
            const hidden = applyEffect(
              target,
              { kind: "hidden", turns: 1 },
              state.round,
              "fofoqueiro-vulneravel",
              ++state.effectSequence,
            );
            if (hidden) addEvent(state, "effect-applied", { targetId: target.id, effect: "hidden" });
            target.neutralizeStatusModsAfterNextAction = true;
          }
          if (damageReceived > 0
            && target.id !== actor.id
            && hasPassive(target, "devagar-sempre")
            && target.slowSteadyPassCount >= 2) {
            const reflected = damageReceived * 0.5;
            applyDefenses(state, actor, reflected);
            addEvent(state, "damage", {
              attackerId: target.id,
              targetId: actor.id,
              abilityId: "devagar-sempre",
              amount: reflected,
              critical: false,
              power: "physical",
            });
          }
          addEvent(state, "damage", {
            attackerId: actor.id,
            targetId: target.id,
            abilityId: ability.id,
            amount: damage,
            critical: critical.hit,
            power: ability.power,
          });
          if (target.alive && target.id !== actor.id && ability.power === "physical"
            && hasPassive(target, "sistema-defesa")) {
            const retaliation = strikeDamage(
              stat(target, "attack"),
              0.5,
              stat(actor, "defense"),
              false,
            );
            applyDefenses(state, actor, retaliation);
            addEvent(state, "damage", {
              attackerId: target.id,
              targetId: actor.id,
              abilityId: "sistema-defesa",
              amount: retaliation,
              critical: false,
              power: "physical",
            });
            const bleedRoll = roll(state.rng, 0.2);
            state.rng = bleedRoll.state;
            if (bleedRoll.hit) {
              const applied = applyCombatEffect(
                state,
                actor,
                { kind: "bleed", turns: 2 },
                state.round,
                "sistema-defesa",
                ++state.effectSequence,
                target.side,
              );
              if (applied) addEvent(state, "effect-applied", { targetId: actor.id, effect: "bleed" });
            }
          }
          if (connected && target.alive && hasPassive(target, "corpo-amaldicoado")) {
            const applied = applyEffect(
              actor,
              { kind: "ability-seal", abilityId: ability.id, turns: 1 },
              state.round,
              "corpo-amaldicoado",
              ++state.effectSequence,
            );
            if (applied) addEvent(state, "effect-applied", { targetId: actor.id, effect: "ability-seal" });
            addEvent(state, "passive-triggered", { combatantId: target.id, passiveId: "corpo-amaldicoado" });
          }
          const selfEffects = critical.hit ? ability.onCriticalSelfEffects : ability.onNonCriticalSelfEffects;
          for (const effect of selfEffects ?? []) {
            const applied = applyCombatEffect(state, actor, effect, state.round, ability.id, undefined, actor.side);
            if (applied) addEvent(state, "effect-applied", { targetId: actor.id, effect: applied.kind });
          }
          const effects = [
            ...(ability.effects ?? []),
            ...(ability.conditionalEffects
              && target.effects.some((effect) => effect.kind === ability.conditionalEffects?.targetEffect)
              ? ability.conditionalEffects.effects
              : []),
          ];
          for (const effect of effects) {
            if (effect.chance !== undefined) {
              const effectRoll = roll(state.rng, effect.chance);
              state.rng = effectRoll.state;
              if (!effectRoll.hit) continue;
            }
            const applied = applyCombatEffect(state, target, effect, state.round, ability.id, undefined, actor.side);
            if (applied) addEvent(state, "effect-applied", { targetId: target.id, effect: applied.kind });
          }
        }
      }
      if (ability.power
        && connected
        && actorStartedHidden
        && target.alive
        && target.side !== actor.side) {
        for (const bass of state.combatants.filter((combatant) =>
          combatant.side === actor.side
          && combatant.id !== actor.id
          && alive(combatant)
          && hasPassive(combatant, "trabalho-sombras"),
        )) {
          const extraDamage = strikeDamage(stat(bass, "attack"), 1, stat(target, "defense"), false);
          applyDefenses(state, target, extraDamage);
          addEvent(state, "damage", {
            attackerId: bass.id,
            targetId: target.id,
            abilityId: "trabalho-sombras",
            amount: extraDamage,
            critical: false,
            power: ability.power,
          });
          addEvent(state, "passive-triggered", { combatantId: bass.id, passiveId: "trabalho-sombras" });
        }
      }
      if (ability.heal) {
        const baseStat = ability.heal.stat;
        const healAmount = (ability.heal.flat ?? 0) +
          ((baseStat ? fieldStat(state, actor, baseStat) : 0) * (ability.heal.multiplier ?? 0));
        heal(state, target, healAmount, actor);
      }
      if (ability.healFractionOfMaxHp) {
        heal(state, target, target.maxHp * ability.healFractionOfMaxHp, actor);
      }
      for (const effect of ability.effects ?? []) {
        if (ability.power) continue;
        if (effect.chance !== undefined) {
          const effectRoll = roll(state.rng, effect.chance);
          state.rng = effectRoll.state;
          if (!effectRoll.hit) continue;
        }
        if (ability.id === "fruto-tentacao" && effect.kind === "serpent-mark"
          && !target.effects.some((activeEffect) => activeEffect.kind === "serpent-mark")) {
          const markedTargets = state.combatants.flatMap((combatant) =>
            combatant.effects
              .filter((activeEffect) => activeEffect.kind === "serpent-mark")
              .map((activeEffect) => ({ combatant, effect: activeEffect })),
          );
          if (markedTargets.length >= 2) {
            const oldest = markedTargets.sort((left, right) =>
              (left.effect.sequence ?? 0) - (right.effect.sequence ?? 0),
            )[0];
            clearSerpentMark(oldest.combatant);
          }
        }
        const applied = applyCombatEffect(state, target, effect, state.round, ability.id, ++state.effectSequence, actor.side);
        if (applied) addEvent(state, "effect-applied", { targetId: target.id, effect: applied.kind });
      }
      if (ability.removeTargetEffect) {
        const previousLength = target.effects.length;
        target.effects = target.effects.filter((effect) => effect.kind !== ability.removeTargetEffect);
        if (target.effects.length !== previousLength) {
          addEvent(state, "effect-ended", { combatantId: target.id, effect: ability.removeTargetEffect });
        }
      }
      if (ability.consumeTargetEffect) {
        target.effects = target.effects.filter((effect) =>
          effect.kind !== ability.consumeTargetEffect
          && (ability.consumeTargetEffect !== "serpent-mark"
            || (effect.sourceId !== "fruto-tentacao" && effect.sourceId !== "beijo-judas")),
        );
      }
      if (allyBehavior && connected) {
        if (allyBehavior.healActor) {
          heal(state, actor, fieldStat(state, actor, allyBehavior.healActor.stat) * allyBehavior.healActor.multiplier, actor);
        }
        for (const effect of allyBehavior.targetEffects ?? []) {
          applyCombatEffect(state, target, effect, state.round, ability.id, ++state.effectSequence, actor.side);
        }
        if (allyBehavior.actorEffects?.some((effect) => effect.kind === "serpent-mark")) {
          clearSerpentMark(actor);
          const marks = state.combatants.flatMap((combatant) =>
            combatant.effects
              .filter((effect) => effect.kind === "serpent-mark")
              .map((effect) => ({ combatant, effect })),
          );
          if (marks.length >= 2) {
            const oldest = marks.sort((left, right) =>
              (left.effect.sequence ?? 0) - (right.effect.sequence ?? 0),
            )[0];
            clearSerpentMark(oldest.combatant);
          }
        }
        for (const effect of allyBehavior.actorEffects ?? []) {
          applyCombatEffect(state, actor, effect, state.round, ability.id, ++state.effectSequence, actor.side);
        }
        if (allyBehavior.actorGainPA) {
          actor.pa += allyBehavior.actorGainPA;
          addEvent(state, "pa-gained", { targetId: actor.id, amount: allyBehavior.actorGainPA });
        }
      }
    }
    if (ability.power
      && !pipRulesReady
      && criticalHit
      && hasPassive(actor, "inventando-regras")
      && !actor.effects.some((effect) => effect.kind === "rules-of-pip")) {
      const applied = applyEffect(actor, { kind: "rules-of-pip" }, state.round, "inventando-regras");
      if (applied) {
        addEvent(state, "effect-applied", { targetId: actor.id, effect: applied.kind });
        addEvent(state, "passive-triggered", { combatantId: actor.id, passiveId: "inventando-regras" });
      }
    }
    if (ability.camouflage) {
      for (const recipient of state.combatants.filter((combatant) =>
        combatant.side === actor.side
        && alive(combatant)
        && (combatant.id === actor.id
          || combatant.hp / combatant.maxHp < ability.camouflage!.alliesBelowHealthFraction),
      )) {
        const applied = applyEffect(recipient, {
          kind: "camouflage",
          amount: ability.camouflage.amount,
          turns: ability.camouflage.turns,
        }, state.round, ability.id);
        if (applied) addEvent(state, "effect-applied", { targetId: recipient.id, effect: applied.kind });
      }
    }
    for (const effect of ability.selfEffects ?? []) {
      if (effect.chance !== undefined) {
        const effectRoll = roll(state.rng, effect.chance);
        state.rng = effectRoll.state;
        if (!effectRoll.hit) continue;
      }
      const applied = applyCombatEffect(state, actor, effect, state.round, ability.id, ++state.effectSequence, actor.side);
      if (applied) addEvent(state, "effect-applied", { targetId: actor.id, effect: applied.kind });
    }
    if (ability.selfDamageFraction) {
      const selfDamage = actor.maxHp * ability.selfDamageFraction;
      applyDefenses(state, actor, selfDamage);
      addEvent(state, "damage", {
        attackerId: actor.id,
        targetId: actor.id,
        abilityId: ability.id,
        amount: selfDamage,
        critical: false,
      });
    }
    applyFieldEffect(state, ability);
    addSummonedCombatants(state, actor, ability);
    addEvent(state, "ability-used", { combatantId: actor.id, abilityId: ability.id, targetId: action.targetId });
    const alliedBards = state.combatants.filter((combatant) =>
      combatant.side === actor.side && alive(combatant) && combatant.combatClass === "Bardo",
    );
    if (actor.combatClass === "Bardo"
      && ability.power === undefined
      && alliedBards.length >= 3
      && alliedBards.some((combatant) => hasPassive(combatant, "uma-banda-grandiosa"))) {
      const allies = state.combatants.filter((combatant) => combatant.side === actor.side && alive(combatant));
      const random = nextRandom(state.rng);
      state.rng = random.state;
      const recipient = allies[Math.floor(random.value * allies.length)];
      if (recipient) {
        recipient.pa += 3;
        addEvent(state, "pa-gained", { targetId: recipient.id, amount: 3, sourceId: "uma-banda-grandiosa" });
      }
      for (const bard of alliedBards.filter((combatant) => hasPassive(combatant, "uma-banda-grandiosa"))) {
        const marker = bard.effects.find((effect) => effect.kind === "grand-band");
        if (marker) marker.amount = (marker.amount ?? 0) + 1;
        else applyEffect(bard, { kind: "grand-band", amount: 1 }, state.round, "uma-banda-grandiosa");
        addEvent(state, "passive-triggered", {
          combatantId: bard.id,
          passiveId: "uma-banda-grandiosa",
          stacks: marker ? marker.amount : 1,
        });
      }
      for (const ally of allies) {
        const applied = applyEffect(ally, { kind: "stun-immunity" }, state.round, "uma-banda-grandiosa");
        if (applied) addEvent(state, "effect-applied", { targetId: ally.id, effect: applied.kind });
      }
      addEvent(state, "passive-triggered", {
        combatantId: actor.id,
        passiveId: "uma-banda-grandiosa",
      });
    }
    if (ability.passTurn) {
      addEvent(state, "turn-passed", { combatantId: actor.id });
      onAllyPassed(state, actor);
    }
    if (ability.power && !selectedAbility.copyLastAbility) {
      state.lastAbility = { ...ability };
    }
  }

  endOfActorAction(state, actor, effectsAtActionStart);

  if (actor.rigido && actor.fallsAfterNextAction) {
    actor.hp = 0;
    actor.alive = false;
    removeKOs(state);
  }

  refreshThreatPassives(state);
  if (state.winner !== null) return state;

  if (actionAbility?.passTurn !== true
    && (action.kind !== "item" || itemContinuesTurn)
    && actor.pa >= 10
    && state.queue[state.queueIndex] === actor.id) {
    state.activeId = actor.id;
  } else if (!passesTurn && canUseExtraFlask(actor) && state.queue[state.queueIndex] === actor.id) {
    state.activeId = actor.id;
  } else {
    state.queueIndex += 1;
    while (state.queueIndex < state.queue.length && !alive(getCombatant(state, state.queue[state.queueIndex]))) {
      state.queueIndex += 1;
    }
    state.activeId = state.queue[state.queueIndex] ?? null;
  }

  if (!state.activeId) {
    state.phase = "round-start";
  } else {
    resolveProphecy(state);
  }
  return state;
}
