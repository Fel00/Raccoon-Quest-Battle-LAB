# Registro de regras — Raccoon Quest: Combat Lab

Fonte única desta auditoria: `docs/source/RACCOON QUEST.pdf` (49 páginas, extraído integralmente em 26/11/2026).

Este registro começou como a auditoria da Fase 1. A implementação do combate agora é incremental; as regras abaixo continuam sendo a referência, não um sinal de que todo o conteúdo está pronto.

Cada entrada tem um identificador estável (`R-###`) para o motor citar a origem depois. Classificações exigidas pelo projeto:

- **CONFIRMADA PELO GDD** — o texto do PDF sustenta a regra.
- **ESCLARECIDA PELO USUÁRIO** — a especificação do Combat Lab fixa a interpretação ou acrescenta uma regra de laboratório.
- **PENDENTE DE ESCLARECIMENTO** — contradição, lacuna ou mais de uma leitura possível. Não implementar como regra oficial.
- **HIPÓTESE PROVISÓRIA APROVADA PARA TESTES** — vazia de propósito. Nenhuma hipótese foi aprovada ainda. As leituras propostas estão em PENDENTE, à espera de decisão.

## Estado da implementação

O motor já implementa regras fundamentais de turno, dano, sangramento, atordoamento, ameaça, Escondido, Corrosão, Instabilidade e Prova. A equipe padrão e os quatro oponentes de teste têm habilidades ativas conectadas. As três habilidades ativas base da Serpente também estão conectadas, incluindo Marca, Beijo de Judas em aliado ou inimigo e Condenação.

Isso ainda não cobre todo o catálogo de personagens, passivas, armas ou chefes. Habilidades sem regra executável continuam listadas como pendentes na interface; não são tratadas como habilidades funcionais. Regras pendentes neste registro, incluindo P-12, P-15, P-21 e P-25, não devem ser completadas por suposição.

---

## ESCLARECIDA PELO USUÁRIO

Regras do laboratório que não estão no GDD, ou que a especificação do projeto fixa por cima de uma leitura ambígua. Continuam sujeitas a correção se o usuário discordar do registro.

