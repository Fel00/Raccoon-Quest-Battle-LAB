import { describe, expect, it } from "vitest";
import {
  applyAction,
  createBattle,
  defenseMultiplier,
  paGain,
  previewNextTurns,
  settleRound,
  stat,
  startRound,
  strikeDamage,
} from "../packages/combat-engine/src/index.js";

function setup(combatantOverrides: Record<string, unknown> = {}) {
  return {
    seed: 1234,
    combatants: [
      {
        id: "pip",
        name: "Pip",
        side: "a" as const,
        maxHp: 600,
        attack: 30,
        imagination: 40,
        defense: 30,
        speed: 6,
        precision: 100,
        critRate: 10,
        abilities: [
          {
            id: "hit",
            name: "Hit",
            target: "enemy" as const,
            power: "physical" as const,
            multiplier: 1,
          },
        ],
        ...combatantOverrides,
      },
      {
        id: "enemy",
        name: "Enemy",
        side: "b" as const,
        maxHp: 400,
        attack: 20,
        imagination: 20,
        defense: 20,
        speed: 2,
        precision: 100,
        critRate: 10,
        abilities: [],
      },
    ],
  };
}

describe("combat engine core", () => {
  it("gains speed plus four PA and requires ten to act", () => {
    expect(paGain(3)).toBe(7);
    expect(paGain(6)).toBe(10);
  });

  it("gives a fast character repeated turns until its PA is below ten", () => {
    const state = startRound(createBattle(setup({ speed: 16 })));
    expect(state.queue).toEqual(["pip"]);
    expect(state.activeId).toBe("pip");

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(state.activeId).toBe("pip");
  });

  it("adds summoned combatants dynamically and enforces their living limit", () => {
    const state = startRound(createBattle(setup({
      speed: 16,
      abilities: [{
        id: "call-helper",
        name: "Call helper",
        target: "none" as const,
        summon: {
          templates: [{
            id: "helper",
            name: "Helper",
            side: "a" as const,
            maxHp: 80,
            attack: 10,
            imagination: 0,
            defense: 5,
            speed: 3,
          }],
          maxAlive: 1,
        },
      }],
    })));

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "call-helper" });

    const helper = state.combatants.find((combatant) => combatant.name === "Helper");
    expect(helper).toMatchObject({ side: "a", alive: true, summonSourceId: "pip:call-helper" });
    expect(state.activeId).toBe("pip");
    expect(() => applyAction(state, {
      combatantId: "pip",
      kind: "ability",
      abilityId: "call-helper",
    })).toThrow("cannot summon any more combatants");
  });

  it("forecasts repeated actions from 20 PA across a round boundary without mutating battle state", () => {
    const state = startRound(createBattle(setup({ speed: 16 })));
    const rngBeforePreview = state.rng;

    const forecast = previewNextTurns(state, 3);

    expect(forecast.map((entry) => entry.combatantId)).toEqual(["pip", "pip", "pip"]);
    expect(forecast.map((entry) => entry.round)).toEqual([1, 1, 2]);
    expect(forecast.map((entry) => entry.roundBoundaryBefore)).toEqual([false, false, true]);
    expect(state.combatants[0].pa).toBe(20);
    expect(state.rng).toBe(rngBeforePreview);
  });

  it("rolls a critical per hit and ignores defense", () => {
    expect(strikeDamage(100, 1, 90, false)).toBeCloseTo(10);
    expect(strikeDamage(100, 1, 90, true)).toBe(100);
  });

  it("caps positive defense at ninety percent", () => {
    expect(defenseMultiplier(100)).toBeCloseTo(0.1);
    expect(defenseMultiplier(-20)).toBeCloseTo(1.1);
  });

  it("passes and consumes ten PA", () => {
    const state = startRound(createBattle(setup()));
    applyAction(state, { combatantId: "pip", kind: "pass" });
    expect(state.combatants[0].pa).toBe(0);
  });

  it("refreshes Ameaça without stacking duplicate status markers", () => {
    const state = createBattle(setup({
      speed: 20,
      abilities: [{
        id: "threat",
        name: "Threat",
        target: "self",
        effects: [{ kind: "threat", turns: 3 }],
      }],
    }));
    state.combatants[0].pa = 20;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "threat", targetId: "pip" });
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "threat", targetId: "pip" });

    expect(state.combatants[0].effects.filter((effect) => effect.kind === "threat")).toHaveLength(1);
    expect(state.combatants[0].effects.find((effect) => effect.kind === "threat")?.turnsLeft).toBe(3);
  });

  it("keeps a self-applied Hidden effect until the character's next action", () => {
    const state = createBattle(setup({
      speed: 6,
      abilities: [{
        id: "hide",
        name: "Hide",
        target: "self",
        selfEffects: [{ kind: "hidden", turns: 1 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hide", targetId: "pip" });

    expect(state.combatants[0].effects.some((effect) => effect.kind === "hidden")).toBe(true);
  });

  it("locks a prepared Hazard attack to the originally selected target", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "hazard",
          name: "Hazard",
          side: "a",
          maxHp: 100,
          attack: 20,
          imagination: 10,
          defense: 0,
          speed: 4,
          abilities: [
            {
              id: "sombra-hazard",
              name: "Aquele que jaz nas sombras",
              target: "enemy",
              prepareNextAttackMultiplier: 3,
              selfEffects: [{ kind: "hidden", turns: 1 }],
            },
            { id: "other", name: "Other", target: "enemy", power: "physical", multiplier: 1 },
          ],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "other-enemy",
          name: "Other Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    const hazard = state.combatants[0];
    hazard.pa = 20;
    state.queue = ["hazard"];
    state.activeId = "hazard";

    applyAction(state, {
      combatantId: "hazard",
      kind: "ability",
      abilityId: "sombra-hazard",
      targetId: "enemy",
    });
    expect(hazard.hp).toBe(100);
    expect(state.combatants[1].hp).toBe(100);
    expect(hazard.pendingAttack).toEqual({ abilityId: "sombra-hazard", targetId: "enemy", multiplier: 3 });
    expect(() => applyAction(state, { combatantId: "hazard", kind: "ability", abilityId: "other", targetId: "other-enemy" }))
      .toThrow("must complete its prepared attack");

    applyAction(state, {
      combatantId: "hazard",
      kind: "ability",
      abilityId: "sombra-hazard",
      targetId: "enemy",
    });
    expect(state.combatants[1].hp).toBeLessThan(100);
    expect(hazard.hp).toBe(100);
    expect(hazard.pendingAttack).toBeUndefined();
  });

  it("keeps Harold's Meditation bonus until the end of his next turn", () => {
    const state = createBattle(setup({
      speed: 16,
      critRate: 50,
      abilities: [
        {
          id: "meditacao-harold",
          name: "Meditação",
          target: "self",
          selfEffects: [{ kind: "stat", stat: "critRate", amount: 50, turns: 1 }],
        },
        { id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 },
      ],
    }));
    state.combatants[0].pa = 20;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "meditacao-harold", targetId: "pip" });
    expect(stat(state.combatants[0], "critRate")).toBe(100);
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(stat(state.combatants[0], "critRate")).toBe(50);
    expect(state.events.find((event) => event.type === "damage")).toMatchObject({ critical: true });
  });

  it("activates Pip's rules passive after a critical and consumes it on the next attack", () => {
    const state = createBattle(setup({
      speed: 16,
      critRate: 100,
      passives: ["inventando-regras"],
      abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
    }));
    const pip = state.combatants[0];
    pip.pa = 30;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(pip.effects.some((effect) => effect.kind === "rules-of-pip")).toBe(true);

    pip.base.precision = 0;
    pip.base.critRate = 0;
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    const pipDamage = state.events.filter((event) => event.type === "damage" && event.attackerId === "pip");
    expect(pipDamage[1]).toMatchObject({ critical: true });
    expect(state.events.some((event) => event.type === "attack-missed")).toBe(false);
    expect(pip.effects.some((effect) => effect.kind === "rules-of-pip")).toBe(false);
  });

  it("applies Uma banda grandiosa's permanent team speed and stun immunity", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 3,
          passives: ["uma-banda-grandiosa"],
          abilities: [{ id: "support", name: "Support", target: "self" }],
        },
        {
          id: "chirp",
          name: "Chirp",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 4,
          passives: ["duetos-amigaveis"],
          abilities: [],
        },
        {
          id: "bard-three",
          name: "Bard Three",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 5,
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 500,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    expect(state.combatants.slice(0, 3).map((combatant) => stat(combatant, "speed"))).toEqual([4, 7, 6]);
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "support", targetId: "pip" });

    expect(state.combatants.slice(0, 3).every((combatant) =>
      combatant.effects.some((effect) => effect.kind === "stun-immunity"),
    )).toBe(true);
    expect(state.events.some((event) =>
      event.type === "pa-gained" && event.sourceId === "uma-banda-grandiosa" && event.amount === 3,
    )).toBe(true);

    const enemy = state.combatants[3];
    enemy.abilities = [{
      id: "stun-hit",
      name: "Stun Hit",
      target: "enemy",
      effects: [{ kind: "stun", turns: 1 }],
    }];
    enemy.pa = 10;
    state.queue = [enemy.id];
    state.queueIndex = 0;
    state.activeId = enemy.id;
    applyAction(state, { combatantId: enemy.id, kind: "ability", abilityId: "stun-hit", targetId: "pip" });
    expect(state.combatants[0].effects.some((effect) => effect.kind === "stun")).toBe(false);
  });

  it("upgrades cooperative bleed damage while refreshing only its duration", () => {
    for (const [adventurerCount, bonus] of [[2, 3], [3, 5]] as const) {
      const allies = Array.from({ length: adventurerCount - 1 }, (_, index) => ({
        id: `adventurer-${index}`,
        name: `Adventurer ${index}`,
        side: "a" as const,
        combatClass: "Aventureiro",
        maxHp: 100,
        attack: 10,
        imagination: 10,
        defense: 0,
        speed: 2,
        abilities: [],
      }));
      const state = createBattle({
        seed: 1,
        combatants: [
          {
            id: "sophie",
            name: "Sophie",
            side: "a",
            combatClass: "Aventureiro",
            maxHp: 100,
            attack: 10,
            imagination: 10,
            defense: 0,
            speed: 6,
            critRate: 0,
            passives: ["cooperacao-aditiva"],
            abilities: [
              { id: "bleed", name: "Bleed", target: "enemy", power: "physical", multiplier: 0.1, effects: [{ kind: "bleed", turns: 2 }] },
              { id: "refresh", name: "Refresh", target: "enemy", power: "physical", multiplier: 0.1, effects: [{ kind: "bleed", turns: 4 }] },
            ],
          },
          ...allies,
          {
            id: "enemy",
            name: "Enemy",
            side: "b",
            maxHp: 500,
            attack: 10,
            imagination: 10,
            defense: 0,
            speed: 2,
            abilities: [],
          },
        ],
      });
      state.combatants[0].pa = 20;
      state.queue = ["sophie"];
      state.activeId = "sophie";

      applyAction(state, { combatantId: "sophie", kind: "ability", abilityId: "bleed", targetId: "enemy" });
      applyAction(state, { combatantId: "sophie", kind: "ability", abilityId: "refresh", targetId: "enemy" });

      const bleed = state.combatants.find((combatant) => combatant.id === "enemy")!
        .effects.find((effect) => effect.kind === "bleed");
      expect(bleed).toMatchObject({ amount: bonus, turnsLeft: 4 });

      const enemy = state.combatants.find((combatant) => combatant.id === "enemy")!;
      enemy.pa = 10;
      state.queue = [enemy.id];
      state.queueIndex = 0;
      state.activeId = enemy.id;
      applyAction(state, { combatantId: enemy.id, kind: "pass" });
      const bleedDamage = state.events.find((event) => event.type === "bleed-damage" && event.combatantId === enemy.id);
      expect(Number(bleedDamage?.amount)).toBeCloseTo(500 * (0.05 + bonus / 100));
    }
  });

  it("triggers Dazy's healing and Hazard's PA bonuses when an ally passes", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          abilities: [],
        },
        {
          id: "dazy",
          name: "Dazy",
          side: "a",
          maxHp: 100,
          hp: 50,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 3,
          passives: ["momento-paz"],
          abilities: [],
        },
        {
          id: "hazard",
          name: "Hazard",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 4,
          passives: ["oportunista-hazard"],
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "pass" });

    expect(state.combatants[1].hp).toBe(65);
    expect(state.combatants[2].pa).toBe(10);
  });

  it("reduces accuracy against Toby by forty percentage points", () => {
    const state = createBattle({
      seed: 2,
      combatants: [
        {
          id: "toby",
          name: "Toby",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 3,
          passives: ["dancinha"],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 4,
          precision: 100,
          critRate: 0,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.activeId = "enemy";

    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "toby" });

    expect(state.events.some((event) => event.type === "attack-missed" && event.targetId === "toby")).toBe(true);
  });

  it("grants Harold's team a temporary critical-rate buff on his critical hits", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "harold",
          name: "Harold",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 100,
          passives: ["poder-excesso"],
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "ally",
          name: "Ally",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 3,
          critRate: 20,
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 500,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["harold"];
    state.activeId = "harold";

    applyAction(state, { combatantId: "harold", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(stat(state.combatants[1], "critRate")).toBe(22);
    expect(state.combatants[1].effects.find((effect) => effect.stat === "critRate"))
      .toMatchObject({ amount: 10, percentage: true, turnsLeft: 2 });
  });

  it("lets Dazy use an item without ending her turn", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "dazy",
          name: "Dazy",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          passives: ["acao-imediata"],
          items: [{ id: "potion", name: "Potion", charges: 2, target: "self", heal: { flat: 1 } }],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 20;
    state.queue = ["dazy", "enemy"];
    state.activeId = "dazy";

    applyAction(state, { combatantId: "dazy", kind: "item", itemId: "potion", targetId: "dazy" });
    expect(state.activeId).toBe("dazy");
    expect(state.combatants[0].items[0].charges).toBe(1);

    const ordinary = createBattle(setup({
      items: [{ id: "potion", name: "Potion", charges: 1, target: "self", heal: { flat: 1 } }],
    }));
    ordinary.combatants[0].pa = 20;
    ordinary.queue = ["pip", "enemy"];
    ordinary.activeId = "pip";
    applyAction(ordinary, { combatantId: "pip", kind: "item", itemId: "potion", targetId: "pip" });
    expect(ordinary.activeId).toBe("enemy");
  });

  it("keeps Pip threatened only while above seventy-five percent health", () => {
    const state = createBattle(setup({
      hp: 480,
      passives: ["constante-ameaca"],
    }));
    const pip = state.combatants[0];
    expect(pip.effects.some((effect) => effect.kind === "threat")).toBe(true);

    const enemy = state.combatants[1];
    enemy.base.attack = 100;
    enemy.base.critRate = 0;
    enemy.abilities = [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }];
    enemy.pa = 10;
    state.queue = [enemy.id];
    state.activeId = enemy.id;
    applyAction(state, { combatantId: enemy.id, kind: "ability", abilityId: "hit", targetId: pip.id });

    expect(pip.hp / pip.maxHp).toBeLessThan(0.75);
    expect(pip.effects.some((effect) => effect.kind === "threat")).toBe(false);
  });

  it("counterattacks a physical attacker with Sophie's defense passive", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "sophie",
          name: "Sophie",
          side: "a",
          maxHp: 100,
          attack: 40,
          imagination: 10,
          defense: 10,
          speed: 2,
          passives: ["sistema-defesa"],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 0,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.activeId = "enemy";

    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "sophie" });

    expect(state.events.find((event) => event.type === "damage" && event.abilityId === "sistema-defesa"))
      .toMatchObject({ attackerId: "sophie", targetId: "enemy", amount: 18 });
  });

  it("seals an attacker's ability after Oswaldo is hit", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "oswaldo",
          name: "Oswaldo",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          passives: ["corpo-amaldicoado"],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 0,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "oswaldo" });

    expect(state.combatants[1].effects).toContainEqual(expect.objectContaining({
      kind: "ability-seal",
      abilityId: "hit",
      turnsLeft: 1,
    }));
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    expect(() => applyAction(state, {
      combatantId: "enemy",
      kind: "ability",
      abilityId: "hit",
      targetId: "oswaldo",
    })).toThrow("This ability is disabled for this turn.");
  });

  it("gives Bass a free attack when an ally hits from Hidden", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 0,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "bass",
          name: "Bass",
          side: "a",
          maxHp: 100,
          attack: 40,
          imagination: 10,
          defense: 10,
          speed: 2,
          passives: ["trabalho-sombras"],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    const pip = state.combatants[0];
    pip.effects.push({ id: "hidden", kind: "hidden", turnsLeft: 1 });
    pip.pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(state.events.find((event) => event.type === "damage" && event.abilityId === "trabalho-sombras"))
      .toMatchObject({ attackerId: "bass", targetId: "enemy", amount: 36 });
  });

  it("turns Clare's critical-heal overflow into a round-long Attack bonus", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "clare",
          name: "Clare",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 100,
          passives: ["voz-divina", "fe-transbordante"],
          abilities: [{ id: "heal", name: "Heal", target: "ally", heal: { flat: 20 } }],
        },
        {
          id: "ally",
          name: "Ally",
          side: "a",
          maxHp: 100,
          hp: 90,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["clare"];
    state.activeId = "clare";

    applyAction(state, { combatantId: "clare", kind: "ability", abilityId: "heal", targetId: "ally" });

    expect(state.combatants[1].hp).toBe(100);
    expect(stat(state.combatants[1], "attack")).toBe(16);
    expect(state.events.find((event) => event.type === "healed" && event.healerId === "clare"))
      .toMatchObject({ critical: true, overflow: 30 });
  });

  it("heals Rufus after a teammate lands a critical hit", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 6,
          critRate: 100,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "rufus",
          name: "Rufus",
          side: "a",
          maxHp: 100,
          hp: 50,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          passives: ["luz-guia"],
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(state.combatants[1].hp).toBe(60);
  });

  it("grants Henrietta accuracy after an ally falls below thirty percent health", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "henrietta",
          name: "Henrietta",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 10,
          speed: 2,
          passives: ["mae-furiosa"],
          abilities: [],
        },
        {
          id: "ally",
          name: "Ally",
          side: "a",
          maxHp: 100,
          hp: 40,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 2,
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 20,
          imagination: 10,
          defense: 0,
          speed: 6,
          critRate: 0,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    state.combatants[2].pa = 10;
    state.queue = ["enemy"];
    state.activeId = "enemy";

    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "ally" });

    expect(state.combatants[1].hp).toBe(20);
    expect(stat(state.combatants[0], "precision")).toBe(120);
  });

  it("lets the Rat King borrow allied Rogues' active abilities and gain their attack bonus", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "rei-rato",
          name: "O Rei Rato",
          side: "a",
          combatClass: "Ladino",
          maxHp: 100,
          attack: 30,
          imagination: 10,
          defense: 0,
          speed: 4,
          passives: ["mestre-ruas"],
          abilities: [],
        },
        {
          id: "bass",
          name: "Bass",
          side: "a",
          combatClass: "Ladino",
          maxHp: 100,
          attack: 40,
          imagination: 10,
          defense: 0,
          speed: 4,
          abilities: [{ id: "batedor-carteiras", name: "Batedor", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "chirp",
          name: "Chirp",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 4,
          abilities: [{ id: "melodia-acao", name: "Melodia", target: "ally", gainPA: 7 }],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });

    const ratKing = state.combatants[0];
    expect(ratKing.base.attack).toBe(40);
    expect(ratKing.abilities.map((ability) => ability.id)).toContain("batedor-carteiras");
    expect(ratKing.abilities.map((ability) => ability.id)).not.toContain("melodia-acao");
  });

  it("stuns Sophie for two turns and heals only on the second", () => {
    const state = createBattle(setup({
      id: "sophie",
      name: "Sophie",
      hp: 50,
      maxHp: 100,
      speed: 16,
      abilities: [{
        id: "dormir-sophie",
        name: "Dormir",
        target: "self",
        selfEffects: [{ kind: "stun", turns: 2 }],
        stunnedTurnHealingFractions: [0, 0.25],
      }],
    }));
    const sophie = state.combatants[0];
    sophie.pa = 30;
    state.queue = ["sophie"];
    state.activeId = "sophie";

    applyAction(state, { combatantId: "sophie", kind: "ability", abilityId: "dormir-sophie", targetId: "sophie" });
    expect(sophie.hp).toBe(50);
    expect(sophie.effects.find((effect) => effect.kind === "stun")?.turnsLeft).toBe(2);

    applyAction(state, { combatantId: "sophie", kind: "pass" });
    expect(sophie.hp).toBe(50);
    expect(sophie.effects.find((effect) => effect.kind === "stun")?.turnsLeft).toBe(1);
    applyAction(state, { combatantId: "sophie", kind: "pass" });
    expect(sophie.hp).toBe(75);
    expect(sophie.effects.some((effect) => effect.kind === "stun")).toBe(false);
  });

  it("uses the same two-turn sleep sequence for the Rat King", () => {
    const state = createBattle(setup({
      id: "rei-rato",
      name: "O Rei Rato",
      hp: 50,
      maxHp: 100,
      speed: 16,
      abilities: [{
        id: "dormir-rei-rato",
        name: "Dormir",
        target: "self",
        selfEffects: [{ kind: "stun", turns: 2 }],
        stunnedTurnHealingFractions: [0, 0.3],
      }],
    }));
    const ratKing = state.combatants[0];
    ratKing.pa = 30;
    state.queue = ["rei-rato"];
    state.activeId = "rei-rato";

    applyAction(state, { combatantId: "rei-rato", kind: "ability", abilityId: "dormir-rei-rato", targetId: "rei-rato" });
    expect(ratKing.hp).toBe(50);
    applyAction(state, { combatantId: "rei-rato", kind: "pass" });
    expect(ratKing.hp).toBe(50);
    applyAction(state, { combatantId: "rei-rato", kind: "pass" });
    expect(ratKing.hp).toBe(80);
    expect(ratKing.effects.some((effect) => effect.kind === "stun")).toBe(false);
  });

  it("lets Bass pass and keep a critical-rate bonus through his next action", () => {
    let state = startRound(createBattle(setup({
      id: "bass",
      name: "Bass",
      speed: 16,
      critRate: 0,
      abilities: [
        {
          id: "fuga-tatica",
          name: "Fuga Tática",
          target: "self",
          passTurn: true,
          selfEffects: [{ kind: "stat", stat: "critRate", amount: 100, turns: 1 }],
        },
        { id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 },
      ],
    })));
    const bass = state.combatants[0];
    expect(state.activeId).toBe("bass");

    applyAction(state, { combatantId: "bass", kind: "ability", abilityId: "fuga-tatica", targetId: "bass" });
    expect(bass.pa).toBe(10);
    expect(state.events.some((event) => event.type === "turn-passed" && event.combatantId === "bass")).toBe(true);
    expect(stat(bass, "critRate")).toBe(100);
    expect(state.activeId).toBeNull();

    startRound(state);
    expect(state.activeId).toBe("bass");
    applyAction(state, { combatantId: "bass", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(state.events.find((event) => event.type === "damage" && event.attackerId === "bass"))
      .toMatchObject({ critical: true });
    expect(stat(bass, "critRate")).toBe(0);
  });

  it("only lets Bass's smoke bomb hide a selected Rogue", () => {
    const makeState = () => createBattle({
      seed: 1,
      combatants: [
        {
          id: "bass",
          name: "Bass",
          side: "a",
          combatClass: "Ladino",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 4,
          abilities: [{
            id: "bomba-fumaca",
            name: "Bomba de Fumaça",
            target: "ally",
            targetMustHaveClass: "Ladino",
            effects: [{ kind: "hidden", turns: 1 }],
          }],
        },
        {
          id: "rogue",
          name: "Rogue",
          side: "a",
          combatClass: "Ladino",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 4,
        },
        {
          id: "bard",
          name: "Bard",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 4,
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });

    const state = makeState();
    state.combatants[0].pa = 10;
    state.activeId = "bass";
    state.queue = ["bass"];

    applyAction(state, { combatantId: "bass", kind: "ability", abilityId: "bomba-fumaca", targetId: "rogue" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "hidden")).toBe(true);
    expect(state.combatants[2].effects.some((effect) => effect.kind === "hidden")).toBe(false);

    const invalidTargetState = makeState();
    invalidTargetState.combatants[0].pa = 10;
    invalidTargetState.activeId = "bass";
    invalidTargetState.queue = ["bass"];
    expect(() => applyAction(invalidTargetState, {
      combatantId: "bass",
      kind: "ability",
      abilityId: "bomba-fumaca",
      targetId: "bard",
    })).toThrow("only target a Ladino");
  });

  it("lets Skunk act with an extra flask at low PA, while passing preserves it", () => {
    const makeState = () => createBattle(setup({
      id: "skunk",
      name: "Skunk",
      speed: 0,
      extraFlasks: 1,
      passives: ["setup-laboratorio"],
      abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
    }));

    const flaskAction = startRound(makeState());
    const skunk = flaskAction.combatants[0];
    expect(flaskAction.activeId).toBe("skunk");
    const paBeforeAttack = skunk.pa;
    applyAction(flaskAction, { combatantId: "skunk", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(skunk.extraFlasks).toBe(0);
    expect(skunk.pa).toBe(paBeforeAttack);
    expect(flaskAction.events.some((event) => event.type === "resource-spent")).toBe(true);

    const savedFlask = startRound(makeState());
    const savedSkunk = savedFlask.combatants[0];
    applyAction(savedFlask, { combatantId: "skunk", kind: "pass" });
    expect(savedSkunk.extraFlasks).toBe(1);
    expect(savedSkunk.pa).toBe(0);
  });

  it("applies Leonard's attack modifiers and clears them after his next action", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "leonard",
          name: "Leonard",
          side: "a",
          maxHp: 100,
          attack: 80,
          imagination: 30,
          defense: 30,
          speed: 4,
          abilities: [
            {
              id: "estocada",
              name: "Estocada",
              target: "enemy",
              power: "physical",
              multiplier: 1,
              selfEffects: [{ kind: "stat", stat: "attack", amount: 10 }],
            },
            {
              id: "golpe-surdina",
              name: "Golpe na surdina",
              target: "enemy",
              power: "physical",
              multiplier: 2,
              selfEffects: [{ kind: "stat", stat: "attack", amount: -20 }],
            },
          ],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 500,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
          abilities: [],
        },
      ],
    });
    const leonard = state.combatants[0];
    leonard.pa = 30;
    state.queue = ["leonard"];
    state.activeId = "leonard";

    applyAction(state, { combatantId: "leonard", kind: "ability", abilityId: "estocada", targetId: "enemy" });
    expect(stat(leonard, "attack")).toBe(90);
    applyAction(state, { combatantId: "leonard", kind: "ability", abilityId: "golpe-surdina", targetId: "enemy" });
    expect(stat(leonard, "attack")).toBe(70);
  });

  it("activates Oliver's pass-stage defense, threat, reflection, and reset", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "oliver",
          name: "Oliver",
          side: "a",
          maxHp: 300,
          attack: 20,
          imagination: 20,
          defense: 10,
          speed: 1,
          passives: ["devagar-sempre"],
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "ally",
          name: "Ally",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 5,
          speed: 1,
          abilities: [],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 200,
          attack: 100,
          imagination: 10,
          defense: 0,
          speed: 1,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    const oliver = state.combatants[0];
    const ally = state.combatants[1];
    const enemy = state.combatants[2];
    oliver.pa = 40;
    state.queue = ["oliver"];
    state.activeId = "oliver";

    applyAction(state, { combatantId: "oliver", kind: "pass" });
    expect(stat(oliver, "defense")).toBe(30);
    applyAction(state, { combatantId: "oliver", kind: "pass" });
    expect(oliver.effects.some((effect) => effect.kind === "threat")).toBe(true);
    applyAction(state, { combatantId: "oliver", kind: "pass" });
    expect(stat(ally, "defense")).toBe(25);

    enemy.pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "oliver" });
    expect(state.events.some((event) => event.abilityId === "devagar-sempre" && event.type === "damage")).toBe(true);

    oliver.pa = 10;
    state.queue = ["oliver"];
    state.queueIndex = 0;
    state.activeId = "oliver";
    applyAction(state, { combatantId: "oliver", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(oliver.slowSteadyPassCount).toBe(0);
    expect(state.combatants.every((combatant) =>
      combatant.effects.every((effect) => effect.sourceId !== "devagar-sempre"),
    )).toBe(true);
  });

  it("applies Fofoqueiro Vulnerável after Leonard takes a single-target hit", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "leonard",
          name: "Leonard",
          side: "a",
          maxHp: 100,
          attack: 80,
          imagination: 30,
          defense: 0,
          speed: 4,
          passives: ["fofoqueiro-vulneravel"],
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 500,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
          abilities: [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }],
        },
      ],
    });
    const leonard = state.combatants[0];
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.activeId = "enemy";

    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "hit", targetId: "leonard" });
    expect(stat(leonard, "attack")).toBe(60);
    expect(leonard.effects.some((effect) => effect.kind === "hidden")).toBe(true);

    leonard.pa = 10;
    state.queue = ["leonard"];
    state.queueIndex = 0;
    state.activeId = "leonard";
    applyAction(state, { combatantId: "leonard", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(stat(leonard, "attack")).toBe(80);
    expect(leonard.effects.some((effect) => effect.kind === "stat" && effect.stat === "attack")).toBe(false);
  });

  it("hands an exhausted enemy queue to the UI round-start state", () => {
    const state = startRound(createBattle(setup()));
    state.combatants[0].pa = 0;
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";

    applyAction(state, { combatantId: "enemy", kind: "pass" });

    expect(state.phase).toBe("round-start");
    expect(state.queueIndex).toBe(1);
    expect(state.activeId).toBeNull();
  });

  it("charges written ability costs instead of ten PA", () => {
    const state = createBattle(setup({
      speed: 6,
      abilities: [{
        id: "costly",
        name: "Costly",
        cost: 15,
        target: "enemy",
        power: "physical",
        multiplier: 1,
      }],
    }));
    state.combatants[0].pa = 11;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "costly", targetId: "enemy" });
    expect(state.combatants[0].pa).toBe(-4);
  });

  it("applies bleed after the carrier acts", () => {
    const state = createBattle(setup({
      speed: 6,
      abilities: [{
        id: "bleed",
        name: "Bleed",
        target: "enemy",
        power: "physical",
        multiplier: 1,
        effects: [{ kind: "bleed", chance: 1, turns: 2 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "bleed", targetId: "enemy" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "bleed")).toBe(true);

    state.activeId = "enemy";
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.combatants[1].pa = 10;
    applyAction(state, { combatantId: "enemy", kind: "pass" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "bleed")).toBe(true);
  });

  it("applies stun as a skipped turn and removes the effect", () => {
    const state = createBattle(setup({
      speed: 6,
      abilities: [{
        id: "stun",
        name: "Stun",
        target: "enemy",
        effects: [{ kind: "stun", chance: 1, turns: 1 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "stun", targetId: "enemy" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "stun")).toBe(true);

    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    state.combatants[1].pa = 10;
    applyAction(state, { combatantId: "enemy", kind: "pass" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "stun")).toBe(false);
  });

  it("copies the last offensive ability at half its multiplier", () => {
    const state = createBattle(setup({
      critRate: 0,
    }));
    state.lastAbility = {
      id: "copied",
      name: "Copied",
      target: "enemy",
      power: "physical",
      multiplier: 2,
    };
    state.combatants[1].base.critRate = 0;
    state.combatants[1].abilities = [{
      id: "imitar",
      name: "Imitar",
      target: "enemy",
      copyLastAbility: true,
    }];
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";

    applyAction(state, {
      combatantId: "enemy",
      kind: "ability",
      abilityId: "imitar",
      targetId: "pip",
    });

    expect(state.events.find((event) => event.type === "damage")).toMatchObject({
      abilityId: "imitar",
      amount: 14,
    });
  });

  it("uses Imagination as defense while Alta proteção is active", () => {
    const state = createBattle(setup({
      abilities: [{
        id: "alta-protecao",
        name: "Alta proteção",
        target: "self",
        selfEffects: [{ kind: "imagination-defense", turns: 1 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "alta-protecao", targetId: "pip" });

    const enemy = state.combatants[1];
    enemy.base.critRate = 0;
    enemy.abilities = [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }];
    enemy.pa = 10;
    state.queue = [enemy.id];
    state.queueIndex = 0;
    state.activeId = enemy.id;
    applyAction(state, { combatantId: enemy.id, kind: "ability", abilityId: "hit", targetId: "pip" });

    expect(state.events.find((event) => event.type === "damage" && event.attackerId === enemy.id))
      .toMatchObject({ amount: 12 });
  });

  it("applies Camuflar's accuracy penalty to attacks against its recipients", () => {
    const state = createBattle({
      seed: 2,
      combatants: [
        {
          id: "leonard",
          name: "Leonard",
          side: "a",
          maxHp: 400,
          attack: 30,
          imagination: 30,
          defense: 30,
          speed: 6,
          abilities: [{
            id: "camuflar",
            name: "Camuflar",
            target: "self",
            camouflage: { amount: 35, turns: 3, alliesBelowHealthFraction: 0.3 },
          }],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 400,
          attack: 20,
          imagination: 20,
          defense: 20,
          speed: 2,
          abilities: [],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["leonard"];
    state.activeId = "leonard";
    applyAction(state, { combatantId: "leonard", kind: "ability", abilityId: "camuflar", targetId: "leonard" });

    const enemy = state.combatants[1];
    enemy.abilities = [{ id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 }];
    enemy.pa = 10;
    state.queue = [enemy.id];
    state.queueIndex = 0;
    state.activeId = enemy.id;
    applyAction(state, { combatantId: enemy.id, kind: "ability", abilityId: "hit", targetId: "leonard" });

    expect(state.events.some((event) => event.type === "attack-missed" && event.targetId === "leonard")).toBe(true);
  });

  it("reduces imaginary damage with Barreira mágica", () => {
    const state = createBattle(setup({
      abilities: [{
        id: "barreira-magica",
        name: "Barreira mágica",
        target: "allies",
        effects: [{ kind: "imaginary-barrier", amount: 20, turns: 4 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "barreira-magica" });

    const enemy = state.combatants[1];
    enemy.base.critRate = 0;
    enemy.abilities = [{ id: "imaginary-hit", name: "Imaginary Hit", target: "enemy", power: "imaginary", multiplier: 1 }];
    enemy.pa = 10;
    state.queue = [enemy.id];
    state.queueIndex = 0;
    state.activeId = enemy.id;
    applyAction(state, { combatantId: enemy.id, kind: "ability", abilityId: "imaginary-hit", targetId: "pip" });

    const damage = state.events.find((event) => event.type === "damage" && event.attackerId === enemy.id);
    expect(Number(damage?.amount)).toBeCloseTo(11.2);
  });

  it("supports abilities powered by Speed or by Attack plus Imagination", () => {
    const state = createBattle(setup({
      attack: 30,
      imagination: 40,
      critRate: 0,
      abilities: [{
        id: "combined-hit",
        name: "Combined Hit",
        target: "enemy",
        power: "imaginary",
        multiplier: 1,
        combineAttackAndImagination: true,
        selfEffects: [{ kind: "stat", stat: "attack", amount: -10 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "combined-hit", targetId: "enemy" });

    expect(state.events.find((event) => event.type === "damage" && event.attackerId === "pip"))
      .toMatchObject({ amount: 56 });
    expect(stat(state.combatants[0], "attack")).toBe(20);

    const speedState = createBattle(setup({
      speed: 4,
      critRate: 0,
      abilities: [{
        id: "speed-hit",
        name: "Speed Hit",
        target: "enemy",
        power: "physical",
        powerStat: "speed",
        multiplier: 10,
      }],
    }));
    speedState.combatants[0].pa = 10;
    speedState.queue = ["pip"];
    speedState.activeId = "pip";
    applyAction(speedState, { combatantId: "pip", kind: "ability", abilityId: "speed-hit", targetId: "enemy" });
    expect(speedState.events.find((event) => event.type === "damage" && event.attackerId === "pip"))
      .toMatchObject({ amount: 32 });
  });

  it("copies an ally's passive list with Roubo de táticas", () => {
    const state = createBattle(setup({
      abilities: [{ id: "roubo-taticas", name: "Roubo de táticas", target: "any", copyTargetPassives: true }],
    }));
    state.combatants[0].pa = 10;
    state.combatants[1].passives = ["inventando-regras"];
    state.queue = ["pip"];
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "roubo-taticas", targetId: "enemy" });

    expect(state.combatants[0].borrowedPassives).toEqual(["inventando-regras"]);
  });

  it("applies corrosive defense reduction over its two turns and then clears it", () => {
    const state = createBattle(setup({
      abilities: [{
        id: "corrode",
        name: "Corrode",
        target: "enemy",
        power: "imaginary",
        multiplier: 0.5,
        effects: [{ kind: "corrosion", turns: 2 }],
      }],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "corrode", targetId: "enemy" });
    expect(stat(state.combatants[1], "defense")).toBe(10);

    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "pass" });
    expect(stat(state.combatants[1], "defense")).toBe(0);

    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "pass" });
    expect(stat(state.combatants[1], "defense")).toBe(20);
  });

  it("detonates Skunk's unstable target into stun and a defense debuff", () => {
    const state = createBattle(setup({
      abilities: [
        { id: "catalyst", name: "Catalyst", target: "enemy", effects: [{ kind: "instability", turns: 1 }] },
        {
          id: "reacao-explosiva",
          name: "Reação Explosiva",
          target: "enemy",
          power: "imaginary",
          multiplier: 1,
          conditionalEffects: {
            targetEffect: "instability",
            effects: [
              { kind: "stun", turns: 1 },
              { kind: "stat", stat: "defense", amount: -10, turns: 1 },
            ],
          },
        },
      ],
    }));
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "catalyst", targetId: "enemy" });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "reacao-explosiva", targetId: "enemy" });

    expect(state.combatants[1].effects.some((effect) => effect.kind === "stun")).toBe(true);
    expect(stat(state.combatants[1], "defense")).toBe(10);
  });

  it("grants Skunk's conditional critical bonus and caps extra flasks at three", () => {
    const state = createBattle(setup({
      critRate: 100,
      passives: ["alquimia-avancada", "setup-laboratorio"],
      extraFlasks: 2,
      abilities: [{
        id: "hit",
        name: "Hit",
        target: "enemy",
        power: "imaginary",
        multiplier: 1,
      }],
    }));
    state.combatants[1].effects.push(
      { id: "corrosion", kind: "corrosion", stat: "defense", amount: -10, turnsLeft: 1 },
      { id: "instability", kind: "instability", turnsLeft: 1 },
    );
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(state.combatants[0].extraFlasks).toBe(3);
    expect(state.events.find((event) => event.type === "damage")).toMatchObject({ critical: true });
  });

  it("applies the Serpent mark's bonuses and removes them on any healing action", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "serpente",
          name: "A Serpente",
          side: "a",
          maxHp: 100,
          attack: 20,
          imagination: 50,
          defense: 20,
          speed: 4,
          abilities: [{
            id: "fruto-tentacao",
            name: "Fruto da Tentação",
            target: "enemy",
            effects: [
              { kind: "serpent-mark" },
              { kind: "stat", stat: "attack", amount: 20 },
              { kind: "stat", stat: "imagination", amount: 20 },
            ],
          }],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
          abilities: [{
            id: "heal",
            name: "Heal",
            target: "self",
            heal: { flat: 10 },
          }],
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["serpente"];
    state.queueIndex = 0;
    state.activeId = "serpente";

    applyAction(state, { combatantId: "serpente", kind: "ability", abilityId: "fruto-tentacao", targetId: "enemy" });
    expect(stat(state.combatants[1], "attack")).toBe(30);
    expect(stat(state.combatants[1], "imagination")).toBe(30);
    expect(state.combatants[1].effects.some((effect) => effect.kind === "serpent-mark")).toBe(true);

    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "ability", abilityId: "heal", targetId: "enemy" });
    expect(state.combatants[1].effects.some((effect) => effect.kind === "serpent-mark")).toBe(false);
    expect(stat(state.combatants[1], "attack")).toBe(10);
    expect(stat(state.combatants[1], "imagination")).toBe(10);
  });

  it("uses the documented allied Judas Kiss effects", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "serpente",
          name: "A Serpente",
          side: "a",
          maxHp: 100,
          hp: 50,
          attack: 20,
          imagination: 50,
          defense: 20,
          speed: 4,
          abilities: [{
            id: "beijo-judas",
            name: "O Beijo de Judas",
            target: "any",
            power: "imaginary",
            multiplier: 3.5,
            critBonus: 90,
            targetMustHaveEffect: "serpent-mark",
            consumeTargetEffect: "serpent-mark",
            allyTargetEffect: {
              damageMultiplier: 0.5,
              healActor: { stat: "imagination", multiplier: 0.1 },
              targetEffects: [{ kind: "stat", stat: "defense", amount: -20 }],
              actorEffects: [
                { kind: "serpent-mark", turns: 4 },
                { kind: "stat", stat: "attack", amount: 20, turns: 4 },
                { kind: "stat", stat: "imagination", amount: 20, turns: 4 },
              ],
              actorGainPA: 10,
            },
          }],
        },
        {
          id: "marked-ally",
          name: "Marked Ally",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 20,
          speed: 1,
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    const serpent = state.combatants[0];
    const ally = state.combatants[1];
    serpent.pa = 10;
    state.queue = ["serpente"];
    state.queueIndex = 0;
    state.activeId = "serpente";
    ally.effects.push({
      id: "serpent-mark",
      kind: "serpent-mark",
      sourceId: "fruto-tentacao",
      sequence: 1,
    });

    applyAction(state, {
      combatantId: "serpente",
      kind: "ability",
      abilityId: "beijo-judas",
      targetId: "marked-ally",
    });

    expect(ally.hp).toBeLessThan(100);
    expect(ally.effects.some((effect) => effect.kind === "serpent-mark")).toBe(false);
    expect(stat(ally, "defense")).toBe(0);
    expect(serpent.hp).toBe(55);
    expect(serpent.effects.some((effect) => effect.kind === "serpent-mark")).toBe(true);
    expect(stat(serpent, "attack")).toBe(40);
    expect(stat(serpent, "imagination")).toBe(70);
  });

  it("keeps at most two Serpent marks and removes the oldest target's bonuses", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "serpente",
          name: "A Serpente",
          side: "a",
          maxHp: 100,
          attack: 20,
          imagination: 50,
          defense: 20,
          speed: 4,
          abilities: [{
            id: "fruto-tentacao",
            name: "Fruto da Tentação",
            target: "any",
            effects: [
              { kind: "serpent-mark" },
              { kind: "stat", stat: "attack", amount: 20 },
              { kind: "stat", stat: "imagination", amount: 20 },
            ],
          }],
        },
        ...["one", "two", "three"].map((id) => ({
          id,
          name: id,
          side: "b" as const,
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        })),
      ],
    });
    state.combatants[0].pa = 30;
    state.queue = ["serpente"];
    state.queueIndex = 0;
    state.activeId = "serpente";

    for (const id of ["one", "two", "three"]) {
      applyAction(state, {
        combatantId: "serpente",
        kind: "ability",
        abilityId: "fruto-tentacao",
        targetId: id,
      });
    }

    expect(state.combatants.slice(1).map((combatant) =>
      combatant.effects.some((effect) => effect.kind === "serpent-mark"),
    )).toEqual([false, true, true]);
    expect(stat(state.combatants[1], "attack")).toBe(10);
    expect(stat(state.combatants[2], "attack")).toBe(30);
    expect(stat(state.combatants[3], "attack")).toBe(30);
  });

  it("uses Condemnation once per living status removed and heals per removed effect", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "serpente",
          name: "A Serpente",
          side: "a",
          maxHp: 100,
          hp: 50,
          attack: 20,
          imagination: 50,
          defense: 20,
          speed: 4,
          abilities: [{
            id: "condenacao",
            name: "Condenação",
            target: "enemies",
            power: "imaginary",
            multiplier: 0.5,
            condemnation: true,
          }],
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    const serpent = state.combatants[0];
    const enemy = state.combatants[1];
    serpent.pa = 10;
    state.queue = ["serpente"];
    state.queueIndex = 0;
    state.activeId = "serpente";
    enemy.effects.push(
      { id: "buff", kind: "stat", stat: "attack", amount: 10 },
      { id: "bleed", kind: "bleed" },
    );

    applyAction(state, { combatantId: "serpente", kind: "ability", abilityId: "condenacao" });

    expect(enemy.effects).toHaveLength(0);
    expect(serpent.hp).toBe(70);
    expect(state.events.filter((event) => event.type === "damage")).toHaveLength(2);
  });

  it("increments the shared Prova counter once per round for any number of living users", () => {
    const battleSetup = setup();
    battleSetup.combatants[0].usesProof = true;
    battleSetup.combatants[1].usesProof = true;
    const state = startRound(createBattle(battleSetup));

    expect(state.proof).toBe(0);
    expect(state.events.filter((event) => event.type === "proof-increased")).toHaveLength(0);

    startRound(state);

    expect(state.proof).toBe(1);
    expect(state.events.filter((event) => event.type === "proof-increased")).toHaveLength(1);
  });

  it("fulfills the False Prophet passive on its next turn at thirteen Prova", () => {
    const state = createBattle({
      seed: 8,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "falso-profeta",
          name: "O Falso Profeta",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 20,
          usesProof: true,
        },
      ],
    });
    state.proof = 12;
    state.round = 1;

    startRound(state);

    expect(state.proof).toBe(13);
    expect(state.winner).toBe("b");
    expect(state.phase).toBe("ended");
  });

  it("cannot directly target hidden combatants", () => {
    const state = createBattle(setup());
    state.combatants[1].effects.push({ id: "hidden-1", kind: "hidden", turnsLeft: 1 });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    expect(() => applyAction(state, {
      combatantId: "pip",
      kind: "ability",
      abilityId: "hit",
      targetId: "enemy",
    })).toThrow("Hidden combatants");
  });

  it("rejects defeated targets without consuming PA or recording the action", () => {
    const state = createBattle(setup());
    state.combatants[0].pa = 10;
    state.combatants[1].hp = 0;
    state.combatants[1].alive = false;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";

    expect(() => applyAction(state, {
      combatantId: "pip",
      kind: "ability",
      abilityId: "hit",
      targetId: "enemy",
    })).toThrow("Defeated combatants cannot be targeted");
    expect(state.combatants[0].pa).toBe(10);
    expect(state.actions).toHaveLength(0);
  });

  it("forces direct attacks toward threatened enemies", () => {
    const combatSetup = setup();
    const state = createBattle({
      ...combatSetup,
      combatants: [
        ...combatSetup.combatants,
        {
          id: "other-enemy",
          name: "Other Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    state.combatants[1].effects.push({ id: "threat-1", kind: "threat", turnsLeft: 1 });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";
    expect(() => applyAction(state, {
      combatantId: "pip",
      kind: "ability",
      abilityId: "hit",
      targetId: "other-enemy",
    })).toThrow("threatened combatant");
  });

  it("settles round effects and ends the battle when one team is defeated", () => {
    const state = createBattle(setup());
    state.combatants[1].hp = 1;
    state.combatants[1].effects.push({ id: "round-1", kind: "stat", roundsLeft: 1, stat: "attack", amount: 5 });
    startRound(state);
    settleRound(state);
    expect(state.combatants[1].effects).toHaveLength(0);

    state.combatants[1].hp = 0;
    state.combatants[1].alive = false;
    state.combatants[0].hp = 100;
    state.combatants[0].alive = true;
    state.phase = "awaiting";
    state.queue = [];
    startRound(state);
    expect(state.phase).toBe("ended");
  });

  it("does not restart turn processing or gain PA after the final opponent is defeated", () => {
    const state = createBattle(setup({
      critRate: 100,
      abilities: [{
        id: "finisher",
        name: "Finisher",
        target: "enemy",
        power: "physical",
        multiplier: 10,
        cannotMiss: true,
      }],
    }));
    state.combatants[1].hp = 1;
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.queueIndex = 0;
    state.activeId = "pip";

    applyAction(state, {
      combatantId: "pip",
      kind: "ability",
      abilityId: "finisher",
      targetId: "enemy",
    });

    expect(state.phase).toBe("ended");
    expect(state.winner).toBe("a");
    expect(state.activeId).toBeNull();
    expect(state.round).toBe(0);
    startRound(state);
    expect(state.round).toBe(0);
    expect(state.combatants[0].pa).toBe(0);
  });

  it("survives one lethal hit with one HP when configured", () => {
    const state = createBattle(setup({
      surviveLethalOnce: true,
      hp: 20,
    }));
    state.combatants[1].abilities = [{
      id: "hit",
      name: "Hit",
      target: "enemy",
      power: "physical",
      multiplier: 10,
    }];
    state.combatants[1].pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, {
      combatantId: "enemy",
      kind: "ability",
      abilityId: "hit",
      targetId: "pip",
    });
    expect(state.combatants[0].hp).toBe(1);
    expect(state.combatants[0].effects.some((effect) => effect.kind === "hidden")).toBe(true);
  });

  it("allows Farejar to target and remove Escondido", () => {
    const state = createBattle(setup({
      speed: 20,
      abilities: [{
        id: "farejar",
        name: "Farejar",
        target: "enemy",
        canTargetHidden: true,
        targetMustHaveEffect: "hidden",
        removeTargetEffect: "hidden",
      }],
    }));
    state.combatants[0].pa = 10;
    state.combatants[1].effects.push({ id: "hidden-target", kind: "hidden", turnsLeft: 1 });
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "farejar", targetId: "enemy" });

    expect(state.combatants[1].effects.some((effect) => effect.kind === "hidden")).toBe(false);
    expect(state.events).toContainEqual(expect.objectContaining({
      type: "effect-ended",
      combatantId: "enemy",
      effect: "hidden",
    }));
  });

  it("refreshes same-source speed and critical bonuses instead of stacking them", () => {
    const state = createBattle(setup({
      speed: 20,
      abilities: [{
        id: "motivation",
        name: "Motivation",
        target: "self",
        selfEffects: [
          { kind: "stat", stat: "speed", amount: 3, turns: 2 },
          { kind: "stat", stat: "critRate", amount: 50, turns: 2 },
        ],
      }],
    }));
    state.combatants[0].pa = 20;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "motivation", targetId: "pip" });
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "motivation", targetId: "pip" });

    expect(state.combatants[0].effects.filter((effect) => effect.kind === "stat" && effect.stat === "speed"))
      .toHaveLength(1);
    expect(state.combatants[0].effects.filter((effect) => effect.kind === "stat" && effect.stat === "critRate"))
      .toHaveLength(1);
  });

  it("makes Sala da brincadeira global, changing attacks to imaginary and ending on a knockout", () => {
    const roomAbility = {
      id: "sala-brincadeira",
      name: "Sala da brincadeira",
      target: "none" as const,
      fieldEffect: {
        kind: "sala-brincadeira" as const,
        rounds: 2,
        description: "Ataques imaginários.",
      },
    };
    const state = createBattle(setup({
      speed: 20,
      attack: 100,
      imagination: 40,
      critRate: 0,
      abilities: [
        roomAbility,
        { id: "hit", name: "Hit", target: "enemy", power: "physical", multiplier: 1 },
      ],
    }));
    state.combatants[1].base.defense = 0;
    state.combatants[0].pa = 20;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "sala-brincadeira" });
    expect(state.fieldEffects).toHaveLength(1);
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });

    expect(state.events).toContainEqual(expect.objectContaining({ type: "damage", power: "imaginary" }));
    expect(state.events.find((event) => event.type === "damage")?.amount).toBe(50);

    state.fieldEffects = [{
      kind: "sala-brincadeira",
      roundsLeft: 2,
      description: "Ataques imaginários.",
    }];
    state.combatants[1].hp = 1;
    state.combatants[0].pa = 10;
    state.activeId = "pip";
    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "hit", targetId: "enemy" });
    expect(state.fieldEffects).toHaveLength(0);
    expect(state.events).toContainEqual(expect.objectContaining({
      type: "field-effect-ended",
      reason: "combatant-defeated",
    }));
  });

  it("applies Maldição's stats and extra damage on Sangramento ticks", () => {
    const state = createBattle(setup({
      speed: 20,
      abilities: [{
        id: "maldicao",
        name: "Maldição",
        target: "enemy",
        effects: [
          { kind: "malediction", amount: 10, rounds: 4 },
          { kind: "stat", stat: "attack", amount: -10, rounds: 4 },
          { kind: "stat", stat: "precision", amount: -20, percentage: true, rounds: 4 },
        ],
      }],
    }));
    const enemy = state.combatants[1];
    enemy.effects.push({ id: "bleed", kind: "bleed", turnsLeft: 2 });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "maldicao", targetId: "enemy" });

    expect(stat(enemy, "attack")).toBe(10);
    expect(stat(enemy, "precision")).toBe(80);
    enemy.pa = 10;
    state.queue = ["enemy"];
    state.queueIndex = 0;
    state.activeId = "enemy";
    applyAction(state, { combatantId: "enemy", kind: "pass" });

    expect(state.events).toContainEqual(expect.objectContaining({
      type: "bleed-damage",
      combatantId: "enemy",
      amount: 30,
    }));
  });

  it("illustrates Sophie’s Cooperação stacks when upgraded bleeding is applied", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "sophie",
          name: "Sophie",
          side: "a",
          combatClass: "Aventureiro",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 5,
          passives: ["cooperacao-aditiva"],
          abilities: [{
            id: "bleed",
            name: "Bleed",
            target: "enemy",
            power: "physical",
            multiplier: 0.1,
            effects: [{ kind: "bleed", turns: 2 }],
          }],
        },
        {
          id: "adventurer",
          name: "Adventurer",
          side: "a",
          combatClass: "Aventureiro",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    const sophie = state.combatants[0];
    const enemy = state.combatants[2];
    sophie.pa = 10;
    enemy.effects.push({ id: "existing-bleed", kind: "bleed", turnsLeft: 2 });
    state.queue = ["sophie"];
    state.activeId = "sophie";

    applyAction(state, { combatantId: "sophie", kind: "ability", abilityId: "bleed", targetId: "enemy" });

    expect(enemy.effects.find((effect) => effect.kind === "bleed")?.amount).toBe(3);
    expect(sophie.effects.find((effect) => effect.kind === "cooperation")?.amount).toBe(1);
  });

  it("illustrates Uma banda grandiosa after a support skill triggers its three-Bard effect", () => {
    const state = createBattle({
      seed: 1,
      combatants: [
        {
          id: "pip",
          name: "Pip",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 5,
          passives: ["uma-banda-grandiosa"],
          abilities: [{ id: "support", name: "Support", target: "allies" }],
        },
        {
          id: "bard-two",
          name: "Bard Two",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "bard-three",
          name: "Bard Three",
          side: "a",
          combatClass: "Bardo",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "enemy",
          name: "Enemy",
          side: "b",
          maxHp: 100,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    state.combatants[0].pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "support" });

    expect(state.combatants[0].effects.find((effect) => effect.kind === "grand-band")?.amount).toBe(1);
    expect(state.combatants.slice(0, 3).every((ally) =>
      ally.effects.some((effect) => effect.kind === "stun-immunity"),
    )).toBe(true);
  });

  it("keeps the Besta immune to Atordoamento through its passive", () => {
    const state = createBattle(setup());
    const attacker = state.combatants[0];
    const beast = state.combatants[1];
    beast.passives.push("sono-eterno");
    attacker.abilities = [{
      id: "stun",
      name: "Stun",
      target: "enemy",
      effects: [{ kind: "stun", turns: 1 }],
    }];
    attacker.pa = 10;
    state.queue = ["pip"];
    state.activeId = "pip";

    applyAction(state, { combatantId: "pip", kind: "ability", abilityId: "stun", targetId: "enemy" });

    expect(beast.effects.some((effect) => effect.kind === "stun")).toBe(false);
  });
});
