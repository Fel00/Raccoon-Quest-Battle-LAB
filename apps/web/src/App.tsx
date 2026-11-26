import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAction,
  createBattle,
  previewNextTurns,
  stat,
  startRound,
  type AbilityDef,
  type BattleState,
  type CombatantState,
  type CombatantSetup,
  type StatName,
} from "@raccoon/combat-engine";
import {
  companions,
  enemies,
  hats,
  battleEncounters,
  pipVariations,
  weapons,
  type BattleEncounter,
  type CharacterRecord,
} from "@raccoon/game-data";
import {
  createInMemoryTeam,
  resolveTeam,
  setTeamMember,
  validateTeam,
  type BattleMode,
  type ResolvedTeam,
  type TeamSelection,
} from "@raccoon/game-rules";
import { toCombatAbility } from "./combatAbilities.js";
import { chooseEnemyAction } from "./combatAI.js";

type Screen = "menu" | "team" | "encounters" | "combat";
type SpriteFolder = "characters" | "enemies" | "hats" | "items" | "weapons";

type FloatingNumber = {
  id: string;
  text: string;
  kind: "physical" | "imaginary" | "heal";
  critical: boolean;
  targetId: string;
};

const combatStats: Array<{ key: StatName; label: string; percent?: boolean }> = [
  { key: "attack", label: "ATQ" },
  { key: "imagination", label: "IMG" },
  { key: "defense", label: "DEF" },
  { key: "speed", label: "VEL" },
  { key: "precision", label: "PREC", percent: true },
  { key: "critRate", label: "CRIT", percent: true },
];

function displayHp(value: number): number {
  return Math.ceil(value);
}

function displayCombatStat(base: number, modifier: number, percent = false): string {
  const format = (value: number) => String(Math.round(value));
  const roundedModifier = Math.round(modifier);
  const adjustment = roundedModifier === 0 ? "" : `${roundedModifier > 0 ? "+" : ""}${format(modifier)}`;
  return `${format(base)}${adjustment}${percent ? "%" : ""}`;
}

function findCharacterRecord(id: string): CharacterRecord | undefined {
  return [...pipVariations, ...companions, ...enemies].find((character) => character.id === id);
}

function findAbilityRecord(abilityId: string) {
  return [...pipVariations, ...companions, ...enemies]
    .flatMap((character) => character.abilities)
    .find((ability) => ability.id === abilityId);
}

function describeBattleEvent(event: BattleState["events"][number], battle: BattleState): string {
  const combatantName = (id: unknown) =>
    battle.combatants.find((combatant) => combatant.id === String(id))?.name ?? String(id ?? "Alvo");
  const effectName: Record<string, string> = {
    bleed: "Sangramento",
    stun: "Atordoamento",
    hidden: "Escondido",
    threat: "Ameaça",
    malediction: "Maldição",
    cooperation: "Cooperação",
    "grand-band": "Uma banda grandiosa",
    "field-effect-applied": "efeito de campo",
    "stun-immunity": "Imunidade a Atordoamento",
    instability: "Instabilidade",
    corrosion: "Corrosão",
    camouflage: "Camuflagem",
    "imaginary-barrier": "Barreira Imaginária",
    "imagination-defense": "Defesa usa Imaginação",
    "ability-seal": "Habilidade bloqueada",
    stat: "alteração de atributo",
    "sala-brincadeira": "Sala da brincadeira",
  };
  const abilityName = (id: unknown) =>
    findAbilityRecord(String(id ?? ""))?.name ?? String(id ?? "habilidade");

  switch (event.type) {
    case "ability-used":
      return `${combatantName(event.combatantId)} usou ${abilityName(event.abilityId)}.`;
    case "damage":
      return `${combatantName(event.attackerId)} causou ${Math.round(Number(event.amount ?? 0))} de dano em ${combatantName(event.targetId)}${event.critical ? " (crítico)" : ""}.`;
    case "healed":
      return `${combatantName(event.healerId)} curou ${combatantName(event.targetId)} em ${Math.round(Number(event.amount ?? 0))} PV${event.critical ? " (crítico)" : ""}.`;
    case "bleed-damage":
      return `${combatantName(event.combatantId)} sofreu ${Math.round(Number(event.amount ?? 0))} de dano por Sangramento.`;
    case "effect-applied":
      return `${combatantName(event.targetId)} recebeu ${effectName[String(event.effect)] ?? String(event.effect)}.`;
    case "effect-ended":
      return `${effectName[String(event.effect)] ?? String(event.effect)} terminou em ${combatantName(event.combatantId)}.`;
    case "field-effect-applied":
      return `Efeito de campo ativado: ${effectName[String(event.effect)] ?? String(event.effect)}.`;
    case "field-effect-ended":
      return `Efeito de campo encerrado: ${effectName[String(event.effect)] ?? String(event.effect)} (${String(event.reason)}).`;
    case "passive-triggered":
      return `Passiva ${abilityName(event.passiveId)} ativada por ${combatantName(event.combatantId)}.`;
    case "proof-increased":
      return `Prova aumentou para ${String(event.amount)}.`;
    case "attack-missed":
      return `${combatantName(event.attackerId)} errou ${abilityName(event.abilityId)} contra ${combatantName(event.targetId)}.`;
    case "turn-passed":
      return `${combatantName(event.combatantId)} passou o turno.`;
    case "turn-stunned":
      return `${combatantName(event.combatantId)} perdeu o turno por Atordoamento.`;
    case "combatant-summoned":
      return `${combatantName(event.combatantId)} invocou ${String(event.name ?? "um aliado")}.`;
    default:
      return "";
  }
}

const spriteExtensions = ["png", "webp", "jpg", "jpeg", "svg"];

function spriteSources(id: string, folder: SpriteFolder): string[] {
  return [
    ...spriteExtensions.map((extension) => `/sprites/${folder}/${id}.${extension}`),
    ...spriteExtensions.map((extension) => `/sprites/${id}.${extension}`),
    "/sprites/template.svg",
  ];
}

function Sprite({
  id,
  name,
  folder = "characters",
}: {
  id: string;
  name: string;
  folder?: SpriteFolder;
}) {
  const sources = spriteSources(id, folder);
  const sourceKey = `${folder}/${id}`;
  const [failedSource, setFailedSource] = useState<{ key: string; index: number }>({ key: "", index: 0 });
  const sourceIndex = failedSource.key === sourceKey ? failedSource.index : 0;
  const source = sources[sourceIndex] ?? "/sprites/template.svg";

  return (
    <div className="sprite" title={name}>
      <img
        key={sourceKey}
        src={source}
        alt={`Retrato de ${name}`}
        onError={() => setFailedSource((current) => {
          const currentIndex = current.key === sourceKey ? current.index : 0;
          return { key: sourceKey, index: Math.min(currentIndex + 1, sources.length - 1) };
        })}
      />
    </div>
  );
}