| ID | Regra | Origem |
| --- | --- | --- |
| R-L01 | O primeiro slot da equipe é obrigatoriamente uma variação de Pip. Os outros três são companheiros. | Especificação do Combat Lab, seção 5. O GDD só exige que um dos quatro seja uma variação de Pip, sem fixar o slot. |
| R-L02 | Crítico é rolado por golpe. O combate não usa o dano médio esperado. A fórmula impressa no GDD é a esperança matemática dos dois ramos (acerto normal respeita defesa; crítico ignora defesa e não multiplica o dano). | Especificação, seção 8, confirmada pelo usuário em 26/11/2026 (P-01). |
| R-L03 | PvP online mostra ao jogador os status finais e os equipamentos da própria equipe. Do oponente, apenas vida máxima e vida atual. | Especificação, seção 6.1. |
| R-L04 | Consumíveis existem no catálogo, mas o menu de uso só aparece no PvE solo. Nos outros modos o menu fica desabilitado. A carga inicial é curta e definida pelo desafio, não um inventário livre. | Especificação, seção 6.2. |
| R-L05 | Siege é exclusivamente solo na primeira versão. Sem Siege cooperativo. | Especificação, seção 6.4. |
| R-L06 | O motor é determinístico dada a mesma configuração e a mesma semente. | Especificação, seção 2.2. |
| R-L07 | Não há DLC nesta versão. O PDF não contém uma seção de DLC; todo o conteúdo auditado entra como jogo base. | Especificação, seções 1.3 e 4. |
| R-L08 | Desconexão em PvP fica atrás de uma política substituível. A política em si não foi escolhida. | Especificação, seção 11. Ver P-17. |
| R-L09 | O modo local usa o mesmo motor do modo online. A relação entre perfil local e perfil online não foi escolhida. | Especificação, seção 12. Ver P-18. |
| R-L10 | Dados de status, habilidades e descrições ficam em arquivos editáveis, fora do código do motor. | Especificação, seção 4. |
| R-L11 | Quando a habilidade ou a arma escreve um custo de PA, esse número substitui os 10 PA da ação. Aprisionar Passos gasta 5. Trovão gasta 15. Sala da brincadeira gasta 20. Habilidade sem custo escrito gasta 10. Continua valendo o limiar: só entra na fila quem tem 10 PA ou mais, mesmo que a ação escolhida custe menos de 10. | Usuário, 26/11/2026 (P-02), junto com R-018 e R-021. |
| R-L12 | Turno e rodada são unidades diferentes. Turno é uma ação daquele personagem. Rodada é o ciclo em que todos recebem PA. | Usuário, 26/11/2026 (P-03). De quem é o turno que reduz uma duração escrita como “N turnos” continua em P-03a. |
| R-L13 | Na fila, o personagem da vez age de novo na hora, pagando o custo de cada ação, até a reserva ficar abaixo de 10 PA. Só então o próximo age. A fila não é reordenada no meio dessa sequência. | Usuário, 26/11/2026 (P-04). |
| R-L14 | A ficha final soma o bloco da variação (ou do companheiro), os números do chapéu e os números da arma. No Pip, o chapéu também escolhe a variação antes dessa soma. | Usuário, 26/11/2026 (P-10). |
| R-L15 | Duração escrita em turnos (“por 2 turnos”, “por três turnos”, “por um turno”) cai quando o personagem que carrega o efeito age. | Usuário, 26/11/2026 (P-03a). |
| R-L16 | O dano de sangramento ocorre depois da ação de quem está sangrando. Atordoamento conta como essa ação pulada, então o sangramento ocorre. Se a pessoa não age porque tem menos de 10 PA, não há dano de sangramento naquela rodada. | Usuário, 26/11/2026 (P-05), junto com R-026 e R-028. |
| R-L17 | O PA usa a Velocidade final, sem teto 5 e sem piso 1. Modificador, chapéu e ficha de inimigo entram direto na conta Velocidade + 4. | Usuário, 26/11/2026 (P-06). |
| R-L18 | A precisão que falta para 100% é a chance de errar. No erro o dano é 0 e não se aplica efeito que o GDD manda aplicar depois do dano. Penalidades de precisão somam. O valor usado fica entre 0% e 100%, salvo habilidade que não pode errar ou cuja precisão não pode ser reduzida (R-L21). | Usuário, 26/11/2026 (P-07 e P-07a). |
| R-L19 | Bônus de taxa crítica soma na taxa do personagem. Bola de fogo, com 10% de base e bônus de 15%, tem 25% naquela habilidade. O mesmo vale para os outros bônus escritos dessa forma. | Usuário, 26/11/2026 (P-09). |
| R-L20 | Defesa usada no dano: somam-se os pontos, aplicam-se as reduções percentuais, e o resultado positivo fica limitado a 90%. Defesa negativa continua aumentando o dano em 0,5% por ponto. Crítico ignora esse resultado por completo. | Usuário, 26/11/2026 (P-26), junto com R-010, R-011 e R-015. |
| R-L21 | Penalidades de precisão no mesmo personagem somam. O resultado usado na rolagem de erro fica entre 0% e 100%. Habilidade que “não pode errar” ou cuja precisão “não pode ser reduzida” segue o texto dela, não este limite. | Usuário, 26/11/2026 (P-07a). |
| R-L22 | Cura remove sangramento com 30% + 1 ponto percentual por ponto de taxa crítica + 1 ponto percentual por ponto de velocidade do curador. Taxa 10% conta como 10. Velocidade 4 conta como 4. O exemplo dá 44%. A chance não passa de 100%. | Usuário, 26/11/2026 (P-08), junto com R-027. |
| R-L23 | Vida 0 tira a pessoa na hora: sai da fila e deixa de ganhar PA, sangramento e atordoamento. Louise com Rígido e o portador da Coroa de Fast-Food seguem as exceções escritas. Invocação conta para a derrota do lado dela. Sinergia de classe só conta quem está em pé. O lado sem ninguém em pé perde. A Prova do Falso Profeta continua como vitória especial. | Usuário, 26/11/2026 (P-23). |

---

## CONFIRMADA PELO GDD

### Estrutura da batalha

