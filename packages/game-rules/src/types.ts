export type BattleMode = "pve" | "pvp" | "siege";

export type TeamMemberSelection = {
  characterId: string;
  weaponId?: string;
  hatId?: string;
};

export type TeamSelection = {
  name: string;
  mode: BattleMode;
  members: [
    TeamMemberSelection,
    TeamMemberSelection,
    TeamMemberSelection,
    TeamMemberSelection,
  ];
};

export type FinalStats = {
  hp: number;
  attack: number;
  imagination: number;
  defense: number;
  speed: number;
  precision: number;
  critRate: number;
};

export type TeamIssueCode =
  | "wrong-slot-count"
  | "pip-required"
  | "unknown-character"
  | "unknown-equipment"
  | "duplicate-character"
  | "duplicate-demon"
  | "class-restricted"
  | "tier4-in-pvp";

export type TeamIssue = {
  code: TeamIssueCode;
  message: string;
  memberIndex?: number;
};

export type ResolvedTeamMember = {
  characterId: string;
  characterName: string;
  class: import("@raccoon/game-data").CharacterClass;
  weaponId?: string;
  hatId?: string;
  stats: FinalStats;
};

export type ResolvedTeam = {
  name: string;
  mode: BattleMode;
  members: ResolvedTeamMember[];
};