function ModeCard({
  title,
  description,
  enabled,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`mode-card ${selected ? "selected" : ""}`}
      disabled={!enabled}
      onClick={onClick}
      type="button"
    >
      <strong>{title}</strong>
      <span>{description}</span>
      {!enabled && <small>Disponível em fase futura</small>}
    </button>
  );
}

function buildPlayerCombatant(
  member: ResolvedTeam["members"][number],
): CombatantSetup {
  const character = findCharacterRecord(member.characterId);
  const passiveIds = character?.abilities
    .filter((ability) => ability.kind === "passive")
    .map((ability) => ability.id) ?? [];
  return {
    id: member.characterId,
    name: member.characterName,
    side: "a",
    combatClass: member.class,
    maxHp: member.stats.hp,
    attack: member.stats.attack,
    imagination: member.stats.imagination,
    defense: member.stats.defense,
    speed: member.stats.speed,
    precision: 100,
    critRate: 10,
    abilities: character?.abilities.flatMap((ability) => {
      const combatAbility = toCombatAbility(ability);
      return combatAbility ? [combatAbility] : [];
    }) ?? [],
    passives: passiveIds,
    usesProof: member.characterId === "falso-profeta",
    rigido: passiveIds.includes("rigido"),
    extraFlasks: passiveIds.includes("setup-laboratorio") ? 2 : 0,
  };
}

function buildCombatantSetup(
  character: CharacterRecord,
  side: "a" | "b",
  instanceId = character.id,
  enableSummons = true,
): CombatantSetup {
  const abilities = character.abilities.flatMap((source): AbilityDef[] => {
    if (!enableSummons && source.id === "reproducao-acelerada") return [];
    const combatAbility = toCombatAbility(source);
    if (!combatAbility) return [];
    if (enableSummons && source.id === "chamar-reforcos") {
      const templates = ["castor-serrador", "castor-engenheiro"].map((id) => {
        const record = findCharacterRecord(id);
        if (!record) throw new Error(`Missing summon template in game data: ${id}`);
        return buildCombatantSetup(record, side, record.id, false);
      });
      combatAbility.summon = { templates, maxAlive: 1 };
    } else if (enableSummons && source.id === "barricada-troncos") {
      combatAbility.summon = {
        templates: [{
          id: "barricada-troncos",
          spriteFolder: "enemies",
          name: "Muralha de Troncos",
          side,
          maxHp: 400,
          attack: 0,
          imagination: 0,
          defense: 0,
          speed: 0,
          abilities: [],
        }],
        maxAlive: 1,
        initialEffects: [{ kind: "threat" }],
      };
    } else if (enableSummons && source.id === "reproducao-acelerada") {
      const record = findCharacterRecord("rato-celeiro");
      if (!record) throw new Error("Missing summon template in game data: rato-celeiro");
      combatAbility.summon = {
        templates: [buildCombatantSetup(record, side, record.id, false)],
        teamMaxAlive: 4,
      };
    }
    return [combatAbility];
  });
  const isEnemy = enemies.some((enemy) => enemy.id === character.id);
  const passiveIds = character.abilities
    .filter((ability) => ability.kind === "passive")
    .map((ability) => ability.id);
  return {
    id: instanceId,
    spriteId: character.id,
    spriteFolder: isEnemy ? "enemies" : "characters",
    name: character.name,
    side,
    combatClass: character.class,
    maxHp: character.stats.hp,
    attack: character.stats.attack,
    imagination: character.stats.imagination,
    defense: character.stats.defense,
    speed: character.stats.speed,
    precision: character.stats.precision ?? 100,
    critRate: character.stats.critRate ?? 10,
    abilities,
    passives: passiveIds,
    usesProof: character.id === "falso-profeta" || character.id === "falso-profeta-fazenda",
    rigido: passiveIds.includes("rigido"),
    extraFlasks: passiveIds.includes("setup-laboratorio") ? 2 : 0,
  };
}

function encounterOpponents(encounter: BattleEncounter): CharacterRecord[] {
  return encounter.opponentIds.map((id) => {
    const character = findCharacterRecord(id);
    if (!character) throw new Error(`Encounter "${encounter.id}" references unknown combatant "${id}".`);
    return character;
  });
}

function buildEncounterCombatants(encounter: BattleEncounter): CombatantSetup[] {
  const occurrences = new Map<string, number>();
  return encounterOpponents(encounter).map((character) => {
    const occurrence = (occurrences.get(character.id) ?? 0) + 1;
    occurrences.set(character.id, occurrence);
    const instanceId = occurrence === 1 ? character.id : `${character.id}-${occurrence}`;
    return buildCombatantSetup(character, "b", instanceId);
  });
}