| ID | Regra | Onde |
| --- | --- | --- |
| R-001 | Antes do combate o jogador escolhe quatro heróis, um deles obrigatoriamente uma variação de Pip. | p. 1 |
| R-002 | Batalhas em turnos. A ordem depende da velocidade. Os heróis usam os turnos em conjunto. | p. 1 |
| R-003 | Em um turno o herói faz uma de três ações: usar habilidade, consumir item ou passar o turno. | p. 1 |
| R-004 | Passar o turno não tem efeito próprio, pode disparar passivas ou ativas, e consome os PA daquele turno. | p. 1 |
| R-005 | Cada herói tem três habilidades ativas e de zero a duas passivas. A arma pode conceder mais uma habilidade, ativa ou passiva. | p. 1 e p. 3. Exceção documentada: O Rei Rato jogável tem duas ativas (p. 10). |
| R-006 | Itens do inventário do grupo são consumidos após o uso. Consumível custa o turno do herói. | p. 1 e p. 17 |

### Atributos

| ID | Regra | Onde |
| --- | --- | --- |
| R-007 | Atributos: Vida, Ataque, Imaginação, Defesa, Velocidade, Precisão, Taxa Crítica. | p. 1 |
| R-008 | Vida é o total de pontos de vida do personagem. | p. 1 |
| R-009 | Ataque determina o dano dos golpes físicos. Imaginação determina o dano dos golpes imaginários. | p. 1 |
| R-010 | Cada ponto de Defesa reduz o dano recebido em 1%, com máximo de 90%. | p. 1 |
| R-011 | Defesa negativa: cada ponto aumenta o dano recebido em 0,5%. | p. 1 |
| R-012 | Velocidade determina a ordem na fila e entra no ganho de PA. A escala 1 a 5 descreve a base usual dos heróis. O valor usado na conta não tem teto nem piso (R-L17). | p. 1–2 e R-L17. |
| R-013 | Precisão padrão dos heróis: 100%. A diferença até 100% é a chance de errar. Erro causa 0 de dano e não aplica efeito posterior ao dano (R-L18). | p. 1 e R-L18. |
| R-014 | Taxa crítica padrão dos heróis: 10%. | p. 1 |
| R-015 | Golpe crítico ignora a defesa do oponente e não possui multiplicador de dano. | p. 1 |

### Pontos de ação

| ID | Regra | Onde |
| --- | --- | --- |
| R-016 | Todo herói começa a batalha com 0 PA. | p. 1 |
| R-017 | No início de cada rodada, todos somam Velocidade + 4 à reserva de PA. | p. 1 |
| R-018 | Entram na fila de turnos os personagens com 10 ou mais PA. | p. 1 |
| R-019 | Ao agir (habilidade ou item), o herói consome 10 PA. | p. 2 |
| R-020 | Quem não chega a 10 PA não age naquela rodada e conserva o PA acumulado. | p. 2 |
| R-021 | Habilidade com custo acima de 10 pode ser usada com apenas 10 PA. A reserva fica negativa pela diferença que faltava. Exemplo do GDD: custo 15 com 11 PA resulta em −4. O custo escrito substitui os 10, inclusive quando é menor (R-L11). | p. 2 e p. 5 (Sala da brincadeira, 20 PA) e p. 7 (Trovão, 15 PA). Custos abaixo de 10: R-L11. |
| R-022 | Desempate de PA: maior Velocidade base; se persistir, a equipe com maior soma de Velocidade; se persistir, 50% para cada lado. | p. 2 |
| R-023 | Velocidade alta pode produzir mais de um turno na mesma rodada ou em rodadas seguidas. Velocidade baixa exige várias rodadas para agir. Quem está agindo esgota a reserva até ficar abaixo de 10 antes do próximo (R-L13). | p. 2 e R-L13. |

### Efeitos nucleares

Aplicação por habilidades e passivas ocorre sempre após o dano (p. 2).

