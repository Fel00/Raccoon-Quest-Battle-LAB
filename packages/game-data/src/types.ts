export type CharacterClass =
  | "Aventureiro"
  | "Mago"
  | "Guerreiro"
  | "Ladino"
  | "Bardo"
  | "Demônio";

export type CatalogAbility = {
  id: string;
  name: string;
  description: string;
  kind: "active" | "passive";
  paCost?: number;
  unresolved?: string[];
};

export type CharacterStats = {
  hp: number;
  attack: number;
  imagination: number;
  defense: number;
  speed: number;
  precision?: number;
  critRate?: number;
};

export type CharacterRecord = {
  id: string;
  name: string;
  race: string;
  class: CharacterClass;
  profile: string;
  stats: CharacterStats;
  abilities: CatalogAbility[];
  sourcePage: number;
  notes?: string[];
};

export type PipVariation = CharacterRecord & {
  kind: "pip";
  enablingHatIds: string[];
};

export type Companion = CharacterRecord & {
  kind: "companion";
};

export type Enemy = CharacterRecord & {
  kind: "enemy";
  chapter: "Floresta" | "Cidade" | "Fazenda";
  boss?: "area" | "chapter" | "secret";
};

export type EncounterDifficulty = "Iniciante" | "Moderado" | "Avançado" | "Chefe" | "Extremo";

export type BattleEncounter = {
  id: string;
  title: string;
  difficulty: EncounterDifficulty;
  description: string;
  opponentIds: string[];
};

export type Equipment = {
  id: string;
  number: number;
  name: string;
  mundaneName: string;
  kind: "weapon" | "hat";
  tier: 1 | 2 | 3 | 4;
  stats: Partial<Record<"hp" | "attack" | "imagination" | "defense" | "speed", number>>;
  passiveOrActive: string;
  restrictions?: CharacterClass[];
  bannedFromPvP?: boolean;
  enablesPipVariation?: string;
  sourcePage: number;
};

export type Consumable = {
  id: string;
  number: number;
  name: string;
  mundaneName: string;
  effect: string;
  sourcePage: number;
  unresolved?: string[];
};

export type SiegeAscension = {
  level: number;
  description: string;
};

export type SiegeBoss = {
  id: string;
  name: string;
  ascensions: SiegeAscension[];
  rewards: Array<{ ascension: number; kind: "equipment" | "companion" | "visual"; itemId?: string; description: string }>;
};

export type CatalogValidationIssue = {
  code: "missing-reference" | "invalid-data" | "missing-unresolved-resolution";
  message: string;
};
