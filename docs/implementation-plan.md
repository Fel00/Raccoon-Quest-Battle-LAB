# Plano de implementação

A Fase 1 está concluída como auditoria. Nenhuma fase seguinte começa sem aprovação. Dentro de cada fase futura o ciclo é o mesmo: dizer o que será construído, de quais regras depende, o que ainda está ambíguo, implementar, testar, corrigir, e atualizar este plano e o registro de regras.

## Bloqueios antes da Fase 2

Estas pendências mudam o núcleo. Sem resposta, o motor teria de escolher uma leitura e apresentá-la como regra.

Respondidas em 26/11/2026: P-01, P-02, P-03, P-03a, P-04, P-05, P-06, P-07, P-07a, P-08, P-09, P-10, P-23 e P-26. Registro: R-L02 e R-L11 a R-L23.

Nenhuma pendência restante bloqueia o núcleo do motor. A Fase 2 ainda espera autorização explícita para começar o código. P-11 em diante continuam fora do motor mínimo e não serão preenchidas com suposição.

Podem esperar até a fase indicada, desde que o código não finja que já foram decididas:

| ID | Pode esperar até |
| --- | --- |
| P-11 | Fase 4, montagem de equipe. |
| P-12, P-13, P-14, P-25 | Fase 3, ao cadastrar a ficha, e de novo na fase que a coloca em combate. |
| P-15, P-16 | Fase 3 para o texto da ficha; a batalha que usa o efeito espera o número. |
| P-17 | Fase 9. A interface da política nasce junto com a sala, sem política padrão silenciosa. |
| P-18 | Fase 8. |
| P-19 | Antes da Fase 10. Pode ser cancelada. |
| P-20 | Fase 5, visibilidade. Até lá o chapéu não revela o oponente no PvP. |
| P-21 | Fase 6, antes de a IA inimiga rolar crítico ou erro. |
| P-22 | Fase 6. Os desafios são conteúdo do laboratório, escritos à parte, não extraídos do PDF. |
| P-24 | Fase 3, efeito por efeito. Não vira atributo novo. |
| P-27 | Fase 3. As duas fichas entram separadas. Não é decisão de regra, é obrigação de catálogo. |
| P-28 | Fase 3 ou 6. Recomendação: cadastrar os 18 e deixar o desafio escolher a carga. |
| P-29 | Fora das doze fases, a menos que o usuário peça hotseat. |

## Fases

### Fase 1 — Auditoria

Feita. Entregas:

- `docs/source/RACCOON QUEST.pdf`
- `docs/rule-register.md`
- `docs/content-inventory.md`
- `docs/architecture.md`
- `docs/implementation-plan.md`

Não há motor, interface, banco nem teste executável. A pasta ainda não é um aplicativo.

### Fase 2 — Motor

Concluída em 26/11/2026. O núcleo determinístico foi implementado e coberto por testes.

Entregue:

- criação de batalha com semente;
- ganho de PA por velocidade;
- fila inicial e turnos repetidos;
- ações de habilidade, item e passagem;
- custos explícitos e negativos de PA;
- dano físico e imaginário com crítico por golpe;
- defesa positiva limitada e defesa negativa;
- cura e remoção probabilística de sangramento;
- efeitos nucleares no modelo de estado;
- registro de eventos da batalha.
- fim imediato da batalha sem combatentes vivos;
- efeitos de turnos e rodadas;
- validação básica de Escondido e Ameaça;
- exceção única de sobrevivência com 1 HP;
- atordoamento como turno pulado.

Ainda não entra: catálogo completo, React, rede, banco.

Regras usadas: R-002 a R-030, R-L02, R-L06, e as pendências que tiverem sido promovidas.

### Fase 3 — Catálogo

Iniciada em 26/11/2026.

Entregue:

- pacote `packages/game-data`;
- tipos para personagens, equipamentos, consumíveis, inimigos e Cerco;
- 5 variações de Pip;
- 19 companheiros;
- 16 armas;
- 25 chapéus;
- 18 consumíveis;
- 46 fichas de oponente;
- 5 chefes de Cerco com ascensões 1–13;
- validação de IDs duplicados, referências quebradas e dados numéricos inválidos;
- testes de contagem e integridade do catálogo.

Pendências numéricas continuam registradas e não são preenchidas automaticamente.

### Fase 4 — Montagem de equipes

Iniciada em 26/11/2026.

Entregue:

- pacote `packages/game-rules`;
- quatro slots e Pip obrigatório no primeiro;
- cálculo de atributos finais da variação, chapéu e arma;
- regra de máximo um Demônio;
- restrições de classe dos equipamentos;
- banimento de Tier 4 no PvP;
- bloqueio conservador de personagens duplicados até P-11 ser decidido;
- modelo editável de equipe em memória;
- template SVG 256×256 e guia de substituição de sprites.

A Fase 4 ainda não entrega tela React, porque a interface gráfica começa apenas após a montagem e validação da equipe já existirem como pacote puro.

