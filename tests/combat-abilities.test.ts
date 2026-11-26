import { describe, expect, it } from "vitest";
import { createBattle } from "../packages/combat-engine/src/index.js";
import { companions, enemies, pipVariations } from "../packages/game-data/src/index.js";
import { chooseEnemyAction } from "../apps/web/src/combatAI.js";
import { toCombatAbility } from "../apps/web/src/combatAbilities.js";

describe("catalog combat ability mapping", () => {
  it("provides an executable mapping for every playable active ability", () => {
    const unmapped = [...pipVariations, ...companions].flatMap((character) =>
      character.abilities
        .filter((ability) => ability.kind === "active" && toCombatAbility(ability) === null)
        .map((ability) => `${character.name}: ${ability.name} (${ability.id})`),
    );

    expect(unmapped).toEqual([]);
  });

  it("provides executable active abilities for the default team and four test enemies", () => {
    const defaultRoster = [
      pipVariations.find((character) => character.id === "pip-adventure"),
      companions.find((character) => character.id === "chirp"),
      companions.find((character) => character.id === "louise"),
      companions.find((character) => character.id === "skunk"),
      ...enemies.slice(0, 4),
    ];

    for (const character of defaultRoster) {
      expect(character).toBeDefined();
      expect(character?.abilities.filter((ability) => ability.kind === "active").map(toCombatAbility))
        .not.toContain(null);
    }
  });

  it("maps the Serpent's three documented active abilities", () => {
    const serpent = companions.find((character) => character.id === "serpente")!;
    const abilities = serpent.abilities.filter((ability) => ability.kind === "active").map(toCombatAbility);

    expect(abilities).not.toContain(null);
    expect(abilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "fruto-tentacao", target: "any" }),
      expect.objectContaining({
        id: "beijo-judas",
        target: "any",
        targetMustHaveEffect: "serpent-mark",
        allyTargetEffect: expect.objectContaining({ damageMultiplier: 0.5, actorGainPA: 10 }),
      }),
      expect.objectContaining({ id: "condenacao", condemnation: true }),
    ]));
  });

  it("keeps explicit attack multipliers, targets, costs, and conditional effects", () => {
    const unstableExplosion = toCombatAbility(
      pipVariations.find((character) => character.id === "pip-old-sage")!.abilities
        .find((ability) => ability.id === "explosao-instavel")!,
    );
    const ratBite = toCombatAbility(
      enemies.find((character) => character.id === "rato-madeira")!.abilities
        .find((ability) => ability.id === "roida")!,
    );

    expect(unstableExplosion).toMatchObject({
      power: "imaginary",
      multiplier: 3,
      critBonus: 40,
      onCriticalSelfEffects: [{ kind: "stat", stat: "imagination", amount: 30, turns: 2 }],
      onNonCriticalSelfEffects: [{ kind: "stun", turns: 1 }],
    });

    expect(ratBite).toMatchObject({
      power: "physical",
      multiplier: 0.5,
      effects: [{ kind: "bleed", chance: 0.2 }],
    });
  });

  it("maps the reported fixes to their documented targets, durations, and costs", () => {
    const mapped = (characterId: string, abilityId: string) => {
      const character = [...pipVariations, ...companions].find((entry) => entry.id === characterId)!;
      return toCombatAbility(character.abilities.find((ability) => ability.id === abilityId)!);
    };

    expect(mapped("skunk", "catalisador-instavel")).toMatchObject({
      target: "enemy",
      effects: [{ kind: "instability", turns: 3 }],
    });
    expect(mapped("harold", "meditacao-harold")).toMatchObject({
      target: "self",
      selfEffects: [{ kind: "stat", stat: "critRate", amount: 50, turns: 1 }],
    });
    expect(mapped("leonard", "estocada")).toMatchObject({
      power: "physical",
      selfEffects: [{ kind: "stat", stat: "attack", amount: 10 }],
    });
    expect(mapped("hazard", "sombra-hazard")).toMatchObject({
      target: "enemy",
      prepareNextAttackMultiplier: 3,
      selfEffects: [{ kind: "hidden", turns: 1 }],
    });
    expect(mapped("oliver", "casco")).toMatchObject({
      target: "self",
      healFractionOfMaxHp: 0.35,
      selfEffects: [{ kind: "hidden", turns: 1 }],
    });
    expect(mapped("oliver", "ir-com-tudo")).toMatchObject({
      target: "enemy",
      selfEffects: [{ kind: "stun", turns: 1 }],
    });
    expect(mapped("sophie", "dormir-sophie")).toMatchObject({
      target: "self",
      selfEffects: [{ kind: "stun", turns: 2 }],
      stunnedTurnHealingFractions: [0, 0.25],
    });
    expect(mapped("rei-rato", "dormir-rei-rato")).toMatchObject({
      target: "self",
      selfEffects: [{ kind: "stun", turns: 2 }],
      stunnedTurnHealingFractions: [0, 0.3],
    });
    expect(mapped("bass", "bomba-fumaca")).toMatchObject({
      target: "ally",
      targetMustHaveClass: "Ladino",
      effects: [{ kind: "hidden", turns: 1 }],
    });
    expect(mapped("bass", "fuga-tatica")).toMatchObject({
      target: "self",
      passTurn: true,
      selfEffects: [{ kind: "stat", stat: "critRate", amount: 100, turns: 1 }],
    });
    expect(mapped("sophie", "explosao-espinhos")).toMatchObject({
      cost: 15,
      multiplier: 0.2,
    });
  });

  it("chooses a documented heal when the enemy is below its health threshold", () => {
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
            defense: 0,
            speed: 5,
          },
          {
            id: "esquilo-coletor",
            name: "Esquilo Coletor",
            side: "b",
            maxHp: 80,
            hp: 35,
            attack: 12,
            imagination: 5,
            defense: 5,
            speed: 4,
            abilities: [
              { id: "casca", name: "Casca", target: "enemy", power: "physical", multiplier: 0.8 },
              {
                id: "fruta-curadora",
                name: "Fruta Curadora",
                target: "self",
                heal: { flat: 30 },
                useBelowHealthFraction: 0.5,
              },
            ],
          },
        ],
      });

      expect(chooseEnemyAction(state, state.combatants[1])).toMatchObject({
        combatantId: "esquilo-coletor",
        kind: "ability",
        abilityId: "fruta-curadora",
        targetId: "esquilo-coletor",
      });
  });

  it("uses a defensive buff instead of repeating it when already active", () => {
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
            defense: 0,
            speed: 5,
          },
          {
            id: "ladybug",
            name: "Joaninha Encouraçada",
            side: "b",
            maxHp: 100,
            attack: 5,
            imagination: 20,
            defense: 25,
            speed: 2,
            abilities: [
              { id: "bola-brilhante", name: "Bola Brilhante", target: "enemy", power: "imaginary", multiplier: 1 },
              {
                id: "encolher",
                name: "Encolher",
                target: "self",
                effects: [{ kind: "stat", stat: "defense", amount: 20, rounds: 2 }],
              },
            ],
          },
        ],
      });
      const action = chooseEnemyAction(state, state.combatants[1]);
      expect(action.abilityId).toBe("encolher");

      state.combatants[1].effects.push({
        id: "defense-buff",
        kind: "stat",
        stat: "defense",
        amount: 20,
        roundsLeft: 2,
      });
      expect(chooseEnemyAction(state, state.combatants[1]).abilityId).toBe("bola-brilhante");
  });

  it("maps the Besta's documented conditional attacks and lowered base attack", () => {
    const beast = companions.find((character) => character.id === "besta")!;
    const beastBoss = enemies.find((character) => character.id === "besta-chefe")!;
    const abilities = beast.abilities.filter((ability) => ability.kind === "active").map(toCombatAbility);
    const bossAbilities = beastBoss.abilities.filter((ability) => ability.kind === "active").map(toCombatAbility);

    expect(beast.stats.attack).toBe(60);
    expect(beastBoss.stats.attack).toBe(60);
    expect(abilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "garra-fera",
        power: "physical",
        multiplier: 1,
        critBonus: 50,
        conditionalMultiplier: { targetEffect: "bleed", amount: 1 },
      }),
      expect.objectContaining({
        id: "abocanhar",
        power: "physical",
        multiplier: 3,
        cannotMissTargetEffect: "bleed",
      }),
    ]));
    expect(bossAbilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "garra-fera-chefe",
        multiplier: 1,
        conditionalMultiplier: { targetEffect: "bleed", amount: 1 },
      }),
      expect.objectContaining({
        id: "abocanhar-chefe",
        multiplier: 1,
        conditionalMultiplier: { targetEffect: "bleed", amount: 2 },
      }),
    ]));
  });

  it("automates the Besta, prioritizes the lowest-health bleeding enemy, and skips alternate turns", () => {
    const beast = companions.find((character) => character.id === "besta")!;
    const state = createBattle({
      seed: 1234,
      combatants: [
        {
          id: beast.id,
          name: beast.name,
          side: "a",
          combatClass: beast.class,
          maxHp: beast.stats.hp,
          attack: beast.stats.attack,
          imagination: beast.stats.imagination,
          defense: beast.stats.defense,
          speed: beast.stats.speed,
          abilities: beast.abilities.flatMap((ability) => {
            const mapped = toCombatAbility(ability);
            return mapped ? [mapped] : [];
          }),
          passives: beast.abilities.filter((ability) => ability.kind === "passive").map((ability) => ability.id),
        },
        {
          id: "bleeding-high",
          name: "Bleeding High",
          side: "b",
          maxHp: 100,
          hp: 50,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
        {
          id: "bleeding-low",
          name: "Bleeding Low",
          side: "b",
          maxHp: 100,
          hp: 20,
          attack: 10,
          imagination: 10,
          defense: 0,
          speed: 1,
        },
      ],
    });
    state.combatants[1].effects.push({ id: "bleed-high", kind: "bleed" });
    state.combatants[2].effects.push({ id: "bleed-low", kind: "bleed" });

    const firstAction = chooseEnemyAction(state, state.combatants[0]);
    expect(firstAction).toMatchObject({
      combatantId: "besta",
      kind: "ability",
      targetId: "bleeding-low",
    });
    state.actions.push(firstAction);
    expect(chooseEnemyAction(state, state.combatants[0])).toEqual({
      combatantId: "besta",
      kind: "pass",
    });
  });
});
