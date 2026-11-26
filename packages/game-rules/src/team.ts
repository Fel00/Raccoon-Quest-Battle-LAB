import {
  companions,
  hats,
  pipVariations,
  weapons,
  type CharacterRecord,
  type Equipment,
} from "@raccoon/game-data";
import type {
  FinalStats,
  TeamIssue,
  TeamMemberSelection,
  TeamSelection,
  ResolvedTeam,
  ResolvedTeamMember,
} from "./types.js";

const characters = [...pipVariations, ...companions];

function findCharacter(id: string): CharacterRecord | undefined {
  return characters.find((character) => character.id === id);
}

function findEquipment(id: string): Equipment | undefined {
  return [...weapons, ...hats].find((equipment) => equipment.id === id);
}

function resolvePipVariation(selection: TeamMemberSelection): CharacterRecord {
  if (!selection.hatId) {
    return pipVariations.find((pip) => pip.id === "pip-adventure")!;
  }
  const hat = findEquipment(selection.hatId);
  if (hat?.kind === "hat" && hat.enablesPipVariation) {
    return pipVariations.find((pip) => pip.id === hat.enablesPipVariation)
      ?? pipVariations.find((pip) => pip.id === "pip-adventure")!;
  }
  return pipVariations.find((pip) => pip.id === "pip-adventure")!;
}

export function resolveFinalStats(member: TeamMemberSelection): FinalStats {
  const selected = findCharacter(member.characterId);
  if (!selected) {
    throw new Error(`Unknown character: ${member.characterId}`);
  }
  const isPip = pipVariations.some((pip) => pip.id === member.characterId);
  const character = isPip ? resolvePipVariation(member) : selected;
  const weapon = member.weaponId ? findEquipment(member.weaponId) : undefined;
  const hat = member.hatId ? findEquipment(member.hatId) : undefined;
  const equipment = [weapon, hat];

  return {
    hp: character.stats.hp + (equipment.reduce((sum, item) => sum + (item?.stats.hp ?? 0), 0)),
    attack: character.stats.attack + (equipment.reduce((sum, item) => sum + (item?.stats.attack ?? 0), 0)),
    imagination: character.stats.imagination + (equipment.reduce((sum, item) => sum + (item?.stats.imagination ?? 0), 0)),
    defense: character.stats.defense + (equipment.reduce((sum, item) => sum + (item?.stats.defense ?? 0), 0)),
    speed: character.stats.speed + (equipment.reduce((sum, item) => sum + (item?.stats.speed ?? 0), 0)),
    precision: character.stats.precision ?? 100,
    critRate: character.stats.critRate ?? 10,
  };
}

export function validateTeam(team: TeamSelection): TeamIssue[] {
  const issues: TeamIssue[] = [];
  if (team.members.length !== 4) {
    issues.push({ code: "wrong-slot-count", message: "A team must contain exactly four slots." });
  }

  const ids = new Set<string>();
  let demonCount = 0;

  team.members.forEach((member, index) => {
    if (index === 0) {
      const isPip = pipVariations.some((pip) => pip.id === member.characterId);
      if (!isPip) {
        issues.push({ code: "pip-required", memberIndex: 0, message: "Slot 1 must contain a Pip variation." });
      }
    }

    const character = index === 0
      ? resolvePipVariation(member)
      : findCharacter(member.characterId);

    if (!character) {
      issues.push({ code: "unknown-character", memberIndex: index, message: `Unknown character: ${member.characterId}` });
      return;
    }

    if (ids.has(character.id)) {
      issues.push({
        code: "duplicate-character",
        memberIndex: index,
        message: `Repeated hero not decided by P-11: ${character.name}`,
      });
    }
    ids.add(character.id);

    if (character.class === "Demônio") {
      demonCount += 1;
      if (demonCount > 1) {
        issues.push({ code: "duplicate-demon", memberIndex: index, message: "A team cannot contain more than one Demon." });
      }
    }

    const weapon = member.weaponId ? findEquipment(member.weaponId) : undefined;
    const hat = member.hatId ? findEquipment(member.hatId) : undefined;
    for (const equipment of [weapon, hat]) {
      if (!equipment) {
        if ((member.weaponId && !weapon) || (member.hatId && !hat)) {
          issues.push({
            code: "unknown-equipment",
            memberIndex: index,
            message: `Unknown equipment in slot ${index + 1}.`,
          });
        }
        continue;
      }

      if (equipment.restrictions && !equipment.restrictions.includes(character.class)) {
        issues.push({
          code: "class-restricted",
          memberIndex: index,
          message: `${equipment.name} cannot be equipped by ${character.class}.`,
        });
      }
      if (team.mode === "pvp" && equipment.bannedFromPvP) {
        issues.push({
          code: "tier4-in-pvp",
          memberIndex: index,
          message: `${equipment.name} is banned in PvP.`,
        });
      }
    }

  });

  return issues;
}

export function resolveTeam(team: TeamSelection): ResolvedTeam | null {
  if (validateTeam(team).length > 0) return null;
  const members: ResolvedTeamMember[] = team.members.map((member, index) => {
    const character = index === 0
      ? resolvePipVariation(member)
      : findCharacter(member.characterId);
    if (!character) throw new Error(`Unknown character: ${member.characterId}`);
    return {
      characterId: character.id,
      characterName: character.name,
      class: character.class,
      weaponId: member.weaponId,
      hatId: member.hatId,
      stats: resolveFinalStats(member),
    };
  });
  return { name: team.name, mode: team.mode, members };
}

export function createInMemoryTeam(name = "Nova equipe"): TeamSelection {
  return {
    name,
    mode: "pve",
    members: [
      { characterId: "pip-adventure" },
      { characterId: "" },
      { characterId: "" },
      { characterId: "" },
    ],
  };
}

export function setTeamMember(team: TeamSelection, index: number, member: TeamMemberSelection): TeamSelection {
  if (index < 0 || index > 3) throw new Error("Team slot must be between 0 and 3.");
  const previous = team.members[index];
  const characterChanged = index > 0 && previous.characterId !== member.characterId;
  let normalized = characterChanged
    ? { ...member, weaponId: undefined, hatId: undefined }
    : { ...member };
  if (!characterChanged && previous.hatId !== member.hatId) {
    const weapon = member.weaponId ? findEquipment(member.weaponId) : undefined;
    const effectiveCharacter = index === 0
      ? resolvePipVariation(member)
      : findCharacter(member.characterId);
    if (weapon?.kind === "weapon" && weapon.restrictions
      && effectiveCharacter && !weapon.restrictions.includes(effectiveCharacter.class)) {
      normalized = { ...normalized, weaponId: undefined };
    }
  }
  const members = team.members.map((current, currentIndex) =>
    currentIndex === index ? normalized : { ...current },
  ) as TeamSelection["members"];
  return { ...team, members };
}
