import { describe, expect, it } from "vitest";
import {
  companions,
  consumables,
  enemies,
  hats,
  battleEncounters,
  pipVariations,
  siegeBosses,
  validateCatalog,
  weapons,
} from "../packages/game-data/src/index.js";

describe("game data catalog", () => {
  it("registers the documented top-level content counts", () => {
    expect(pipVariations).toHaveLength(5);
    expect(companions).toHaveLength(19);
    expect(weapons).toHaveLength(16);
    expect(hats).toHaveLength(25);
    expect(consumables).toHaveLength(18);
    expect(enemies).toHaveLength(46);
  });

  it("keeps all documented siege bosses at 13 ascensions", () => {
    expect(siegeBosses).toHaveLength(5);
    expect(siegeBosses.every((boss) => boss.ascensions.length === 13)).toBe(true);
  });

  it("defines encounters using known combatants and supports larger enemy groups", () => {
    const knownCombatantIds = new Set([
      ...pipVariations.map((character) => character.id),
      ...companions.map((character) => character.id),
      ...enemies.map((enemy) => enemy.id),
    ]);

    expect(battleEncounters.length).toBeGreaterThanOrEqual(6);
    expect(battleEncounters.every((encounter) =>
      encounter.opponentIds.length > 0
      && encounter.opponentIds.every((id) => knownCombatantIds.has(id)),
    )).toBe(true);
    expect(battleEncounters.some((encounter) => encounter.opponentIds.length > 4)).toBe(true);
  });

  it("has no duplicate ids or missing equipment and Pip references", () => {
    const issues = validateCatalog();
    expect(issues.filter((issue) => issue.code === "missing-reference")).toEqual([]);
    expect(issues.filter((issue) => issue.code === "invalid-data")).toEqual([]);
  });

  it("includes the complete reference descriptions for key character abilities", () => {
    const pip = pipVariations.find((item) => item.id === "pip-old-sage");
    const harold = companions.find((item) => item.id === "harold");
    const falseProphet = companions.find((item) => item.id === "falso-profeta");

    expect(pip?.abilities.find((item) => item.id === "explosao-instavel")?.description).toContain("Atordoado");
    expect(harold?.abilities.find((item) => item.id === "trovao")?.description).toContain("15 PA");
    expect(falseProphet?.abilities.find((item) => item.id === "profecia-inevitavel")?.description).toContain("13 acúmulos");
  });
});
