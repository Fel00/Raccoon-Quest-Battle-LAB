import { stat, type BattleState, type CombatantState, type PlayerAction } from "@raccoon/combat-engine";

type AbilityChoice = {
  ability: CombatantState["abilities"][number];
  target: CombatantState | undefined;
  score: number;
};

export function chooseEnemyAction(state: BattleState, enemy: CombatantState): PlayerAction {
  if (enemy.passives.includes("sono-eterno") || enemy.passives.includes("sono-eterno-chefe")) {
    const previousTurns = state.actions.filter((action) => action.combatantId === enemy.id).length;
    if (enemy.passives.includes("sono-eterno") && previousTurns > 0 && previousTurns % 2 === 1) {
      return { combatantId: enemy.id, kind: "pass" };
    }

    const opponents = state.combatants.filter((combatant) =>
      combatant.side !== enemy.side
      && combatant.alive
      && combatant.hp > 0
      && !combatant.effects.some((effect) => effect.kind === "hidden"),
    );
    const threatened = opponents.filter((combatant) =>
      combatant.effects.some((effect) => effect.kind === "threat"),
    );
    const validTargets = threatened.length > 0 ? threatened : opponents;
    const bleedingTargets = validTargets.filter((combatant) =>
      combatant.effects.some((effect) => effect.kind === "bleed"),
    );
    const target = bleedingTargets.length > 0
      ? bleedingTargets.sort((left, right) => left.hp - right.hp)[0]
      : validTargets.length > 0
        ? validTargets[Math.abs(state.rng) % validTargets.length]
        : undefined;
    const abilities = enemy.abilities.filter((ability) =>
      ability.target === "enemy" || ability.target === "enemies",
    );
    const ability = abilities.length > 0
      ? abilities[Math.abs(state.rng ^ previousTurns) % abilities.length]
      : undefined;

    return ability
      ? {
        combatantId: enemy.id,
        kind: "ability",
        abilityId: ability.id,
        targetId: ability.target === "enemy" ? target?.id : undefined,
      }
      : { combatantId: enemy.id, kind: "pass" };
  }

  if (enemy.pendingAttack) {
    const target = state.combatants.find((combatant) => combatant.id === enemy.pendingAttack?.targetId);
    if (target?.alive && !target.effects.some((effect) => effect.kind === "hidden")) {
      return {
        combatantId: enemy.id,
        kind: "ability",
        abilityId: enemy.pendingAttack.abilityId,
        targetId: enemy.pendingAttack.targetId,
      };
    }
    return { combatantId: enemy.id, kind: "pass" };
  }
  const livingAllies = state.combatants.filter(
    (combatant) => combatant.side === enemy.side && combatant.alive && combatant.hp > 0,
  );
  const opponents = state.combatants.filter((combatant) =>
    combatant.side !== enemy.side
    && combatant.alive
    && combatant.hp > 0
    && !combatant.effects.some((effect) => effect.kind === "hidden"),
  );
  const choices = enemy.abilities.flatMap((ability): AbilityChoice[] => {
    if (ability.copyLastAbility && (!state.lastAbility?.power || !state.lastAbility.multiplier)) return [];
    if (ability.useBelowHealthFraction !== undefined
      && enemy.hp / enemy.maxHp >= ability.useBelowHealthFraction) return [];
    if (ability.summon) {
      const sourceId = `${enemy.id}:${ability.id}`;
      const sourceCount = state.combatants.filter((combatant) =>
        combatant.side === enemy.side
        && combatant.alive
        && combatant.summonSourceId === sourceId,
      ).length;
      const templateIds = new Set(ability.summon.templates.map((template) => template.spriteId ?? template.id));
      const teamCount = state.combatants.filter((combatant) =>
        combatant.side === enemy.side
        && combatant.alive
        && templateIds.has(combatant.summonTemplateId ?? combatant.spriteId),
      ).length;
      if (sourceCount >= (ability.summon.maxAlive ?? Number.POSITIVE_INFINITY)
        || teamCount >= (ability.summon.teamMaxAlive ?? Number.POSITIVE_INFINITY)) return [];
    }

    let targets: CombatantState[] = [];
    if (ability.target === "enemy") {
      const threatened = opponents.filter((target) => target.effects.some((effect) => effect.kind === "threat"));
      targets = threatened.length > 0 && !ability.ignoreThreat ? threatened : opponents;
    } else if (ability.target === "ally" || ability.target === "allies") {
      targets = livingAllies;
    } else if (ability.target === "self") {
      targets = [enemy];
    } else if (ability.target === "enemies") {
      targets = opponents;
    } else if (ability.target === "any") {
      targets = [...livingAllies, ...opponents];
    }

    if ((ability.target === "enemy" || ability.target === "ally" || ability.target === "self")
      && targets.length === 0) return [];
    if (ability.targetMustHaveClass) {
      targets = targets.filter((target) => target.combatClass === ability.targetMustHaveClass);
      if (targets.length === 0) return [];
    }
    if (ability.targetSpeedGreaterThanActor) {
      targets = targets.filter((target) => stat(target, "speed") > stat(enemy, "speed"));
      if (targets.length === 0) return [];
    }
    if (ability.targetMustHaveEffect) {
      targets = targets.filter((target) =>
        target.effects.some((effect) => effect.kind === ability.targetMustHaveEffect),
      );
      if (!targets.length) return [];
    }

    const power = ability.copyLastAbility ? state.lastAbility?.power : ability.power;
    const multiplier = ability.copyLastAbility
      ? (state.lastAbility?.multiplier ?? 0) * 0.5
      : ability.multiplier;
    let score = power && multiplier
      ? multiplier * (power === "physical" ? stat(enemy, "attack") : stat(enemy, "imagination"))
      : 0;
    if (ability.target === "enemies") score *= Math.max(targets.length, 1);
    if (ability.heal || ability.healFractionOfMaxHp) {
      const healAmount = (ability.heal?.flat ?? 0)
        + (ability.heal?.stat ? stat(enemy, ability.heal.stat) * (ability.heal.multiplier ?? 0) : 0)
        + enemy.maxHp * (ability.healFractionOfMaxHp ?? 0);
      const missingHp = targets.reduce((sum, target) => sum + Math.max(0, target.maxHp - target.hp), 0);
      score += Math.min(healAmount * Math.max(targets.length, 1), missingHp) * 2;
    }
    if ((ability.effects ?? []).some((effect) => effect.kind === "stat" || effect.kind === "threat")) {
      const alreadyApplied = targets.some((target) => (ability.effects ?? []).every((effect) =>
        target.effects.some((activeEffect) =>
          activeEffect.kind === effect.kind
          && activeEffect.stat === effect.stat
          && activeEffect.amount === effect.amount,
        ),
      ));
      score += alreadyApplied ? -20 : power ? 5 : 25;
    }
    if (ability.effects?.some((effect) => effect.kind === "bleed" || effect.kind === "stun")) score += 12;
    if (ability.prepareNextAttackMultiplier) score += 20;
    if (ability.summon) score += 55;

    const target = targets
      .slice()
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
    return [{ ability, target, score }];
  });
  choices.sort((left, right) => right.score - left.score);
  const choice = choices[0];
  if (!choice) return { combatantId: enemy.id, kind: "pass" };

  return {
    combatantId: enemy.id,
    kind: "ability",
    abilityId: choice.ability.id,
    targetId: choice.ability.target === "self" ? enemy.id : choice.target?.id,
  };
}
