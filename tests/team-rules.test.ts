import { describe, expect, it } from "vitest";
import {
  createInMemoryTeam,
  resolveFinalStats,
  resolveTeam,
  setTeamMember,
  validateTeam,
  type TeamSelection,
} from "../packages/game-rules/src/index.js";

function validTeam(): TeamSelection {
  return {
    name: "Equipe teste",
    mode: "pve",
    members: [
      { characterId: "pip-adventure", hatId: "touca-natacao", weaponId: "guarda-chuva-velho" },
      { characterId: "chirp" },
      { characterId: "louise" },
      { characterId: "skunk" },
    ],
  };
}

describe("phase 4 team rules", () => {
  it("creates an editable in-memory team", () => {
    const team = createInMemoryTeam("Exploração");
    const edited = setTeamMember(team, 1, { characterId: "chirp" });
    expect(edited.name).toBe("Exploração");
    expect(edited.members[1].characterId).toBe("chirp");
  });

  it("requires Pip in slot one", () => {
    const team = validTeam();
    team.members[0] = { characterId: "chirp" };
    const issues = validateTeam(team);
    expect(issues.some((issue) => issue.code === "pip-required")).toBe(true);
  });

  it("allows an otherwise valid team and sums equipment", () => {
    const team = validTeam();
    expect(validateTeam(team)).toEqual([]);
    expect(resolveTeam(team)).not.toBeNull();
    expect(resolveFinalStats(team.members[0])).toEqual({
      hp: 630,
      attack: 34,
      imagination: 42,
      defense: 33,
      speed: 3,
      precision: 100,
      critRate: 10,
    });
  });

  it("blocks restricted equipment", () => {
    const team = validTeam();
    team.members[1] = { characterId: "chirp", weaponId: "rolo-macarrao" };
    expect(validateTeam(team).some((issue) => issue.code === "class-restricted")).toBe(true);
  });

  it("blocks Tier 4 equipment in PvP", () => {
    const team = validTeam();
    team.mode = "pvp";
    team.members[0].hatId = "elmo-rei-castor";
    expect(validateTeam(team).some((issue) => issue.code === "tier4-in-pvp")).toBe(true);
  });

  it("blocks repeated characters until P-11 is decided", () => {
    const team = validTeam();
    team.members[2] = { characterId: "chirp" };
    expect(validateTeam(team).some((issue) => issue.code === "duplicate-character")).toBe(true);
  });

  it("blocks a second Demon", () => {
    const team = validTeam();
    team.members[3] = { characterId: "serpente" };
    team.members[2] = { characterId: "besta" };
    expect(validateTeam(team).some((issue) => issue.code === "duplicate-demon")).toBe(true);
  });

  it("changes Pip stats and class according to its hat", () => {
    const stats = resolveFinalStats({
      characterId: "pip-adventure",
      hatId: "cone-transito",
    });
    expect(stats).toEqual({
      hp: 680,
      attack: 30,
      imagination: 40,
      defense: 25,
      speed: 3,
      precision: 100,
      critRate: 10,
    });
  });

  it("clears equipment when a companion changes", () => {
    const team = validTeam();
    team.members[1] = { characterId: "chirp", weaponId: "galho-retorcido", hatId: "fone-ouvido" };
    const changed = setTeamMember(team, 1, { characterId: "louise" });
    expect(changed.members[1]).toEqual({ characterId: "louise" });
  });

  it("clears an incompatible weapon when Pip changes class", () => {
    const team = validTeam();
    team.members[0] = { characterId: "pip-adventure", hatId: "balde-praia", weaponId: "rolo-macarrao" };
    const changed = setTeamMember(team, 0, {
      characterId: "pip-adventure",
      hatId: "cone-transito",
      weaponId: "rolo-macarrao",
    });
    expect(changed.members[0].weaponId).toBeUndefined();
  });
});