### Fase 5 — Interface inicial e batalha jogável

Implementada em 26/11/2026.

Entregue:

- app React/Vite em `apps/web`;
- seleção inicial entre PvE, PvP e Cerco;
- montagem visual das quatro posições;
- Pip obrigatório no primeiro slot;
- chapéus e armas selecionáveis conforme o catálogo;
- validação visual da equipe antes da batalha;
- grupo de teste mínimo de quatro oponentes;
- combate jogável por ataques físicos, ataques imaginários e passagem;
- barras de Vida, PA atual e indicação do turno ativo;
- resultado de vitória ou derrota;
- template de sprite quadrado usado até os artes finais existirem.

PvP online, IA estratégica, encontros personalizados e Cerco permanecem nas fases seguintes.

Testes: PA inicial 0, ganho Velocidade+4, limiar 10, custo 10, exemplo −4 do GDD, desempate, defesa 90%, defesa negativa, crítico sem multiplicador e ignorando defesa, mesma semente gerando o mesmo registro.

Ainda não entra: catálogo completo, React, rede, banco.

### Fase 3 — Catálogo

Depende do motor aceitar uma definição de habilidade vinda de dado.

Cadastrar as cinco variações de Pip, os dezenove companheiros, as dezesseis armas, os vinte e cinco chapéus, os dezoito consumíveis, as quarenta e seis fichas de oponente, os efeitos nomeados e as ascensões 1–13 dos cinco chefes. Textos e números ficam no arquivo editável. Validadores pegam referência quebrada.

Onde o PDF não tem número (P-15 e afins), a ficha marca o campo como não resolvido e o validador impede aquela habilidade de ser usada em partida. Não se completa com estimativa.

### Fase 4 — Montagem de equipes

Depende do catálogo e de P-11.

Quatro slots, Pip no primeiro, arma, chapéu, atributos finais, habilidades, passivas, restrição de classe, Tier 4 no PvP, um Demônio, equipe ilegal bloqueada. Salvar, duplicar e editar ficam na memória do navegador até a Fase 8.

Retratos: PNG 256×256 quando existirem; até lá, marcador com o nome e a nota de proporção da arquitetura.

### Fase 5 — Batalha jogável

Depende do motor e da equipe válida.

Um jogador controla os quatro aliados contra um grupo de teste mínimo, o bastante para exercitar fila, PA, habilidades e fim de combate. O grupo de teste é rotulado como ferramenta de desenvolvimento, não como encontro do GDD.

Interface compacta da seção 9 da especificação. PvP online ainda não existe; a tela já respeita o filtro de informação para não ser refeita na Fase 9.

### Fase 6 — IA e PvE solo

Depende de P-21 e P-22.

IA por prioridades, testada sem interface. Batalhas solo contra inimigos e chefes do catálogo. A lista de desafios é um arquivo editável, separado das fichas, porque o PDF não define os grupos. Carga curta de consumíveis por desafio. Histórico local simples até o banco existir.

### Fase 7 — Siege

Depende das ascensões cadastradas e das pendências P-12, P-13 e P-14 fechadas para o chefe que for ligado.

Solo. Escolha de chefe e de ascensão já alcançada. Modificadores acumulados. Registro de tentativa, vitória e derrota. Comparação entre equipes. Sem cooperativo.

Recompensa de equipamento passa a poder ser equipada. Recompensa visual fica como identificador, sem modelo.

### Fase 8 — Banco e perfis

Depende de P-18.

PostgreSQL, perfil anônimo, credencial privada, backup, equipes, partidas, eventos, Siege, desafios e versão de regras. O web não recebe string de conexão.

### Fase 9 — PvP

Depende da política P-17 e do filtro R-L03.

Dois jogadores, sala privada, convite, lobby, prontidão, servidor autoritativo, reconexão, revanche, resultado no banco. Passivas e itens que o GDD tira do PvP saem na validação: Tier 4 e Ação imediata. Nenhuma outra passiva é alterada, porque o PDF não altera.

### Fase 10 — PvE cooperativo

Só se P-19 for mantida. O GDD não tem essa modalidade. Se for cancelada, a fase sai do plano sem substituir regra de combate.

### Fase 11 — Balance Lab

Agregados da seção 10 da especificação, exportação CSV e JSON, repetição por semente e versões. Simulação em lote com a IA, sem painel que a especificação não descreveu.

### Fase 12 — Hospedagem

Vercel, Railway, PostgreSQL no Supabase ou no Railway, ambientes separados, CORS, WebSocket seguro, migração, logs, backup e uma partida real de dois jogadores.

## Estado ao fim da Fase 1

Funciona: a leitura do GDD e os quatro documentos de auditoria.

Não funciona: combate, catálogo executável, equipe, IA, Siege, perfil, multiplayer, relatório e hospedagem.

Nada foi removido, porque nada havia sido implementado.
