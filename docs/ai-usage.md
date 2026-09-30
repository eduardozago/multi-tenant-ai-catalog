# Uso de IA no desenvolvimento

Usei Claude Code como assistente, com configuração versionada no repositório para que o agente siga as mesmas regras que eu seguiria:

- `AGENTS.md` (raiz e por app): stack, comandos, convenções e as invariantes que não podem ser quebradas (isolamento de tenant, auth, segurança do agente). `CLAUDE.md` importa esse arquivo.
- Skills em `.claude/skills/`: procedimentos repetíveis para criar módulos do backend, tools do agente, telas do frontend e registrar decisões.
- Subagents em `.claude/agents/`: revisores somente leitura, um focado em isolamento multi-tenant e outro em arquitetura.
- Hook de formatação com Biome e permissões que bloqueiam leitura de `.env` e `git push`.

O agente acelerou a escrita de código; as decisões de arquitetura estão registradas em `docs/decisions.md` e foram tomadas e revisadas por mim.
