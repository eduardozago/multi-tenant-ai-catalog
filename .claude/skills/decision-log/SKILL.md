---
name: decision-log
description: Record an architectural or product decision in docs/decisions.md with context, options, choice and trade-offs. Use whenever a design choice is made or changed (library, pattern, data model, security approach, scope cut), including decisions the user states in conversation.
---

# Decision log

Append an entry to `docs/decisions.md`. Number entries sequentially. Write in Portuguese (pt-BR), because the README is in Portuguese. Keep each entry short (about 10 lines). When a decision replaces an earlier one, mark the old entry `Substituída por D-XX` instead of deleting it.

```
## D-XX: <título curto>
- Status: aceita | substituída
- Contexto: <o problema, 1-2 frases>
- Opções: <A>, <B>, <C>
- Decisão: <escolha>
- Motivo: <razões principais>
- Trade-offs: <o que se perde, riscos>
- Em produção: <o que mudaria em escala, se aplicável>
```

The README sections "Decisões arquiteturais" and "O que faria diferente em produção" are assembled from these entries at the end, so write them to be lifted directly.
