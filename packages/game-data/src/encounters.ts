import type { BattleEncounter } from "./types.js";

export const battleEncounters: BattleEncounter[] = [
  {
    id: "trilha-dos-catadores",
    title: "Trilha dos Catadores",
    difficulty: "Iniciante",
    description: "Uma patrulha comum da floresta, boa para aprender o ritmo do combate.",
    opponentIds: ["esquilo-coletor", "passaro-imitador", "rato-madeira", "joaninha-encouracada"],
  },
  {
    id: "sombras-no-dossel",
    title: "Sombras no Dossel",
    difficulty: "Moderado",
    description: "Escondido, sangramento e magia se combinam entre os habitantes da copa.",
    opponentIds: ["coruja-sabia", "morcego-vampiro", "morcego-vampiro", "sapo-peculiar"],
  },
  {
    id: "matilha-sanguinaria",
    title: "Matilha Sanguinária",
    difficulty: "Avançado",
    description: "Predadores que pressionam alvos feridos com mordidas e sangramento.",
    opponentIds: ["lobo-cinzento", "morcego-vampiro", "morcego-vampiro", "cao-raivoso"],
  },
  {
    id: "madeireira-patriarca",
    title: "O Patriarca da Madeireira",
    difficulty: "Chefe",
    description: "O líder dos castores luta ao lado de operários e pode chamar reforços.",
    opponentIds: ["castor-patriarca", "castor-serrador", "castor-engenheiro"],
  },
  {
    id: "submundo-do-rei-rato",
    title: "O Submundo do Rei Rato",
    difficulty: "Chefe",
    description: "O Rei Rato é protegido por guardas e apoiado por batedores.",
    opponentIds: ["rei-rato", "rato-guarda-costas", "rato-guarda-costas", "rato-batedor", "rato-capanga"],
  },
  {
    id: "reproducao-no-celeiro",
    title: "Reprodução no Celeiro",
    difficulty: "Avançado",
    description: "O Rato de Celeiro pode chamar mais ratos enquanto os aliados pressionam a equipe.",
    opponentIds: ["rato-celeiro", "rato-celeiro", "gamba-nebuloso", "coelho-instavel", "porco-obeso"],
  },
  {
    id: "rebanho-do-profeta",
    title: "O Rebanho do Profeta",
    difficulty: "Extremo",
    description: "Um culto inteiro sustenta seu profeta com cura, provações e pressão constante.",
    opponentIds: ["falso-profeta", "devoto-cabra", "devoto-cabra", "fanatico-colheita", "acolita-leite"],
  },
  {
    id: "sono-da-besta",
    title: "O Sono da Besta",
    difficulty: "Extremo",
    description: "A Besta persegue alvos sangrando enquanto morcegos tentam abri-los.",
    opponentIds: ["besta-chefe", "morcego-vampiro", "morcego-vampiro"],
  },
];
