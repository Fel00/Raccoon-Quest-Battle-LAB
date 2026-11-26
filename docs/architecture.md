# Arquitetura proposta — Raccoon Quest: Combat Lab

Proposta da Fase 1. Nenhum pacote foi criado. A implementação espera aprovação e as respostas que o plano marca como bloqueio da Fase 2.

## 1. O que o sistema é

Um laboratório de combate por turnos, separado do jogo final. A mesma resolução de regras serve para partida local, partida no servidor e simulação. A interface não calcula dano, cura, crítico, custo de PA nem vitória.

Fora de escopo, de propósito: mapa, plataforma, movimento, combate em tempo real, malha 3D, animação elaborada, física, exploração e DLC.

## 2. Monorepo

```text
raccoon-quest-combat-lab/
├── apps/
│   ├── web/                 React, TypeScript, Vite
│   └── server/              Node.js, Colyseus, acesso ao banco
├── packages/
│   ├── combat-engine/       regras, estado, eventos, semente
│   ├── game-data/           fichas editáveis e textos
│   ├── game-rules/          validação de equipe, equipamento e modo
│   ├── ai/                  prioridades determinísticas
│   ├── analytics/           agregação do registro de batalha
│   └── shared/              tipos, versões, erros de protocolo
├── tests/
│   ├── combat/
│   ├── characters/
│   ├── equipment/
│   └── multiplayer/
├── docs/
│   ├── source/              RACCOON QUEST.pdf
│   ├── architecture.md
│   ├── rule-register.md
│   ├── content-inventory.md
│   └── implementation-plan.md
└── README.md
```

`docs/database.md` e `docs/balance-tests.md` nascem nas fases 8 e 11, quando houver esquema e suíte de verdade. Criá-los agora descreveria um banco que ainda não foi decidido por completo (P-18).

Ferramentas: npm workspaces, TypeScript, Vitest, PostgreSQL na fase 8. Sem Godot ou Unity.

## 3. Motor de combate

Pacote puro. Não importa React, banco, rede nem relógio do sistema. O acaso entra só pela semente recebida no início da batalha.

Entradas: versão dos dados, versão das regras, versão do motor, semente, modo (pvp, pve, siege), equipes, carga de consumíveis, ascensão, e a lista de ações. Saídas: estado sucessivo e um registro ordenado de eventos.

O registro guarda o bastante para repetir a partida e para o Balance Lab: quem agiu, alvo, habilidade, rolagem, dano, cura, PA antes e depois, efeitos aplicados e removidos, nocaute, vitória.

Políticas ainda abertas ficam atrás de interface, não de `if` espalhado:

- ordem de vários turnos na mesma rodada (P-04);
- relógio de duração, turno ou rodada (P-03);
- desconexão (P-17), implementada no servidor, não no motor.

O motor não escolhe essas políticas. Quem inicia a batalha passa a política. Enquanto não houver resposta, a Fase 2 não fixa uma delas.

Fórmulas e efeitos citam o identificador do `rule-register.md` no teste que os cobre. Dado numérico de personagem não mora no motor: o motor recebe a definição já resolvida por `game-data`.

## 4. Dados editáveis

Um diretório de fichas, em JSON ou TypeScript só de dados, separado das funções. É o arquivo que o usuário edita para balancear status, custos, multiplicadores, durações, textos de habilidade e descrições.

Cada ficha carrega:

- identificador estável;
- origem (página do GDD ou identificador de regra);
- números;
- descrição curta, editável;
- efeitos como dados (tipo de dano, multiplicador, alvo, custo de PA, duração, chance), não como código solto por personagem.

Personagens com comportamento que o dado não consegue expressar (Profecia Inevitável, Condenação, O sono eterno, ascensões) usam um identificador de comportamento implementado no motor, com os números ainda na ficha. O identificador não esconde os números dentro do código.

Há duas fichas quando o PDF tem dois blocos: Hazard, Rei Rato, Besta, Serpente e Falso Profeta (P-27).

Validação automática, na suíte:

- habilidade apontando para efeito inexistente;
- arma ou chapéu apontando para classe inexistente;
- variação de Pip apontando para chapéu que não a habilita;
- inimigo de ascensão apontando para unidade que não está no catálogo;
- campo numérico obrigatório vazio.

Esses testes falham o build. Não corrigem o dado inventando valor.

Proporções de arte, para quando a interface precisar de arquivo e o desenho ainda não existir. São recomendação de produção, não regra do GDD:

| Uso | Proporção | Tamanho de trabalho |
| --- | --- | --- |
| Retrato no combate e na seleção | 1:1 | 256×256 |
| Ícone de arma, chapéu e consumível | 1:1 | 128×128 |
| Ícone de efeito | 1:1 | 32×32 |

Fundo transparente, PNG. O personagem ocupa a maior parte do quadro, com margem segura de cerca de 8% para não cortar na moldura circular. Na Fase 4, se não houver desenho, entra um PNG plano com o nome, mais uma nota ao lado do arquivo dizendo para substituir sem mudar a proporção. Isso não substitui status nem texto.