| ID | Regra | Onde |
| --- | --- | --- |
| R-024 | Ameaça: os oponentes são obrigados a atacar esse herói. Se houver mais de um, o oponente escolhe entre eles. Ataque em área ignora ameaça. | p. 2 |
| R-025 | Escondido: não pode ser alvo e ignora ataque em área. Termina quando o portador usa uma habilidade. Não pode ser adquirido em duas rodadas seguidas. Não impede efeitos e passivas de atingirem o usuário. | p. 2 |
| R-026 | Sangramento: perda de 5% da vida depois da ação de quem está sangrando. Atordoamento conta como essa ação. Falta de PA não provoca o dano (R-L16). | p. 2 e R-L16. |
| R-027 | Cura pode remover sangramento. A chance é 30% mais a taxa crítica e a velocidade do curador, em pontos, com teto de 100% (R-L22). | p. 2 e R-L22. |
| R-028 | Atordoado: o herói pula o próximo turno e perde os PA necessários para essa ação. | p. 2 |

### Dano

| ID | Regra | Onde |
| --- | --- | --- |
| R-029 | Fórmula impressa: `(Ataque ou Imaginação) × Multiplicador × (1 − Defesa%) × (1 − TaxaCrítica) + (Ataque ou Imaginação) × Multiplicador × TaxaCrítica`. | p. 2 |
| R-030 | O primeiro ramo é o acerto normal (defesa aplica). O segundo ramo é o crítico (defesa não aplica, multiplicador de crítico não existe). A partida rola um crítico por golpe (R-L02). A fórmula impressa não é aplicada como número único. | p. 1–2 e R-L02 |

### Equipe, classe e equipamento

| ID | Regra | Onde |
| --- | --- | --- |
| R-031 | Herói tem raça, classe, três ativas (salvo a exceção do Rei Rato) e de zero a duas passivas. | p. 3 |
| R-032 | Imaginação fértil: a classe, as habilidades e os status de Pip mudam conforme o chapéu. Sem chapéu, ou com chapéu que não corresponda a uma fantasia, Pip volta à variação Adventure. | p. 3–6, em todas as variações |
| R-033 | Competição por domínio: no máximo um herói da classe Demônio na equipe. Presente em A Besta, O Falso Profeta e A Serpente. | p. 15–16 |
| R-034 | Todo herói carrega dois itens de equipamento: um chapéu e uma arma. | p. 17 |
| R-035 | Arma pode aumentar Ataque e/ou Imaginação e traz uma quarta ativa ou uma passiva bônus. | p. 17 |
| R-036 | Chapéu pode aumentar Vida, Defesa ou Velocidade. No Pip, o chapéu determina a variação. | p. 17 e p. 20–25 |
| R-037 | Várias armas e chapéus têm restrição de classe. A restrição está no item, não é uma regra global de “qualquer um equipa qualquer coisa”. | p. 17–25 |
| R-038 | Armas e chapéus do Tier 4 (míticos de cerco) são banidos do PvP. | p. 19 e p. 23 |
| R-039 | A passiva Ação imediata de Dazy é desativada no PvP. É a única passiva que o GDD desliga explicitamente nesse modo. | p. 8 |

### Passivas que não podem ser copiadas nem removidas

| ID | Regra | Onde |
| --- | --- | --- |
| R-040 | Tentar remover ou copiar O sono eterno, Profecia Inevitável ou Enganadora falha, e o herói que tentou passa o turno. | p. 15–16 e fichas de chefe |

### Cerco

| ID | Regra | Onde |
| --- | --- | --- |
| R-041 | Cerco enfrenta chefes de novo. Cada ascensão acumula bônus. O jogador pode escolher uma dificuldade anterior. | p. 46 |
| R-042 | Ascensão 13 libera um modo extremamente difícil e recompensas especiais. | p. 46 |
| R-043 | Chefes de cerco documentados: O Castor Patriarca, A Besta, O Rei Rato, A Serpente, O Falso Profeta. Cada um tem ascensões 1 a 13 e recompensas. | p. 46–49 |
| R-044 | Versões jogáveis desbloqueadas por cerco: A Besta (ascensão 4), O Falso Profeta (ascensão 4), A Serpente (ascensão 5). O Rei Rato jogável já existe na lista de companheiros; o cerco dele não entrega uma segunda ficha jogável, entrega chapéu e visual. | p. 14–16 e p. 47–49 |

### Condição especial de vitória

