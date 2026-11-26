import {
  companions,
  consumables,
  enemies,
  hats,
  pipVariations,
  siegeBosses,
  weapons,
} from "./catalog.js";
import type { CatalogValidationIssue, CharacterRecord, Equipment } from "./types.js";

function addDuplicateIssues(
  issues: CatalogValidationIssue[],
  records: Array<{ id: string }>,
  label: string,
): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      issues.push({ code: "invalid-data", message: `Duplicate ${label} id: ${record.id}` });
    }
    seen.add(record.id);
  }
}

export function validateCatalog(): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  addDuplicateIssues(issues, [...pipVariations, ...companions, ...enemies], "character");
  addDuplicateIssues(issues, [...weapons, ...hats], "equipment");
  addDuplicateIssues(issues, consumables, "consumable");
  addDuplicateIssues(issues, siegeBosses, "siege boss");

  const characters: CharacterRecord[] = [...pipVariations, ...companions, ...enemies];
  for (const character of characters) {
    if (character.stats.hp <= 0) {
      issues.push({ code: "invalid-data", message: `${character.id}: HP must be positive.` });
    }
    for (const ability of character.abilities) {
      if (ability.unresolved?.length) {
        issues.push({
          code: "missing-unresolved-resolution",
          message: `${character.id}/${ability.id}: ${ability.unresolved.join(", ")}`,
        });
      }
    }
  }

  const pipIds = new Set(pipVariations.map((pip) => pip.id));
  for (const pip of pipVariations) {
    for (const hatId of pip.enablingHatIds) {
      if (!hats.some((hat) => hat.id === hatId)) {
        issues.push({ code: "missing-reference", message: `${pip.id}: unknown enabling hat ${hatId}` });
      }
    }
  }

  for (const hat of hats) {
    if (hat.enablesPipVariation && !pipIds.has(hat.enablesPipVariation)) {
      issues.push({ code: "missing-reference", message: `${hat.id}: unknown Pip variation ${hat.enablesPipVariation}` });
    }
  }

  for (const reward of siegeBosses.flatMap((boss) => boss.rewards)) {
    if (reward.kind === "equipment" && reward.itemId && ![...weapons, ...hats].some((item) => item.id === reward.itemId)) {
      issues.push({ code: "missing-reference", message: `Siege reward: unknown equipment ${reward.itemId}` });
    }
    if (reward.kind === "companion" && reward.itemId && ![...pipVariations, ...companions].some((character) => character.id === reward.itemId)) {
      issues.push({ code: "missing-reference", message: `Siege reward: unknown companion ${reward.itemId}` });
    }
  }

  for (const boss of siegeBosses) {
    if (boss.ascensions.length !== 13) {
      issues.push({ code: "invalid-data", message: `${boss.id}: expected 13 ascensions, found ${boss.ascensions.length}` });
    }
  }

  return issues;
}

export function isCatalogReady(): boolean {
  return validateCatalog().every((issue) => issue.code !== "missing-reference" && issue.code !== "invalid-data");
}