## 5. Regras de equipe

`game-rules` responde se uma equipe pode entrar naquele modo. O web e o servidor chamam o mesmo pacote. Equipe ilegal não inicia partida.

Confirmado para a primeira versão da validação:

- quatro membros;
- slot 1 é uma variação de Pip (R-L01);
- no máximo um Demônio;
- chapéu e arma respeitam a classe, depois que o chapéu de Pip já trocou a variação;
- Tier 4 recusado no PvP;
- Ação imediata não entra no conjunto de passivas do PvP.

Duplicata do mesmo companheiro espera P-11. Até lá o validador não inventa a proibição nem a permissão: a montagem pode exibir “restrição não decidida” e a partida não começa com esse caso.

## 6. Interface

React. Telas: menu, modo, montagem, combate, lobby, histórico, relatório, Balance Lab.

Combate mostra aliados, adversários, vida, PA, atributos que o modo permite, efeitos, equipamentos que o modo permite, habilidades, custo, alvos válidos, histórico e o resultado.

No PvP online o cliente recebe do servidor um estado já filtrado: o oponente só expõe vida atual e vida máxima (R-L03). O chapéu de óculos fica inerte nesse filtro até P-20.

Consumíveis: controle visível no PvE; desabilitado nos outros modos (R-L04).

## 7. Servidor

Colyseus é autoritativo. O cliente manda intenção (habilidade, alvo, item, passar, prontidão). O servidor confere turno, dono do personagem, legalidade, PA e identificador do comando, e só então chama o motor.

Sala privada com código de convite. O código da sala não é a credencial do perfil.

Fluxo: criar sala, entrar, lobby, equipe, pronto, batalha, fim, revanche. Reconexão existe como evento de sessão. O que a partida faz com a ausência fica na política de P-17, trocável sem reescrever a sala.

O servidor rejeita ação fora do turno, habilidade inválida, PA incompatível com a regra vigente, comando de personagem alheio, estado paralelo vindo do cliente, comando repetido e entrada sem convite.

## 8. Persistência

PostgreSQL, acessado só pelo servidor. Credencial em variável de ambiente, fora do Git.

Previsto para a Fase 8, não desenhado como migração ainda:

- perfil anônimo e apelido;
- credencial privada com hash no banco e segredo só no dispositivo;
- código de backup de uso único ou rotacionável;
- equipes salvas;
- partida: semente, versões, configuração, resultado;
- eventos de combate;
- estatística agregada;
- progresso de Siege;
- desafio personalizado;
- versão de regras usada na partida.

O navegador guarda a credencial em armazenamento local do dispositivo e avisa que perdê-la, sem o backup, perde o perfil. Não há login social.

Três modos de persistência local continuam possíveis sem segundo motor: arquivo no servidor local, banco local, ou ausência de banco com exportação manual. A escolha é P-18.

## 9. IA

Pacote `ai`. Não chama modelo generativo. Dada a mesma semente e o mesmo estado, escolhe a mesma ação.

Entrada: estado visível segundo as regras daquele controlador, e um perfil de prioridades (inimigo comum, chefe, Besta sem controle do jogador, equipe adversária de simulação). A saída é uma intenção no mesmo formato que o jogador enviaria. O motor continua sendo quem resolve.

A Besta jogável e a Besta chefe usam a prioridade escrita no GDD: ataque de dano em quem está sangrando e com menos vida, respeito a ameaça, e o pulo de turno enquanto a ascensão ou o chapéu não o removerem.

## 10. Balance Lab

Depois da batalha, o registro de eventos alimenta agregados: vitória e derrota, personagem, composição, dano causado, dano recebido, cura, mitigação, uso de habilidade, uso de consumível, efeitos, duração, oponente.

Exportação CSV e JSON do histórico, das estatísticas e do resultado de simulação. Toda partida exportável inclui semente, versão do motor, versão dos dados e versão das regras.

Simulação em lote reutiliza motor e IA. O texto da especificação pulou o item 10.2; a Fase 11 e a seção 7 ainda pedem simulação. O runner entra na Fase 11, sem um painel extra que a especificação não descreveu.

## 11. Ambientes

Desenvolvimento e produção separados por variáveis: URL do servidor, origem permitida no CORS, WebSocket seguro em produção, string do banco, segredo de sessão.

Alvo de hospedagem, quando a Fase 12 chegar: Vercel para o web, Railway para o Node com Colyseus, PostgreSQL no Supabase gratuito ou no próprio Railway. O backend não depende de GitHub Pages. O guia de deploy nasce na Fase 12, com migração, logs, monitoramento e backup. Segredos não entram no repositório.

## 12. Testes

Vitest. Cada regra promovida de PENDENTE para confirmada ganha teste de regressão no mesmo passo que a implementação. A suíte cobre fórmula, PA, crítico por golpe, efeitos, habilidades, passivas, equipamento, equipe, inimigos, chefes, vitória, Siege, protocolo do multiplayer e persistência, na fase em que cada um passar a existir.

O projeto só avança de fase com a suíte da fase atual passando e o conjunto ainda compilando.