| ID | Regra | Onde |
| --- | --- | --- |
| R-045 | O Falso Profeta ganha 1 acúmulo de Prova no início de cada rodada. Em 13 acúmulos, todos os adversários são derrotados no início do próximo turno dele. Qualquer herói que caia em campo remove 2 acúmulos. | p. 15 e p. 46. O alcance de “qualquer herói” está em P-12. |

---

## PENDENTE DE ESCLARECIMENTO

Não implementar nenhuma destas leituras como regra oficial até resposta.

### P-01 — Fórmula impressa versus rolagem

Resolvida em 26/11/2026. Ver R-L02 e R-030. A partida rola o crítico por golpe.

### P-02 — Custo de PA menor que 10

Resolvida em 26/11/2026. Ver R-L11. O custo escrito substitui os 10. O limiar para entrar na fila continua em 10 PA.

### P-03 — Turno e rodada

Resolvida em parte em 26/11/2026. Ver R-L12. Turno é a ação daquele personagem. Rodada é o ciclo de ganho de PA.

### P-03a — Quem perde a duração “por N turnos”

Resolvida em 26/11/2026. Ver R-L15. A duração cai quando age o personagem que carrega o efeito.

### P-04 — Vários turnos na mesma rodada

Resolvida em 26/11/2026. Ver R-L13. O personagem da vez esgota as ações até ficar com menos de 10 PA. O próximo só age depois disso. A ordenação inicial da fila continua sendo a de R-022: maior reserva de PA, depois Velocidade base, depois soma de Velocidade da equipe, depois 50%.

### P-05 — Sangramento se o personagem não age

Resolvida em 26/11/2026. Ver R-L16. Atordoamento conta como a ação pulada e o sangramento ocorre. Reserva abaixo de 10 PA não provoca sangramento.

### P-06 — Velocidade fora da escala 1 a 5

Resolvida em 26/11/2026. Ver R-L17. A conta de PA usa a Velocidade final, sem teto e sem piso.

### P-07 — Erro de precisão

Resolvida em 26/11/2026 quanto ao resultado do erro. Ver R-L18. Precisão 80% erra em 20% dos golpes. O erro causa 0 de dano e não aplica efeito que depende do dano.

### P-07a — Soma e limite da precisão

Resolvida em 26/11/2026. Ver R-L21. As penalidades somam e o resultado usado fica entre 0% e 100%. O padrão de precisão e crítico dos inimigos continua em P-21.

### P-08 — Chance de limpar sangramento

Resolvida em 26/11/2026. Ver R-L22. Somam-se taxa crítica e velocidade, em pontos, sobre os 30%. Teto de 100%.

### P-09 — Bônus de crítico é soma ou valor absoluto

Resolvida em 26/11/2026. Ver R-L19. O bônus soma na taxa do personagem.

### P-10 — Status de Pip e números do chapéu

Resolvida em 26/11/2026. Ver R-L14. Somam-se o bloco da variação, os números do chapéu e os números da arma. O chapéu escolhe a variação antes da soma.

### P-11 — Herói repetido na mesma equipe

O GDD não diz se Chirp, por exemplo, pode ocupar dois slots. Também não diz se duas cópias do mesmo companheiro contam duas vezes para sinergias (bardos, aventureiros, ladinos, demônio).

### P-12 — Quem remove acúmulos de Prova

“Qualquer herói que caia em campo irá remover 2 acúmulos.” Pode ser qualquer combatente, só um herói do jogador, ou só um aliado do Falso Profeta.

### P-13 — Unidades sem ficha de velocidade

A barricada do Castor Patriarca tem 400 de vida, 0 de defesa e ameaça, sem ataque, velocidade ou PA. O Espírito da Floresta (Elmo do Rei Castor) tem 100 de vida e ataca uma vez. Não está dito se essas unidades entram na fila de PA, se bloqueiam o fim da batalha, nem quando o espírito some.

O Rato Capanga invocado pela Capa do Submundo usa “status igual ao inimigo da cidade”. A ficha Rato Capanga existe (p. 35). Falta dizer se a cópia invocada inclui as habilidades e a passiva.

### P-14 — Habilidades introduzidas só no cerco, ou que repetem o valor base