function CatalogPicker({
  picker,
  team,
  mode,
  onClose,
  onSelect,
}: {
  picker: { index: number; kind: "character" | "weapon" | "hat" };
  team: TeamSelection;
  mode: BattleMode;
  onClose: () => void;
  onSelect: (patch: Partial<TeamSelection["members"][number]>) => void;
}) {
  const member = team.members[picker.index];
  let character =
    picker.index === 0
      ? pipVariations.find((pip) => pip.id === "pip-adventure")
      : companions.find((companion) => companion.id === member.characterId);
  if (picker.index === 0 && member.hatId) {
    const hat = hats.find((item) => item.id === member.hatId);
    if (hat?.enablesPipVariation) {
      character = pipVariations.find((pip) => pip.id === hat.enablesPipVariation);
    }
  }

  const availableCharacters = companions.filter((companion) => {
    if (team.members.some((selected, index) => index !== picker.index && selected.characterId === companion.id)) {
      return false;
    }
    if (companion.class === "Demônio") {
      const demonAlreadySelected = team.members.some(
        (selected, index) => index !== picker.index
          && companions.find((candidate) => candidate.id === selected.characterId)?.class === "Demônio",
      );
      if (demonAlreadySelected) return false;
    }
    return true;
  });

  const title =
    picker.kind === "character"
      ? "Escolha um companheiro"
      : picker.kind === "weapon"
        ? "Escolha uma arma"
        : picker.index === 0
          ? "Escolha o chapéu e a variação de Pip"
          : "Escolha um chapéu";

  const cards =
    picker.kind === "character"
      ? availableCharacters.map((record) => ({ kind: "character" as const, record }))
      : picker.kind === "weapon"
        ? weapons
          .filter((item) => mode !== "pvp" || !item.bannedFromPvP)
          .filter((item) => !item.restrictions || (character && item.restrictions.includes(character.class)))
          .map((record) => ({ kind: "weapon" as const, record }))
        : hats
          .filter((item) => mode !== "pvp" || !item.bannedFromPvP)
          .map((record) => ({ kind: "hat" as const, record }));
  const initialSelectedId =
    picker.kind === "character" ? member.characterId
      : picker.kind === "weapon" ? member.weaponId
        : member.hatId;
  const [selectedId, setSelectedId] = useState<string>(
    cards.some(({ record }) => record.id === initialSelectedId)
      ? initialSelectedId ?? cards[0]?.record.id ?? ""
      : cards[0]?.record.id ?? "",
  );
  const selectedCard = cards.find(({ record }) => record.id === selectedId) ?? cards[0];
  const selectedCharacter = selectedCard?.kind === "character" ? selectedCard.record : null;
  const selectedEquipment =
    selectedCard?.kind === "weapon" || selectedCard?.kind === "hat" ? selectedCard.record : null;
  const pipVariation =
    picker.index === 0 && selectedEquipment?.kind === "hat"
      ? pipVariations.find((pip) => pip.id === selectedEquipment.enablesPipVariation)
      : undefined;

  return (
    <div className="picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="catalog-picker" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="picker-header">
          <div>
            <p className="eyebrow">Catálogo estratégico</p>
            <h2>{title}</h2>
          </div>
          <button className="back" type="button" onClick={onClose}>Fechar</button>
        </header>
        {selectedCard && (
          <div className="catalog-browser">
            <div className="catalog-detail">
              {selectedCharacter ? (
                <>
                  <div className="detail-identity">
                    <Sprite id={selectedCharacter.id} name={selectedCharacter.name} />
                    <div>
                      <p className="eyebrow">{selectedCharacter.race}</p>
                      <h3>{selectedCharacter.name}</h3>
                      <strong>{selectedCharacter.class}</strong>
                    </div>
                  </div>
                  <p className="detail-profile">{selectedCharacter.profile}</p>
                  <div className="detail-stats">
                    <span>Vida <b>{selectedCharacter.stats.hp}</b></span>
                    <span>Ataque <b>{selectedCharacter.stats.attack}</b></span>
                    <span>Imaginação <b>{selectedCharacter.stats.imagination}</b></span>
                    <span>Defesa <b>{selectedCharacter.stats.defense}</b></span>
                    <span>Velocidade <b>{selectedCharacter.stats.speed}</b></span>
                    <span>Precisão <b>{selectedCharacter.stats.precision}%</b></span>
                    <span>Crítico <b>{selectedCharacter.stats.critRate}%</b></span>
                  </div>
                  <div className="detail-abilities">
                    {selectedCharacter.abilities.map((ability) => (
                      <section key={ability.id} className={ability.kind}>
                        <header>
                          <h4>{ability.name}</h4>
                          <span>{ability.kind === "passive" ? "Passiva" : ability.paCost ? `${ability.paCost} PA` : "Ativa"}</span>
                        </header>
                        <p>{ability.description}</p>
                      </section>
                    ))}
                  </div>
                </>
              ) : selectedEquipment ? (
                <>
                  <div className="detail-identity">
                    <Sprite
                      id={selectedEquipment.id}
                      name={selectedEquipment.name}
                      folder={selectedEquipment.kind === "hat" ? "hats" : "weapons"}
                    />
                    <div>
                      <p className="eyebrow">Tier {selectedEquipment.tier}</p>
                      <h3>{selectedEquipment.name}</h3>
                      <strong>{selectedEquipment.mundaneName}</strong>
                    </div>
                  </div>
                  <div className="equipment-meta detail-meta">
                    {selectedEquipment.bannedFromPvP && <span className="ban">Banido no PvP</span>}
                    {selectedEquipment.restrictions
                      ? <span>Classes: {selectedEquipment.restrictions.join(", ")}</span>
                      : <span>Sem restrição de classe</span>}
                  </div>
                  <div className="detail-stats">
                    {Object.entries(selectedEquipment.stats).map(([stat, value]) => (
                      <span key={stat}>
                        {stat === "hp" ? "Vida" : stat === "attack" ? "Ataque" : stat === "imagination" ? "Imaginação" : stat === "defense" ? "Defesa" : "Velocidade"}
                        <b>{value}</b>
                      </span>
                    ))}
                  </div>
                  <section className="equipment-detail">
                    <h4>Efeito</h4>
                    <p>{selectedEquipment.passiveOrActive}</p>
                  </section>
                  {picker.index === 0 && pipVariation && (
                    <section className="pip-variation-detail">
                      <div className="detail-identity pip-variation-identity">
                        <Sprite id={pipVariation.id} name={pipVariation.name} />
                        <div>
                          <p className="eyebrow">Variação desbloqueada</p>
                          <h3>{pipVariation.name}</h3>
                          <strong>{pipVariation.race} · {pipVariation.class}</strong>
                        </div>
                      </div>
                      <p className="detail-profile">{pipVariation.profile}</p>
                      <div className="detail-stats">
                        <span>Vida <b>{pipVariation.stats.hp + (selectedEquipment.stats.hp ?? 0)}</b></span>
                        <span>Ataque <b>{pipVariation.stats.attack + (selectedEquipment.stats.attack ?? 0)}</b></span>
                        <span>Imaginação <b>{pipVariation.stats.imagination + (selectedEquipment.stats.imagination ?? 0)}</b></span>
                        <span>Defesa <b>{pipVariation.stats.defense + (selectedEquipment.stats.defense ?? 0)}</b></span>
                        <span>Velocidade <b>{pipVariation.stats.speed + (selectedEquipment.stats.speed ?? 0)}</b></span>
                        <span>Precisão <b>{pipVariation.stats.precision}%</b></span>
                        <span>Crítico <b>{pipVariation.stats.critRate}%</b></span>
                      </div>
                      <div className="detail-abilities">
                        {pipVariation.abilities.map((ability) => (
                          <section key={ability.id} className={ability.kind}>
                            <header>
                              <h4>{ability.name}</h4>
                              <span>{ability.kind === "passive" ? "Passiva" : ability.paCost ? `${ability.paCost} PA` : "Ativa"}</span>
                            </header>
                            <p>{ability.description}</p>
                          </section>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : null}
            </div>
            <div className="catalog-rail" aria-label="Opções disponíveis">
              {cards.map(({ kind, record }) => (
                <button
                  className={`catalog-option ${selectedId === record.id ? "selected" : ""}`}
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                >
                  <Sprite
                    id={record.id}
                    name={record.name}
                    folder={kind === "character" ? "characters" : kind === "hat" ? "hats" : "weapons"}
                  />
                  <strong>{record.name}</strong>
                  {kind === "character" ? (
                    <span>{record.race} · {record.class}</span>
                  ) : picker.index === 0 && kind === "hat" ? (
                    <span className="rail-variation">
                      {pipVariations.find((pip) => pip.id === record.enablesPipVariation)?.name ?? "Pip (Adventure)"}
                      <small>{record.mundaneName}</small>
                    </span>
                  ) : (
                    <span>{record.mundaneName}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <footer className="catalog-footer">
          {selectedCard && (
            <button
              className="select-option catalog-confirm"
              type="button"
              onClick={() => onSelect(
                selectedCard.kind === "character"
                  ? { characterId: selectedCard.record.id }
                  : selectedCard.kind === "weapon"
                    ? { weaponId: selectedCard.record.id }
                    : { hatId: selectedCard.record.id },
              )}
            >
              Confirmar seleção
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<BattleMode>("pve");
  const [team, setTeam] = useState<TeamSelection>(() => {
    const initial = createInMemoryTeam("Equipe de teste");
    initial.members[1] = { characterId: "chirp" };
    initial.members[2] = { characterId: "louise" };
    initial.members[3] = { characterId: "skunk" };
    return initial;
  });
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [currentEncounterTitle, setCurrentEncounterTitle] = useState("");
  const [battleMusic, setBattleMusic] = useState<HTMLAudioElement | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [picker, setPicker] = useState<{
    index: number;
    kind: "character" | "weapon" | "hat";
  } | null>(null);

  const issues = useMemo(() => validateTeam({ ...team, mode }), [team, mode]);
  const resolved = useMemo(() => resolveTeam({ ...team, mode }), [team, mode]);

  function updateMode(next: BattleMode) {
    setMode(next);
    setTeam((current) => ({ ...current, mode: next }));
  }

  function updateMember(index: number, patch: Partial<TeamSelection["members"][number]>) {
    const current = team.members[index];
    setTeam((previous) => setTeamMember(previous, index, { ...current, ...patch }));
  }

  function startBattle(encounter: BattleEncounter) {
    if (!resolved) return;
    const setup: Parameters<typeof createBattle>[0] = {
      seed: 26062026,
      combatants: [
        ...resolved.members.map((member) => buildPlayerCombatant(member)),
        ...buildEncounterCombatants(encounter),
      ],
    };
    const created = createBattle(setup);
    const started = startRound(created);
    setCurrentEncounterTitle(encounter.title);
    setBattle(started);
    const tracks = [
      "/music/Raccoon%20Quest.mp3",
      "/music/Raccoon%20Quest%20(The%20Serpent).mp3",
      "/music/Raccoon%20Quest%20(The%20False%20Prophet).mp3",
      "/music/Raccon%20Quest%20(The%20Beast).mp3",
      "/music/Epic%20imaginary%20Ballad.mp3",
    ];
    const audio = new Audio(tracks[Math.floor(Math.random() * tracks.length)]);
    audio.loop = true;
    audio.volume = musicVolume;
    void audio.play().catch(() => undefined);
    setBattleMusic(audio);
    setScreen("combat");
  }

  useEffect(() => {
    if (battleMusic) battleMusic.volume = musicVolume;
  }, [battleMusic, musicVolume]);

  useEffect(() => {
    if (battle?.phase === "ended" && battleMusic) {
      battleMusic.pause();
      battleMusic.currentTime = 0;
      setBattleMusic(null);
    }
  }, [battle, battleMusic]);

  function exitCombat() {
    if (battle?.phase !== "ended" && !window.confirm("Deseja abandonar o combate? Sair agora contará como desistência.")) {
      return;
    }
    if (battleMusic) {
      battleMusic.pause();
      battleMusic.currentTime = 0;
      setBattleMusic(null);
    }
    setScreen("team");
  }

  function applyPlayerAction(abilityId: string | null, requestedTargetId?: string) {
    if (!battle || battle.phase === "ended") return;
    if (!battle.activeId) {
      return;
    }
    const active = battle.combatants.find((combatant) => combatant.id === battle.activeId);
    if (!active || active.side !== "a"
      || active.passives.includes("sono-eterno")
      || active.passives.includes("sono-eterno-chefe")) return;

    const nextBattle = structuredClone(battle);
    if (abilityId === null) {
      applyAction(nextBattle, { combatantId: active.id, kind: "pass" });
    } else {
      const ability = active.abilities.find((candidate) => candidate.id === abilityId);
      if (!ability) return;
      const actionTargetId = requestedTargetId
        ?? (ability.target === "self" ? active.id : undefined);
      if ((ability.target === "enemy" || ability.target === "ally" || ability.target === "any") && !actionTargetId) return;
      if ((ability.target === "enemy" || ability.target === "any") && !battle.combatants.some(
        (combatant) =>
          combatant.id === actionTargetId
          && (ability.target === "any" || combatant.side === "b")
          && combatant.alive
          && combatant.hp > 0
          && (ability.canTargetHidden || !combatant.effects.some((effect) => effect.kind === "hidden")),
      )) return;
      applyAction(nextBattle, {
        combatantId: active.id,
        kind: "ability",
        abilityId,
        targetId: actionTargetId,
      });
    }
    if (!nextBattle.activeId && nextBattle.phase !== "ended") startRound(nextBattle);
    setBattle(nextBattle);
  }

  useEffect(() => {
    if (!battle || battle.phase === "ended") return;

    if (!battle.activeId) {
      const timer = window.setTimeout(() => {
        setBattle((current) => {
          if (!current || current !== battle || current.activeId || current.phase === "ended") return current;
          const nextBattle = structuredClone(current);
          startRound(nextBattle);
          return nextBattle;
        });
      }, 250);
      return () => window.clearTimeout(timer);
    }

    const active = battle.combatants.find((combatant) => combatant.id === battle.activeId);
    const aiControlled = active?.side === "b"
      || active?.passives.includes("sono-eterno")
      || active?.passives.includes("sono-eterno-chefe");
    if (!active || !aiControlled) return;

    const timer = window.setTimeout(() => {
      setBattle((current) => {
        if (!current || current !== battle || current.activeId !== active.id || current.phase === "ended") return current;

        const nextBattle = structuredClone(current);
        const aiCombatant = nextBattle.combatants.find((combatant) => combatant.id === active.id);
        if (!aiCombatant) return current;

        applyAction(nextBattle, chooseEnemyAction(nextBattle, aiCombatant));

        if (!nextBattle.activeId && nextBattle.phase !== "ended") startRound(nextBattle);
        return nextBattle;
      });
    }, 1000 + Math.floor(Math.random() * 3001));
    return () => window.clearTimeout(timer);
  }, [battle]);

  return (
    <main className="app-shell">
      {screen === "menu" && (
        <section className="menu-screen">
          <div className="brand">
            <Sprite id="pip-adventure" name="Pip" />
            <div>
              <p className="eyebrow">Combat Lab</p>
              <h1>Raccoon Quest</h1>
            </div>
          </div>

          <div className="mode-grid">
            <ModeCard
              title="PvE Solo"
              description="Lute contra um grupo de teste local usando o motor determinístico."
              enabled
              selected={mode === "pve"}
              onClick={() => updateMode("pve")}
            />
            <ModeCard
              title="PvP"
              description="Duelos online com servidor autoritativo."
              enabled={false}
              selected={mode === "pvp"}
              onClick={() => updateMode("pvp")}
            />
            <ModeCard
              title="Cerco"
              description="Desafio contra chefes e ascensões."
              enabled={false}
              selected={mode === "siege"}
              onClick={() => updateMode("siege")}
            />
          </div>

          <button className="primary" type="button" onClick={() => setScreen("team")}>
            Montar equipe
          </button>
        </section>
      )}

      {screen === "team" && (
        <section className="team-screen">
          <header className="topbar">
            <button className="back" type="button" onClick={() => setScreen("menu")}>← Voltar</button>
            <div>
              <p className="eyebrow">{mode === "pve" ? "PvE Solo" : mode.toUpperCase()}</p>
              <h1>Montagem da equipe</h1>
            </div>
          </header>

          <div className="team-layout">
            <div className="slots">
              {team.members.map((member, index) => {
                const pip = index === 0;
                const pipHat = hats.find((hat) => hat.id === member.hatId);
                const effectivePipId = pipHat?.enablesPipVariation ?? "pip-adventure";
                const selected = pip
                  ? pipVariations.find((character) => character.id === effectivePipId)
                  : companions.find((character) => character.id === member.characterId);
                const characterClass = selected?.class;
                return (
                  <article className="member-card" key={index}>
                    <div className="slot-number">{index + 1}</div>
                    <Sprite
                      id={selected?.id ?? (member.characterId || "template")}
                      name={selected?.name ?? "Espaço vazio"}
                    />
                    <div className="member-fields">
                      {pip ? (
                        <button className="selection-button" type="button" onClick={() => setPicker({ index, kind: "hat" })}>
                          <span>Pip · {selected?.class}</span>
                          <strong>{pipHat?.name ?? "Adventure · sem chapéu"}</strong>
                          <small>Troque o chapéu para mudar a variação, classe e habilidades</small>
                        </button>
                      ) : (
                        <button className="selection-button" type="button" onClick={() => setPicker({ index, kind: "character" })}>
                          <span>{index === 1 ? "Segundo slot" : index === 2 ? "Terceiro slot" : "Quarto slot"}</span>
                          <strong>{selected?.name ?? "Escolher companheiro"}</strong>
                          <small>{selected ? `${selected.race} · ${selected.class}` : "Nenhuma opção vazia"}</small>
                        </button>
                      )}
                      {!pip && (
                        <button
                          className="selection-button compact"
                          type="button"
                          disabled={!selected}
                          onClick={() => setPicker({ index, kind: "hat" })}
                        >
                          <span>Chapéu</span>
                          <strong>{hats.find((item) => item.id === member.hatId)?.name ?? "Nenhum"}</strong>
                        </button>
                      )}
                      <button
                        className="selection-button compact"
                        type="button"
                        disabled={!selected}
                        onClick={() => setPicker({ index, kind: "weapon" })}
                      >
                        <span>Arma</span>
                        <strong>{weapons.find((item) => item.id === member.weaponId)?.name ?? "Nenhuma"}</strong>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="validation-panel">
              <h2>Validação</h2>
              {issues.length === 0 ? (
                <p className="ok">Equipe válida</p>
              ) : (
                <ul>
                  {issues.map((issue) => (
                    <li key={`${issue.code}-${issue.memberIndex ?? ""}`}>{issue.message}</li>
                  ))}
                </ul>
              )}
              {resolved && (
                <div className="team-summary">
                  {resolved.members.map((member) => (
                    <article className="resolved-member" key={member.characterId}>
                      <strong>{member.characterName}</strong>
                      <span className="resolved-class">{member.class}</span>
                      <div className="stats-grid">
                        <span>Vida <b>{member.stats.hp}</b></span>
                        <span>Ataque <b>{member.stats.attack}</b></span>
                        <span>Imaginação <b>{member.stats.imagination}</b></span>
                        <span>Defesa <b>{member.stats.defense}</b></span>
                        <span>Velocidade <b>{member.stats.speed}</b></span>
                        <span>Precisão <b>{member.stats.precision}%</b></span>
                        <span>Crítico <b>{member.stats.critRate}%</b></span>
                      </div>
                      {(() => {
                        const source = [...pipVariations, ...companions].find((item) => item.id === member.characterId);
                        return source ? (
                          <div className="ability-preview">
                            {source.abilities.map((ability) => (
                              <span key={ability.id} className={ability.kind}>
                                <b>{ability.name}</b>{ability.kind === "passive" ? " · Passiva" : ability.paCost ? ` · ${ability.paCost} PA` : ""}
                                <small>{ability.description}</small>
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>
          <footer className="team-start-bar">
            <button
              className="primary"
              type="button"
              disabled={!resolved}
              onClick={() => setScreen("encounters")}
            >
              Escolher cenário
            </button>
          </footer>
          {picker && (
            <CatalogPicker
              picker={picker}
              team={team}
              mode={mode}
              onClose={() => setPicker(null)}
              onSelect={(memberPatch) => {
                updateMember(picker.index, memberPatch);
                setPicker(null);
              }}
            />
          )}
        </section>
      )}

      {screen === "encounters" && (
        <section className="encounter-screen">
          <header className="topbar">
            <button className="back" type="button" onClick={() => setScreen("team")}>← Voltar à equipe</button>
            <div>
              <p className="eyebrow">PvE · cenários</p>
              <h1>Escolha um encontro</h1>
            </div>
          </header>
          <div className="encounter-grid">
            {battleEncounters.map((encounter) => {
              const opponents = encounterOpponents(encounter);
              return (
                <article className="encounter-card" key={encounter.id}>
                  <header className="encounter-card-header">
                    <div>
                      <p className="eyebrow">Encontro</p>
                      <h2>{encounter.title}</h2>
                    </div>
                    <span className="encounter-difficulty">
                      Dificuldade · {encounter.difficulty}
                    </span>
                  </header>
                  <p className="encounter-description">{encounter.description}</p>
                  <div className="encounter-opponents">
                    <ul className="encounter-opponent-list">
                      {opponents.map((opponent, index) => (
                        <li key={`${opponent.id}-${index}`}>
                          <span>{opponent.name}</span>
                          <small>{opponent.class}</small>
                        </li>
                      ))}
                    </ul>
                    <div className="encounter-sprites" aria-label="Sprites dos oponentes">
                      {opponents.map((opponent, index) => (
                        <Sprite
                          key={`${opponent.id}-${index}`}
                          id={opponent.id}
                          name={opponent.name}
                          folder={enemies.some((enemy) => enemy.id === opponent.id) ? "enemies" : "characters"}
                        />
                      ))}
                    </div>
                  </div>
                  <button className="primary encounter-start" type="button" onClick={() => startBattle(encounter)}>
                    Iniciar encontro
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {screen === "combat" && battle && (
        <CombatScreen
          battle={battle}
          encounterTitle={currentEncounterTitle}
          applyAction={applyPlayerAction}
          onExit={exitCombat}
          musicVolume={musicVolume}
          setMusicVolume={setMusicVolume}
        />
      )}
    </main>
  );
}

function CombatScreen({
  battle,
  encounterTitle,
  applyAction,
  onExit,
  musicVolume,
  setMusicVolume,
}: {
  battle: BattleState;
  encounterTitle: string;
  applyAction: (abilityId: string | null, targetId?: string) => void;
  onExit: () => void;
  musicVolume: number;
  setMusicVolume: (volume: number) => void;
}) {
  const active = battle.combatants.find((combatant) => combatant.id === battle.activeId);
  const enemiesInBattle = battle.combatants.filter((combatant) => combatant.side === "b");
  const allies = battle.combatants.filter((combatant) => combatant.side === "a");
  const [pendingTargetAbilityId, setPendingTargetAbilityId] = useState<string | null>(null);
  const pendingTargetAbility = active?.abilities.find((ability) => ability.id === pendingTargetAbilityId);
  const pendingAttack = active?.pendingAttack;
  const pendingTargets = pendingTargetAbility && active
    ? battle.combatants.filter((combatant) => {
      if (!combatant.alive || combatant.hp <= 0) return false;
      if (!pendingTargetAbility.canTargetHidden && combatant.effects.some((effect) => effect.kind === "hidden")) return false;
      if (pendingTargetAbility.target === "enemy" && combatant.side === active.side) return false;
      if (pendingTargetAbility.target === "ally" && combatant.side !== active.side) return false;
      if (pendingTargetAbility.target === "any" && !combatant.alive) return false;
      if (pendingTargetAbility.targetMustHaveClass
        && combatant.combatClass !== pendingTargetAbility.targetMustHaveClass) return false;
      return true;
    }).filter((combatant, _index, candidates) => {
      if (pendingTargetAbility.target !== "enemy" || pendingTargetAbility.ignoreThreat) return true;
      const threatened = candidates.some((candidate) =>
        candidate.side !== active.side && candidate.effects.some((effect) => effect.kind === "threat"),
      );
      return !threatened || combatant.effects.some((effect) => effect.kind === "threat");
    })
      .filter((combatant) => !pendingTargetAbility.targetMustHaveEffect
        || combatant.effects.some((effect) => effect.kind === pendingTargetAbility.targetMustHaveEffect))
    : [];
  const turnForecast = previewNextTurns(battle, 7);
  const activeCharacter = active ? findCharacterRecord(active.id) : undefined;
  const activePassives = activeCharacter?.abilities.filter((ability) => ability.kind === "passive") ?? [];
  const copiedPassives = active?.borrowedPassives
    .map(findAbilityRecord)
    .filter((ability) => ability?.kind === "passive") ?? [];
  const pendingAttackTarget = pendingAttack
    ? battle.combatants.find((combatant) => combatant.id === pendingAttack.targetId)
    : undefined;
  const pendingAbilities = activeCharacter?.abilities.filter(
    (ability) => ability.kind === "active" && toCombatAbility(ability) === null,
  ) ?? [];
  const proofVisible = battle.combatants.some((combatant) => combatant.alive && combatant.usesProof);
  const eventLog = battle.events
    .map((event) => describeBattleEvent(event, battle))
    .filter(Boolean)
    .slice(-20)
    .reverse();
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const processedEvents = useRef(0);
  const proofAudioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const firstNewEventIndex = processedEvents.current;
    const newEvents = battle.events.slice(firstNewEventIndex);
    processedEvents.current = battle.events.length;
    if (newEvents.some((event) => event.type === "proof-increased") && typeof window.AudioContext === "function") {
      const context = proofAudioContext.current ?? new window.AudioContext();
      proofAudioContext.current = context;
      const ringBell = () => {
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.setValueAtTime(660, now + 0.18);
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
        oscillator.connect(volume);
        volume.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.8);
      };
      if (context.state === "suspended") {
        void context.resume().then(ringBell).catch((error: unknown) => {
          console.error("Could not resume the proof-counter bell audio.", error);
        });
      } else {
        ringBell();
      }
    }

    const numbers = newEvents.flatMap((event, index): FloatingNumber[] => {
      const eventIndex = firstNewEventIndex + index;
      const amount = Number(event.amount ?? 0);
      if (amount <= 0) return [];

      if (event.type === "damage") {
        const attacker = battle.combatants.find((combatant) => combatant.id === event.attackerId);
        const ability = attacker?.abilities.find((candidate) => candidate.id === event.abilityId);
        const damagePower = event.power ?? ability?.power;
        return [{
          id: `damage-${eventIndex}`,
          text: String(Math.round(amount)),
          kind: damagePower === "imaginary" ? "imaginary" : "physical",
          critical: Boolean(event.critical),
          targetId: String(event.targetId ?? ""),
        }];
      }
      if (event.type === "healed") {
        return [{
          id: `heal-${eventIndex}`,
          text: `+${Math.round(amount)}`,
          kind: "heal",
          critical: false,
          targetId: String(event.targetId ?? ""),
        }];
      }
      return [];
    });

    if (numbers.length > 0) setFloatingNumbers((current) => [...current, ...numbers]);
  }, [battle]);

  useEffect(() => () => {
    const context = proofAudioContext.current;
    if (context && context.state !== "closed") {
      void context.close().catch((error: unknown) => {
        console.error("Could not close the proof-counter audio context.", error);
      });
    }
  }, []);

  function displayFloatingNumber(numberId: string) {
    setFloatingNumbers((current) => current.filter((number) => number.id !== numberId));
  }

  function renderFloatingNumbers(combatantId: string) {
    const targetNumbers = floatingNumbers.filter((number) => number.targetId === combatantId);
    if (targetNumbers.length === 0) return null;
    return (
      <div className="fighter-floating-numbers" aria-live="polite">
        {targetNumbers.map((number) => (
          <span
            className={`floating-number ${number.kind}${number.critical ? " critical" : ""}`}
            key={number.id}
            onAnimationEnd={() => displayFloatingNumber(number.id)}
          >
            {number.critical && <small>CRÍTICO</small>}
            {number.text}
          </span>
        ))}
      </div>
    );
  }

  function renderStatuses(combatant: CombatantState) {
    const labels: Record<string, { icon: string; label: string }> = {
      bleed: { icon: "🩸", label: "Sangrando" },
      stun: { icon: "⚡", label: "Atordoado" },
      hidden: { icon: "◌", label: "Escondido" },
      threat: { icon: "❗", label: "Ameaça" },
      guard: { icon: "🛡", label: "Protegido" },
      corrosion: { icon: "🧪", label: "Corrosão" },
      instability: { icon: "⚗", label: "Instabilidade" },
      "serpent-mark": { icon: "🐍", label: "Marca da Serpente" },
      "rules-of-pip": { icon: "📜", label: "Inventando regras" },
      camouflage: { icon: "🌫", label: "Camuflado" },
      "imagination-defense": { icon: "🛡", label: "Defesa usa Imaginação" },
      "imaginary-barrier": { icon: "✨", label: "Barreira Imaginária" },
      "stun-immunity": { icon: "🎵", label: "Imune a Atordoamento" },
      "ability-seal": { icon: "🚫", label: "Habilidade bloqueada" },
      malediction: { icon: "☠", label: "Maldição" },
      cooperation: { icon: "🤝", label: "Cooperação" },
      "grand-band": { icon: "🎼", label: "Uma banda grandiosa" },
    };
    const statuses: Array<{ key: string; text: string; title?: string }> = [];
    const statEffects = new Map<string, {
      stat: StatName;
      amount: number;
      percentage: boolean;
      sources: Set<string>;
      durations: Set<string>;
    }>();
    const shownKinds = new Set<string>();
    for (const effect of combatant.effects) {
      const marker = labels[effect.kind];
      if (marker) {
        if (shownKinds.has(effect.kind)) continue;
        shownKinds.add(effect.kind);
        const detail = effect.kind === "corrosion"
          ? ` ${effect.amount ?? -10} DEF`
          : effect.kind === "bleed"
            ? (effect.amount ?? 0) >= 5
              ? " (Severo)"
              : (effect.amount ?? 0) >= 3
                ? " (Grave)"
                : ""
            : effect.kind === "camouflage"
              ? ` -${effect.amount ?? 35}% Precisão`
              : effect.kind === "imaginary-barrier"
                ? ` ${effect.amount ?? 20}%`
                : effect.kind === "ability-seal"
                  ? `: ${combatant.abilities.find((ability) => ability.id === effect.abilityId)?.name ?? "próxima ação"}`
                      : effect.kind === "malediction"
                        ? ` (+${Math.round(effect.amount ?? 10)} Sangramento)`
                        : effect.kind === "cooperation" || effect.kind === "grand-band"
                          ? ` ${Math.round(effect.amount ?? 0)}`
                  : "";
        const source = effect.sourceId ? findAbilityRecord(effect.sourceId) : undefined;
        statuses.push({
          key: effect.kind,
          text: `${marker.icon} ${marker.label}${detail}`,
          title: source?.description,
        });
        continue;
      }
      if (effect.kind === "stat" && effect.stat) {
        const key = `${effect.stat}:${effect.percentage ? "percent" : "flat"}`;
        const group = statEffects.get(key);
        const duration = effect.turnsLeft !== undefined
          ? `${effect.turnsLeft} turnos`
          : effect.roundsLeft !== undefined
            ? `${effect.roundsLeft} rodadas`
            : "permanente";
        if (group) {
          group.amount += effect.amount ?? 0;
          if (effect.sourceId) group.sources.add(effect.sourceId);
          group.durations.add(duration);
        } else {
          statEffects.set(key, {
            stat: effect.stat,
            amount: effect.amount ?? 0,
            percentage: effect.percentage ?? false,
            sources: new Set(effect.sourceId ? [effect.sourceId] : []),
            durations: new Set([duration]),
          });
        }
      }
    }
    if (combatant.passives.includes("sono-eterno")) {
      statuses.push({
        key: "sono-eterno",
        text: "💤 IA · Imune a Atordoamento",
        title: findAbilityRecord("sono-eterno")?.description,
      });
    }
    for (const [key, effect] of statEffects) {
      const statName = combatStats.find((statEntry) => statEntry.key === effect.stat)?.label ?? effect.stat;
      const details = [
        ...[...effect.sources].map((sourceId) => {
          const source = findAbilityRecord(sourceId);
          return source ? `${source.name}: ${source.description}` : sourceId;
        }),
        `Duração: ${[...effect.durations].join(", ")}`,
      ];
      statuses.push({
        key,
        text: `${Math.round(effect.amount) > 0 ? "+" : ""}${Math.round(effect.amount)}${effect.percentage ? "%" : ""} ${statName}`,
        title: details.join("\n"),
      });
    }
    if (statuses.length === 0) return null;
    return (
      <div className="fighter-statuses" aria-label={`Efeitos de ${combatant.name}`}>
        {statuses.map((status) => <span key={status.key} title={status.title}>{status.text}</span>)}
      </div>
    );
  }

  return (
    <section className="combat-screen">
      <header className="combat-header">
        <button className="back" type="button" onClick={onExit}>← Equipe</button>
        <div>
          <p className="eyebrow">Batalha de teste · Rodada {battle.round}</p>
          <h1>{battle.phase === "ended" ? "Combate encerrado" : encounterTitle}</h1>
        </div>
        <label className="music-volume">
          <span>Volume da música</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVolume}
            onChange={(event) => setMusicVolume(Number(event.target.value))}
          />
        </label>
      </header>

      {battle.phase !== "ended" && (
        <section className="turn-forecast-section" aria-label="Previsão da ordem dos turnos">
          <div className="turn-forecast" role="list">
            {turnForecast.map((entry, index) => {
              const combatant = battle.combatants.find((candidate) => candidate.id === entry.combatantId);
              if (!combatant) return null;
              const boundaryLabel = entry.roundBoundaryBefore ? " · início da próxima rodada" : "";
              return (
                <div
                  className={`turn-forecast-card${index === 0 ? " next-action" : ""}${entry.roundBoundaryBefore ? " round-boundary" : ""}`}
                  key={`${entry.round}-${index}-${entry.combatantId}`}
                  role="listitem"
                  aria-label={`${index + 1}: ${combatant.name}, rodada ${entry.round}${boundaryLabel}`}
                  title={`${combatant.name} · Rodada ${entry.round}${boundaryLabel}`}
                >
                  <Sprite
                    id={combatant.spriteId}
                    name={combatant.name}
                    folder={combatant.spriteFolder ?? (combatant.side === "b" ? "enemies" : "characters")}
                  />
                  <span>{combatant.name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="battlefield">
        {proofVisible && (
          <div className="proof-counter" aria-live="polite" title="Contador compartilhado de Prova por rodada">
            <span>PROVA</span>
            <strong key={battle.proof}>{battle.proof}</strong>
          </div>
        )}
        {battle.fieldEffects.map((effect) => (
          <div className="battle-field-effects" key={effect.kind} title={effect.description}>
            <strong>Sala da brincadeira</strong>
            <span>{effect.roundsLeft} rodadas restantes · Passe o mouse para ver os detalhes</span>
          </div>
        ))}
        <div className="combat-side enemies">
          {enemiesInBattle.map((enemy) => (
            <div className="fighter-anchor" key={enemy.id}>
              {renderFloatingNumbers(enemy.id)}
              <div className={`fighter${enemy.effects.some((effect) => effect.kind === "hidden") ? " hidden" : ""}`}>
                <Sprite
                  id={enemy.spriteId}
                  name={enemy.name}
                  folder={enemy.spriteFolder ?? (enemy.side === "b" ? "enemies" : "characters")}
                />
                <strong>{enemy.name}</strong>
                <div className="hp-bar"><span style={{ width: `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%` }} /></div>
                <small>{displayHp(enemy.hp)}/{displayHp(enemy.maxHp)} HP</small>
                {renderStatuses(enemy)}
              </div>
            </div>
          ))}
        </div>

        <div className="combat-side allies">
          {allies.map((ally) => (
            <div className="fighter-anchor" key={ally.id}>
              {renderFloatingNumbers(ally.id)}
              <div className={`fighter${battle.activeId === ally.id ? " active" : ""}${ally.effects.some((effect) => effect.kind === "hidden") ? " hidden" : ""}`}>
                <Sprite
                  id={ally.spriteId}
                  name={ally.name}
                  folder={ally.spriteFolder ?? (ally.side === "b" ? "enemies" : "characters")}
                />
                <strong>{ally.name}</strong>
                <div className="hp-bar ally"><span style={{ width: `${Math.max(0, ally.hp / ally.maxHp * 100)}%` }} /></div>
                <small>{displayHp(ally.hp)}/{displayHp(ally.maxHp)} HP · {ally.pa} PA</small>
                {renderStatuses(ally)}
                {ally.passives.includes("setup-laboratorio") && (
                  <div className="fighter-resource">🧪 Frascos Extras {ally.extraFlasks}/3</div>
                )}
                <div className="combat-stats" aria-label={`Status de ${ally.name}`}>
                  {combatStats.map(({ key, label, percent }) => {
                    const base = ally.base[key];
                    const fieldBonus = key === "imagination"
                      && battle.fieldEffects.some((effect) => effect.kind === "sala-brincadeira")
                      ? 10
                      : 0;
                    const modifier = stat(ally, key) + fieldBonus - base;
                    return (
                      <span key={key} title={label}>
                        <small>{label}</small>
                        <b>{displayCombatStat(base, modifier, percent)}</b>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <details className="battle-event-log">
        <summary>Histórico de eventos ({eventLog.length})</summary>
        {eventLog.length > 0
          ? <ol>{eventLog.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol>
          : <p>A batalha ainda não gerou eventos.</p>}
      </details>

      <footer className="action-bar">
        {battle.phase === "ended" ? (
          <div className="result">
            <strong>{battle.winner === "a" ? "Vitória" : battle.winner === "b" ? "Derrota" : "Empate"}</strong>
            <button className="primary" type="button" onClick={onExit}>Voltar à equipe</button>
          </div>
        ) : (
          <>
            {active && (
              <div className="active-character">
                <span>Turno atual</span>
                <strong>{active.name}</strong>
              </div>
            )}
            {active?.side === "a"
              && !active.passives.includes("sono-eterno")
              && !active.passives.includes("sono-eterno-chefe") ? (
              <>
                {pendingAttack ? (
                  pendingAttackTarget?.alive
                    && !pendingAttackTarget.effects.some((effect) => effect.kind === "hidden") ? (
                      <button
                        type="button"
                        onClick={() => applyAction(pendingAttack.abilityId, pendingAttack.targetId)}
                      >
                        Atacar {pendingAttackTarget.name} (ataque preparado)
                      </button>
                    ) : (
                      <>
                        <span>O alvo do ataque preparado não pode mais ser atingido.</span>
                        <button type="button" onClick={() => applyAction(null)}>Cancelar ataque preparado</button>
                      </>
                    )
                ) : !pendingTargetAbility && active.abilities.map((ability) => {
                  const belowHealthThreshold = ability.useBelowHealthFraction === undefined
                    || active.hp / active.maxHp < ability.useBelowHealthFraction;
                  const hasTarget = ability.target === "enemy" || ability.target === "ally" || ability.target === "any";
                  const source = activeCharacter?.abilities.find((entry) => entry.id === ability.id);
                  return (
                    <button
                      key={ability.id}
                      type="button"
                      disabled={!belowHealthThreshold}
                      title={source?.description}
                      onClick={() => {
                        if (hasTarget) setPendingTargetAbilityId(ability.id);
                        else applyAction(ability.id, ability.target === "self" ? active.id : undefined);
                      }}
                    >
                      {ability.name}
                      <small>{ability.cost ?? 10} PA</small>
                    </button>
                  );
                })}
                {pendingTargetAbility && (
                  <div className="target-picker" role="group" aria-label={`Escolha o alvo para ${pendingTargetAbility.name}`}>
                    <strong>Escolha o alvo: {pendingTargetAbility.name}</strong>
                    {pendingTargets.map((combatant) => (
                      <button
                        key={combatant.id}
                        type="button"
                        onClick={() => {
                          applyAction(pendingTargetAbility.id, combatant.id);
                          setPendingTargetAbilityId(null);
                        }}
                      >
                        {combatant.name}
                      </button>
                    ))}
                    {pendingTargets.length === 0 && <span>Nenhum alvo válido disponível.</span>}
                    <button type="button" onClick={() => setPendingTargetAbilityId(null)}>Cancelar</button>
                  </div>
                )}
                {!pendingTargetAbility && <button type="button" onClick={() => applyAction(null)}>Passar turno</button>}
                {active.passives.includes("setup-laboratorio") && (
                  <p className="flask-guidance" aria-live="polite">
                    Frascos extras: {active.extraFlasks}. Se a PA não cobrir o custo, uma ação gasta 1 frasco; passar preserva os frascos.
                  </p>
                )}
                {pendingAbilities.length > 0 && (
                  <p className="pending-abilities">
                    Habilidades ainda sem regra de combate: {pendingAbilities.map((ability) => ability.name).join(", ")}.
                  </p>
                )}
              </>
            ) : null}
            {(activePassives.length > 0 || copiedPassives.length > 0) && (
              <div className="active-passives" aria-label={`Passivas de ${active?.name}`}>
                <strong>Passivas</strong>
                <ul>
                  {activePassives.map((passive) => (
                    <li key={passive.id}>
                      <b>{passive.name}:</b> {passive.description}
                    </li>
                  ))}
                  {copiedPassives.map((passive) => (
                    <li key={`copied-${passive!.id}`}>
                      <b>Copiada — {passive!.name}:</b> {passive!.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </footer>
    </section>
  );
}

export default App;
