import type { AbilityDef, EffectDef } from "@raccoon/combat-engine";
import type { CatalogAbility } from "@raccoon/game-data";

type AbilityTarget = AbilityDef["target"];

const explicitAbilities: Record<string, Partial<AbilityDef> | null> = {
  "arranhao-explorador": {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    selfEffects: [{ kind: "hidden", chance: 0.3, turns: 1 }],
  },
  emboscada: {
    target: "enemy",
    power: "imaginary",
    multiplier: 1,
    conditionalMultiplier: { actorEffect: "hidden", amount: 0.5 },
  },
  "explosao-instavel": {
    target: "enemy",
    power: "imaginary",
    multiplier: 3,
    critBonus: 40,
    onCriticalSelfEffects: [{ kind: "stat", stat: "imagination", amount: 30, turns: 2 }],
    onNonCriticalSelfEffects: [{ kind: "stun", turns: 1 }],
  },
  "mochila-suprimentos": {
    target: "ally",
    effects: [
      { kind: "stat", stat: "attack", amount: 10, turns: 2 },
      { kind: "stat", stat: "defense", amount: 10, turns: 2 },
      { kind: "stat", stat: "imagination", amount: 10, turns: 2 },
    ],
  },
  "sala-brincadeira": {
    target: "none",
    fieldEffect: {
      kind: "sala-brincadeira",
      rounds: 2,
      description: "Todos os ataques passam a ser imaginários e usam Imaginação. Todos os participantes recebem +10 de Imaginação; o efeito termina se alguém cair.",
    },
  },
  "sequencia-golpes": {
    target: "enemy",
    power: "imaginary",
    multiplier: 1,
    combineAttackAndImagination: true,
    selfEffects: [{ kind: "stat", stat: "attack", amount: -10 }],
  },
  "alta-protecao": {
    target: "self",
    selfEffects: [{ kind: "imagination-defense", turns: 1 }],
  },
  "roubo-taticas": { target: "any", copyTargetPassives: true },
  "melodia-criativa": {
    target: "allies",
    effects: [{ kind: "stat", stat: "imagination", amount: 10, turns: 2 }],
  },
  "mudanca-ritmo": {
    target: "enemies",
    targetSpeedGreaterThanActor: true,
    effects: [{ kind: "stat", stat: "speed", amount: -1, turns: 2 }],
  },
  "bico-rapido": { target: "enemy", power: "physical", multiplier: 1 },
  "melodia-acao": { target: "ally", gainPA: 7 },
  "melodia-graca": { target: "ally", heal: { stat: "speed", multiplier: 10 } },
  "machadada": {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    precisionDelta: -40,
    selfEffects: [{ kind: "guard", turns: 1 }],
  },
  "golpe-perigoso": {
    target: "enemy",
    power: "physical",
    multiplier: 2,
    selfDamageFraction: 0.1,
  },
  "grito-guerra": { target: "self", effects: [{ kind: "threat", turns: 3 }] },
  "frasco-solvente": {
    target: "enemy",
    power: "imaginary",
    multiplier: 0.5,
    effects: [{ kind: "corrosion", turns: 2 }],
  },
  "catalisador-instavel": { target: "enemy", effects: [{ kind: "instability", turns: 3 }] },
  "reacao-explosiva": {
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
  "fruto-tentacao": {
    target: "any",
    effects: [
      { kind: "serpent-mark" },
      { kind: "stat", stat: "attack", amount: 20 },
      { kind: "stat", stat: "imagination", amount: 20 },
    ],
  },
  "beijo-judas": {
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
  },
  condenacao: {
    target: "enemies",
    power: "imaginary",
    multiplier: 0.5,
    condemnation: true,
  },
  "meditacao-harold": {
    target: "self",
    selfEffects: [{ kind: "stat", stat: "critRate", amount: 50, turns: 1 }],
  },
  camuflar: {
    target: "self",
    camouflage: { amount: 35, turns: 3, alliesBelowHealthFraction: 0.3 },
  },
  estocada: {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    selfEffects: [{ kind: "stat", stat: "attack", amount: 10 }],
  },
  "golpe-surdina": {
    target: "enemy",
    power: "physical",
    multiplier: 2,
    selfEffects: [{ kind: "stat", stat: "attack", amount: -20 }],
  },
  "sombra-hazard": {
    target: "enemy",
    prepareNextAttackMultiplier: 3,
    selfEffects: [{ kind: "hidden", turns: 1 }],
  },
  casco: {
    target: "self",
    selfEffects: [{ kind: "hidden", turns: 1 }],
    healFractionOfMaxHp: 0.35,
  },
  "ir-com-tudo": {
    target: "enemy",
    power: "physical",
    multiplier: 2,
    selfEffects: [{ kind: "stun", turns: 1 }],
  },
  "dormir-sophie": {
    target: "self",
    selfEffects: [{ kind: "stun", turns: 2 }],
    stunnedTurnHealingFractions: [0, 0.25],
  },
  "dormir-rei-rato": {
    target: "self",
    selfEffects: [{ kind: "stun", turns: 2 }],
    stunnedTurnHealingFractions: [0, 0.3],
  },
  "barreira-magica": {
    target: "allies",
    effects: [{ kind: "imaginary-barrier", amount: 20, turns: 4 }],
  },
  "bomba-fumaca": {
    target: "ally",
    targetMustHaveClass: "Ladino",
    effects: [{ kind: "hidden", turns: 1 }],
  },
  "fuga-tatica": {
    target: "self",
    passTurn: true,
    selfEffects: [{ kind: "stat", stat: "critRate", amount: 100, turns: 1 }],
  },
  "explosao-espinhos": {
    target: "enemies",
    cost: 15,
    power: "imaginary",
    multiplier: 0.2,
    effects: [{ kind: "bleed", chance: 0.2, turns: 3 }],
  },
  "latido-motivacional": {
    target: "ally",
    effects: [{ kind: "stat", stat: "speed", amount: 3, turns: 2 }],
  },
  "avanco-rapido": {
    target: "enemy",
    power: "physical",
    powerStat: "speed",
    multiplier: 10,
  },
  "aura-inspiracao": {
    target: "allies",
    selfDamageFraction: 0.1,
    effects: [{ kind: "stat", stat: "critRate", amount: 30, turns: 2 }],
  },
  "hino-protecao": { target: "allies", heal: { stat: "imagination", multiplier: 1 } },
  ronco: {
    target: "enemies",
    effects: [{ kind: "stat", stat: "attack", amount: -10, percentage: true, turns: 4 }],
  },
  "ronco-chefe": {
    target: "enemies",
    effects: [{ kind: "stat", stat: "attack", amount: -10, percentage: true, turns: 4 }],
  },
  "garra-fera": {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    critBonus: 50,
    conditionalMultiplier: { targetEffect: "bleed", amount: 1 },
  },
  "garra-fera-chefe": {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    conditionalMultiplier: { targetEffect: "bleed", amount: 1 },
  },
  abocanhar: {
    target: "enemy",
    power: "physical",
    multiplier: 3,
    cannotMissTargetEffect: "bleed",
  },
  "abocanhar-chefe": {
    target: "enemy",
    power: "physical",
    multiplier: 1,
    conditionalMultiplier: { targetEffect: "bleed", amount: 2 },
  },
  "barreira-destino": {
    target: "self",
    selfEffects: [{ kind: "stat", stat: "defense", amount: 20, turns: 2 }],
  },
  maldicao: {
    target: "enemy",
    effects: [
      { kind: "malediction", amount: 10, rounds: 4 },
      { kind: "stat", stat: "attack", amount: -10, rounds: 4 },
      { kind: "stat", stat: "precision", amount: -20, percentage: true, rounds: 4 },
    ],
  },
  farejar: {
    target: "enemy",
    canTargetHidden: true,
    targetMustHaveEffect: "hidden",
    removeTargetEffect: "hidden",
  },
  casca: { target: "enemy", power: "physical", multiplier: 0.8 },
  "rapido-esquivo": { target: "self", effects: [{ kind: "stat", stat: "defense", amount: 20, turns: 1 }] },
  "fruta-curadora": { target: "self", heal: { flat: 30 }, useBelowHealthFraction: 0.5 },
  "chamar-reforcos": { target: "none" },
  "barricada-troncos": { target: "none" },
  "reproducao-acelerada": { target: "none" },
  imitar: { target: "enemy", copyLastAbility: true },
  "bicada-passaro": { target: "enemy", power: "physical", multiplier: 1 },
  roida: {
    target: "enemy",
    power: "physical",
    multiplier: 0.5,
    effects: [{ kind: "bleed", chance: 0.2 }],
  },
  "morder-rato": { target: "enemy", power: "physical", multiplier: 1 },
  "bola-brilhante": { target: "enemy", power: "imaginary", multiplier: 1 },
  encolher: { target: "self", effects: [{ kind: "stat", stat: "defense", amount: 20, rounds: 2 }] },
};

const statNames: Array<[RegExp, EffectDef["stat"]]> = [
  [/imagina(?:ç|c)[aã]o/i, "imagination"],
  [/defesa/i, "defense"],
  [/ataque/i, "attack"],
  [/velocidade/i, "speed"],
  [/precis[aã]o/i, "precision"],
  [/taxa cr[ií]tica/i, "critRate"],
];

function descriptionEffects(description: string): EffectDef[] {
  const effects: EffectDef[] = [];
  const bleed = description.match(/(?:(\d+)%[^.]*chance[^.]*?)?(?:causa|aplica)[^.]*sangramento[^.]*?(\d+)\s+turnos?/i);
  if (bleed) effects.push({
    kind: "bleed",
    chance: bleed[1] ? Number(bleed[1]) / 100 : undefined,
    turns: Number(bleed[2]),
  });
  const stunChance = description.match(/(\d+)%[^.]*atordoad/i);
  if (stunChance) effects.push({ kind: "stun", chance: Number(stunChance[1]) / 100, turns: 1 });
  else if (/atordoa|atordoado/i.test(description)) effects.push({ kind: "stun", turns: 1 });
  if (/ameaça/i.test(description) && !/ignora[^.]*ameaça/i.test(description)) {
    const duration = description.match(/ameaça[^.]*?(\d+)\s+turnos?/i);
    effects.push({ kind: "threat", turns: duration ? Number(duration[1]) : undefined });
  }
  if (/escondid[oa]/i.test(description)) {
    const duration = description.match(/escondid[oa][^.]*?(\d+)\s+turnos?/i);
    effects.push({ kind: "hidden", turns: duration ? Number(duration[1]) : undefined });
  }
  return effects;
}

function inferredTarget(description: string, hasDamage: boolean): AbilityTarget {
  if (/todos os oponentes|em área|em todos os/i.test(description)) return "enemies";
  if (/toda a equipe|todos os aliados/i.test(description)) return "allies";
  if (/cura|curad[oa]/i.test(description) || /aliado|parceiro/i.test(description)) return "ally";
  if (/si mesmo|própri[oa]|se torna|ganha.*(?:defesa|ameaça|escondid[oa])/i.test(description)) return "self";
  return hasDamage ? "enemy" : "none";
}

export function toCombatAbility(source: CatalogAbility): AbilityDef | null {
  if (source.kind !== "active" || source.unresolved?.length) return null;
  const explicit = explicitAbilities[source.id];
  if (explicit === null) return null;
  if (explicit) {
    return { id: source.id, name: source.name, cost: source.paCost, target: "none", ...explicit };
  }

  const description = source.description;
  const damage = description.match(/(\d+(?:[.,]\d+)?)x(?:\s+de)?\s*(?:dano\s*)?(físico|imaginário)/i);
  const healMultiplier = description.match(/(?:cura|curad[oa])[^.]*?(\d+(?:[.,]\d+)?)\s*(?:vezes|x)\s*(?:a|sua)?\s*(imaginação|defesa|ataque|velocidade)/i);
  const healFlat = description.match(/(?:cura|curad[oa])[^.]*?(\d+)\s+(?:de\s+)?vida/i);
  const statAdjustment = description.match(/([+-]\d+)\s*(%)?\s*(?:de\s+)?(ataque|imaginação|defesa|velocidade|precisão|taxa crítica)/i);
  const duration = description.match(/(\d+)\s+(turnos?|rodadas?)/i);
  const effect: EffectDef | undefined = statAdjustment
    ? {
      kind: "stat",
      stat: statNames.find(([pattern]) => pattern.test(statAdjustment[3]))?.[1],
      amount: Number(statAdjustment[1]),
      ...(duration?.[2].startsWith("rodada")
        ? { rounds: Number(duration[1]) }
        : duration ? { turns: Number(duration[1]) } : {}),
    }
    : undefined;
  const hasDamage = Boolean(damage);
  const definition: AbilityDef = {
    id: source.id,
    name: source.name,
    cost: source.paCost,
    target: inferredTarget(description, hasDamage),
    power: damage ? (/imaginário/i.test(damage[2]) ? "imaginary" : "physical") : undefined,
    multiplier: damage ? Number(damage[1].replace(",", ".")) : undefined,
    precisionDelta: /precis[aã]o[^.]*reduzida em (\d+)%/i.exec(description)
      ? -Number(/precis[aã]o[^.]*reduzida em (\d+)%/i.exec(description)?.[1])
      : /precis[aã]o[^.]*\-(\d+)%/i.exec(description)
        ? -Number(/precis[aã]o[^.]*\-(\d+)%/i.exec(description)?.[1])
        : undefined,
    critBonus: /b[oô]nus de (\d+)%[^.]*taxa cr[ií]tica/i.exec(description)
      ? Number(/b[oô]nus de (\d+)%[^.]*taxa cr[ií]tica/i.exec(description)?.[1])
      : undefined,
    cannotMiss: /n[aã]o pode errar/i.test(description),
    precisionCannotBeReduced: /precis[aã]o[^.]*n[aã]o pode ser reduzida/i.test(description),
    effects: [
      ...descriptionEffects(description),
      ...(effect?.stat ? [effect] : []),
    ],
    heal: healMultiplier
      ? {
        stat: statNames.find(([pattern]) => pattern.test(healMultiplier[2]))?.[1] as "attack" | "imagination" | "defense" | "speed" | undefined,
        multiplier: Number(healMultiplier[1].replace(",", ".")),
      }
      : healFlat ? { flat: Number(healFlat[1]) } : undefined,
  };
  if (!hasDamage && !definition.heal && !effect?.stat && definition.effects?.length === 0) return null;
  return definition;
}