- Ascensão 9 da Besta: “Rugido Primordial” causa sangramento permanente. Essa habilidade não existe na ficha da Besta.
- Ascensão 10 da Serpente: o dano de O Beijo de Judas “aumenta para 3,5x”. A ficha base já é 3,5x.
- Ascensão 13 da Besta: o sangramento dura “um segundo”. O combate não tem relógio em segundos.

### P-15 — Textos de dano que não fecham

| Trecho | Problema |
| --- | --- |
| Sequência de golpes sérios (Pip Trash Knight) | O dano imaginário sai da soma de imaginação e ataque. Não há multiplicador. |
| Avanço Rápido (Toby) | “Dano físico baseado em 10x velocidade.” Pode ser dano fixo igual a 10 × velocidade, ou ataque × 10 × velocidade. |
| Sistema de defesa (Sophie) | “0,5 de dano físico”, sem o “x” usado no resto do documento. Pode ser 0,5 × ataque ou 0,5 de dano fixo. |
| Estilhaços de Casca (Henrietta) | “1x de dano imaginário baixo.” O “baixo” não tem número. |
| Mãe Furiosa (Henrietta) | Dispara com aliado em “Vida Baixa”. O limiar não existe. Camuflar, de Leonard, usa 30% da vida máxima para outra regra. Não está dito que seja o mesmo limiar. |
| Garras / golpes com vários acertos | O GDD não define uma regra geral de múltiplos golpes. Chute Duplo e nomes parecidos são um único acerto com um multiplicador. |

### P-16 — Efeito no alvo adjacente

O Pedaço de Pizza Fria cura o alvo e os aliados adjacentes na ordem de turnos. A Investida do Porco Obeso também atinge o aliado adjacente ao alvo. Não há grade nem posição. A única ordem do GDD é a fila de PA, que muda durante a batalha.

### P-17 — Desconexão no PvP

A especificação deixa em aberto: pausar para reconexão, a IA assumir, ou encerrar após um tempo. A arquitetura deve isolar a política. A política não será escolhida na implementação sem resposta.

### P-18 — Perfil local e perfil online

A especificação deixa em aberto: local totalmente independente, sincronizado com o perfil online, ou independente com sincronização opcional. O motor não será duplicado. O adaptador de persistência espera a decisão.

### P-19 — PvE cooperativo (Fase 10 da especificação)

A seção 6 descreve três modos: PvP, PvE solo e Siege. A Fase 10 pede dois jogadores controlando dois personagens cada. O GDD não descreve combate cooperativo. Falta decidir se a Fase 10 permanece e, se permanecer, como se divide o PA, a fila e a derrota.

### P-20 — Visão de status e o chapéu de óculos

R-L03 esconde PA, defesa e atributos do oponente no PvP online. O chapéu Óculos de Natação Riscados “destrava a tela de análise tática” e mostra HP, PA e Defesa numéricos dos inimigos. Não está dito se isso vale no PvP, só no PvE, ou se fura a regra de visibilidade.

### P-21 — Inimigos sem precisão e crítico na ficha

Nenhuma ficha de oponente lista Precisão ou Taxa Crítica. Heróis têm 100% e 10%. Usar os mesmos padrões nos oponentes é uma suposição, não uma frase do GDD.

### P-22 — Composição dos encontros

O PDF lista fichas, não grupos de batalha (quantos esquilos, qual a ordem dos capítulos jogáveis, quantos consumíveis cada desafio dá). Os desafios do laboratório terão de ser definidos à parte. Não serão inventados como se fossem do GDD.

### P-23 — Morte, incapacitação e fim da batalha

Resolvida em 26/11/2026. Ver R-L23. Vida 0 remove na hora, com as exceções de Rígido e da Coroa de Fast-Food. Nocauteado sai da fila e não recebe PA, sangramento nem atordoamento. Invocação conta para a derrota do lado dela. Sinergia só conta quem está em pé. Lado sem ninguém em pé perde, fora a Prova.

### P-24 — Esquiva não é um atributo

Precisão está na ficha. “Esquiva” aparece em itens e inimigos (Lenço de Pescoço, Instinto Felino, Planar, Dançinha reduz precisão e não se chama esquiva). Não há fórmula única de esquiva. Cada menção terá de ser uma regra do próprio efeito, depois que P-07 for fechada, ou uma lista de efeitos sem fórmula comum.

