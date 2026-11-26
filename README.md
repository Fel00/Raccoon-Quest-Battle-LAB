# Raccoon Quest: Combat Lab

Laboratório de combate do Raccoon Quest. A Fase 1 (auditoria) está concluída e a Fase 2 implementa o núcleo determinístico do motor.

Fonte das regras: [docs/source/RACCOON QUEST.pdf](docs/source/RACCOON%20QUEST.pdf).

| Documento | Conteúdo |
| --- | --- |
| [docs/rule-register.md](docs/rule-register.md) | Regras confirmadas, esclarecimentos e pendências |
| [docs/content-inventory.md](docs/content-inventory.md) | Heróis, equipamentos, inimigos, chefes e cerco |
| [docs/architecture.md](docs/architecture.md) | Arquitetura proposta |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Fases e o que bloqueia a Fase 2 |

As pendências que alteram o núcleo do motor foram respondidas em 26/11/2026 (R-L02 e R-L11 a R-L23).

Estado atual:

- Fase 2 concluída: motor determinístico para PA, fila, ações, dano, crítico, cura, efeitos nucleares, nocaute e registro de eventos.
- Fase 3 iniciada: catálogo editável de personagens, equipamentos, consumíveis, oponentes e ascensões.
- Fase 4 concluída: regras de montagem de equipes, status finais e modelo editável em memória.
- Fase 5 implementada: menu de modos, montagem de equipe e combate PvE jogável local.
- Orientação e template de sprites em [docs/sprite-guide.md](docs/sprite-guide.md).
- IA avançada, Siege jogável, banco e PvP: ainda não implementados.
- No Windows, dê dois cliques em [Start Raccoon Quest.bat](Start%20Raccoon%20Quest.bat) para iniciar o servidor e abrir o navegador. Mantenha a janela do terminal aberta enquanto joga; pressione Ctrl+C para encerrar.
- Executar testes: `npm test`.
- Verificar os pacotes TypeScript: `npm run typecheck`.
- Compilar e iniciar a interface: `npm run build` e `npm run dev`.