### P-25 — Sinergias cujo texto não fixa o alvo

- Uma banda grandiosa, com três bardos: um aliado aleatório recupera 3 PA “e se tornam imunes a atordoamento”. Não está dito se a imunidade é da equipe, dos bardos ou do aliado sorteado.
- Mestre das ruas: o Rei Rato usa as ativas de “todos os ladinos na batalha”. Pode incluir ladinos inimigos.
- Devagar e sempre (Oliver): os degraus sobem “caso qualquer aliado passe o turno” e caem “caso Oliver não passe o seu”. As duas frases não descrevem o mesmo gatilho.
- Ação imediata (Dazy): um item sem encerrar o turno, uma vez por turno. Não está dito se o item ainda consome 10 PA.
- Frascos extras (Skunk): uma ação extra mesmo com 0 PA. Não está dito se essa ação deixa PA negativo ou se o frasco substitui o custo.
- Aquele que jaz nas sombras (Hazard): no próximo turno “causará 3x de dano físico”. Pode ser um ataque automático ou um modificador da próxima habilidade ofensiva. A ficha de chefe usa 2x, não 3x.
- Roubo de táticas: Pip passa a ter as passivas do alvo até usar a habilidade de novo. Não está dito o que acontece se o alvo sair de campo, nem se as passivas de R-040 disparam a falha de R-040.
- Corpo Amaldiçoado (Oswaldo): a habilidade usada contra ele fica desativada “no próximo turno”. Pode ser o próximo turno do atacante ou a próxima rodada inteira.
- Sala da brincadeira: “todos os ataques da batalha” passam a ser imaginários. Falta saber se contra-ataques, reflexos e dano de passiva também mudam. O efeito acaba se “qualquer participante” cair.

### P-26 — Defesa percentual contra defesa em pontos

Resolvida em 26/11/2026. Ver R-L20. Pontos primeiro, redução percentual depois, teto de 90% só no resultado positivo, crítico ignora o resultado.

### P-27 — Versões jogável e chefe não compartilham os números

Isto não é erro de leitura: o PDF tem dois blocos. O laboratório precisa das duas fichas, separadas.

| Personagem | Jogável | Chefe |
| --- | --- | --- |
| Hazard | 600 vida, 40 ataque, 20 imaginação, 40 defesa, 4 velocidade. Sombra causa 3x. Garras sangram por dois turnos. Perseguidor é 1,5x. | 800 vida, 35 ataque, mesmos 20 / 40 / 4. Sombra causa 2x. Garras sangram por três turnos. Perseguidor é 1x. |
| Rei Rato | 30 ataque, 40 defesa. Sem as passivas de chefe. | 40 ataque, 30 defesa. Liderança Sombria e Morte do Submundo. |
| A Besta | 30 defesa, 2 velocidade. | 50 defesa, 3 velocidade. |
| A Serpente | 500 vida, 20 defesa. | 800 vida, 50 defesa. |
| Falso Profeta | Igual ao chefe de fazenda na ficha base. | Ascensões alteram a luta, não a ficha base. |

### P-28 — Catálogo de consumíveis contra o corte da seção 6.2

A seção 4 manda cadastrar os consumíveis. A seção 6.2 diz que não é obrigatório colocar todos na versão atual, porque só o PvE os usa. Os 18 estão no PDF. Falta decidir se o arquivo de dados nasce completo e o PvE usa um subconjunto por desafio, ou se alguns ficam de fora do primeiro catálogo.

### P-29 — Modo local de PvP

A seção 6.1 descreve PvP com salas e código de convite. A seção 12, modo local, lista PvE, Siege, desafios, simulações e relatórios. Não lista dois jogadores no mesmo computador. Falta dizer se hotseat existe.

---

## HIPÓTESE PROVISÓRIA APROVADA PARA TESTES

Nenhuma.

As leituras sugeridas dentro de P-01 a P-29 não estão aprovadas. A Fase 2 não começa até as pendências que mudam o motor receber resposta. As que podem esperar estão marcadas no plano de implementação.
