# Registro de decisões

Decisões arquiteturais do projeto, no formato contexto, opções, decisão e trade-offs. Base para as seções do README.

## D-01: Express com TypeScript em vez de NestJS
- Status: aceita
- Contexto: o desafio pede Node.js + Express e avalia separação de responsabilidades e patterns do backend.
- Opções: Express puro, Express + TypeScript em camadas, NestJS.
- Decisão: Express 5 + TypeScript, módulos por feature (routes, controller, service, repository) e composition root com DI manual.
- Motivo: segue o stack pedido e deixa as decisões de arquitetura explícitas no código, em vez de delegadas ao framework.
- Trade-offs: sem DI automática, decorators e guards prontos; o wiring é manual em `container.ts`.

## D-02: Mongoose em vez de Prisma
- Status: aceita
- Contexto: acesso ao MongoDB e necessidade de garantir o filtro de tenant em toda query.
- Opções: Mongoose, Prisma, driver nativo.
- Decisão: Mongoose.
- Motivo: query middleware permite um plugin que falha quando a query não tem `company_id`; text index e aggregate diretos; o conector MongoDB do Prisma exige replica set, o que complica o setup local.
- Trade-offs: tipagem menos forte que a do Prisma; tipos de retorno mapeados à mão no repository.

## D-03: API REST sem tRPC
- Status: aceita
- Contexto: o desafio define endpoints REST (CRUD, `POST /chat`).
- Opções: REST, tRPC, oRPC.
- Decisão: REST.
- Motivo: contrato testável com curl ou Postman, middlewares Express visíveis e streaming SSE simples.
- Trade-offs: sem type safety ponta a ponta; alguns tipos duplicados entre web e server.
- Em produção: contrato OpenAPI com geração de client, ou pacote compartilhado de schemas zod.

## D-04: JWT implementado manualmente em vez de Better Auth
- Status: substituída por D-08 (entrega do token via cookie httpOnly; o restante segue válido)
- Contexto: auth com roles é critério avaliado, e o tenant viaja no token.
- Opções: Better Auth, Clerk, JWT próprio.
- Decisão: JWT HS256 com `{ sub, companyId, role }`, middlewares `authenticate` e `authorize`, bcrypt para senhas.
- Motivo: controle total sobre como o tenant e a role entram no contexto da requisição.
- Trade-offs: sem refresh token, revogação ou recuperação de senha.
- Em produção: access token curto + refresh token rotativo em cookie httpOnly, revogação por lista ou versão de token, rate limit por IP e conta.

## D-05: Isolamento de tenant em três camadas
- Status: aceita
- Contexto: empresa A nunca pode ver dados da empresa B.
- Opções: filtro manual nos controllers, filtro no repository, plugin global do Mongoose, bancos separados por tenant.
- Decisão: tenant vindo só do JWT; repositories com `companyId` obrigatório; plugin `tenantScoped` que lança erro em query sem `company_id`. Recurso de outro tenant retorna 404.
- Motivo: defesa em profundidade; um filtro esquecido vira erro em vez de vazamento.
- Trade-offs: scripts administrativos (seed) precisam contornar o plugin explicitamente.
- Em produção: testes de isolamento no CI; para clientes com exigência regulatória, banco ou cluster dedicado por tenant.

## D-06: Registro cria a empresa e o primeiro admin
- Status: aceita
- Contexto: como um usuário é associado a uma empresa.
- Opções: escolher empresa existente no registro, convite, registro cria empresa.
- Decisão: `POST /auth/register` cria empresa + admin; usuários `user` são criados pelo admin ou pelo seed. Email único global.
- Motivo: escolher empresa existente no registro permitiria entrar em qualquer tenant.
- Trade-offs: sem fluxo de convite por email.

## D-07: Loop de tool calling próprio, sem framework de agentes
- Status: aceita
- Contexto: o critério pede integração real com LLM via tool calling.
- Opções: LangChain, Vercel AI SDK, SDK oficial do provedor com loop próprio.
- Decisão: SDK oficial atrás de uma interface `LLMProvider`, loop explícito com limite de iterações, tools validadas com zod e sem `companyId` no schema (o tenant é injetado pelo servidor).
- Motivo: deixa o mecanismo visível e testável, e torna prompt injection incapaz de atravessar tenants.
- Trade-offs: streaming e troca de provedor exigem mais código próprio.
- Em produção: observabilidade de tokens, custo e latência por tenant; limites de uso por plano; cache de respostas frequentes.

## D-08: JWT em cookie httpOnly em vez de header Authorization
- Status: aceita (substitui D-04 quanto ao transporte do token)
- Contexto: o JWT precisa chegar ao browser sem ficar exposto a JavaScript; em `localStorage` um XSS consegue exfiltrá-lo.
- Opções: Bearer em `localStorage`, Bearer em memória com refresh, cookie httpOnly.
- Decisão: cookie `access_token` (httpOnly, `SameSite=Lax`, `Secure` em produção, `path=/`, `maxAge` igual à expiração do JWT). O token nunca aparece no corpo da resposta. JWT HS256 com `algorithms` fixado na verificação; senhas com bcryptjs (custo 10, sem build nativo).
- Motivo: JavaScript nunca toca o token. CSRF mitigado em camadas: `SameSite=Lax`, CORS restrito à origem do web com `credentials`, e POST/PUT/PATCH aceitam só `application/json` (obriga preflight em chamadas cross-origin). Em dev, web e server em portas diferentes de localhost são same-site, então Lax funciona. O web usa `fetch` com `credentials: 'include'`.
- Trade-offs: logout só remove o cookie; um token copiado continua válido até expirar. Mudança de role só vale no próximo login. Rate limit por IP em memória (10/min em register e login).
- Em produção: com web e API em domínios diferentes, usar proxy no mesmo domínio (preferível) ou `SameSite=None; Secure` com token CSRF. Access token curto + refresh rotativo, revogação por versão de token, rate limit com store compartilhado (Redis) e `trust proxy` configurado.

## D-09: Escape hatch explícito no plugin `tenantScoped`
- Status: aceita
- Contexto: o plugin lança `TenantScopeError` em query sem `company_id`, mas o login busca por email antes de o tenant ser conhecido, e o seed limpa todos os tenants.
- Opções: desativar o plugin globalmente em certos fluxos, usar o driver nativo sem Mongoose, opção por query.
- Decisão: `.setOptions({ bypassTenantScope: true })`, aceito só com valor `true` literal, usado em exatamente dois lugares comentados: `UserRepository.findByEmailAcrossTenants` (login e checagem de email único no registro) e `scripts/seed.ts`. Auditável com `grep -rn bypassTenantScope`. Aggregate não tem bypass e exige `$match` em `company_id` como primeiro estágio.
- Motivo: o contorno fica visível, pontual e testado; o padrão continua sendo falhar fechado. Só igualdade (string ou ObjectId) conta como filtro de tenant; operadores como `$ne` ou `$exists` são rejeitados. Além do filtro, o plugin confere o payload de escrita: `immutable` só cobre updates simples, então replace, upsert (`$set`/`$setOnInsert`), `$unset`, `overwriteImmutable` e pipeline updates que levariam o documento para outro tenant lançam `TenantScopeError`, e um replace sem `company_id` recebe o do filtro.
- Trade-offs: o plugin cobre só o primeiro `$match` de aggregates; `$lookup`/`$unionWith` posteriores dependem do repository. `bulkWrite` e o driver nativo não passam pelo plugin.
- Em produção: regra de lint ou CI que falha em novos usos de `bypassTenantScope` fora de uma allowlist.

## D-10: Registro com compensação em vez de transação
- Status: aceita
- Contexto: `POST /auth/register` cria empresa e admin; transações no MongoDB exigem replica set, que o setup local (Docker standalone e mongodb-memory-server) não tem.
- Opções: transação com replica set, compensação manual, criar o usuário antes da empresa.
- Decisão: checa se o email está livre, gera o hash, cria a empresa, cria o usuário; se a criação do usuário falhar, apaga a empresa e relança o erro original. Email duplicado vira 409 `EMAIL_TAKEN`, inclusive na corrida entre dois registros (erro 11000 do índice único traduzido no repository).
- Motivo: mantém o setup de um container só, sem perder consistência no caso comum.
- Trade-offs: se o processo cair entre os dois inserts, ou a compensação falhar (logada), sobra uma empresa órfã sem usuários, inofensiva mas suja.
- Em produção: replica set (Atlas já é) e `session.withTransaction`, ou job que limpa empresas sem usuários.

## D-11: Env com varlock para carregar e zod para validar
- Status: aceita
- Contexto: o scaffold carrega env com varlock (`.env.schema` versionado no lugar de `.env.example`); a app precisa de config tipada, validada no boot e fácil de injetar em testes.
- Opções: só varlock (`ENV` gerado), só zod + `--env-file`, varlock para carregar e zod para validar.
- Decisão: `import "varlock/auto-load"` só no entry point e no seed; `src/config/env.ts` valida `process.env` com zod e exporta `env`, única fonte lida pela app. `JWT_EXPIRES_IN` ("8h") vira segundos no schema e alimenta tanto o `exp` do JWT quanto o `maxAge` do cookie. Nome `DATABASE_URL` mantido (compartilhado com `packages/db` e turbo).
- Motivo: fail fast com mensagens claras; testes definem variáveis no `vitest.config.ts` sem depender de arquivo `.env`.
- Trade-offs: variáveis declaradas em dois lugares (`.env.schema` e schema zod).
- Em produção: segredos vindos do provedor (secret manager), mesma validação no boot.

## D-12: Sessão no web via cache do TanStack Query e mapa de permissões espelhado
- Status: aceita
- Contexto: o web precisa saber quem está logado e o que cada papel pode fazer sem nunca tocar no token (D-08), e reagir a sessão expirada em qualquer tela.
- Opções: contexto React com estado próprio, store global (Zustand), query `['auth', 'me']` como única fonte.
- Decisão: a query `['auth', 'me']` é a sessão (`null` = deslogado; `/auth/me` com 401 resolve `null`). Login e registro gravam o usuário retornado no cache; logout e qualquer 401 fora de login/registro/me limpam o cache inteiro e levam a `/login?redirect=<rota atual>` (só caminhos same-origin são aceitos). O guard do `_app` usa `ensureQueryData` com revalidação em segundo plano, então cada navegação reconfere a sessão sem bloquear a UI. Quem navega para o login é quem encerra a sessão (logout, handler de 401); o layout só navega quando a revalidação encontra a sessão vazia e nenhuma navegação está pendente, via efeito e não `<Navigate>` (que renavega a cada render e entra em loop durante a navegação do logout). Um mapa `papel → permissões` em `lib/permissions.tsx`, espelho dos `authorize(...)` do servidor, alimenta navegação, botões, guards de página (estado 403 em vez de redirect silencioso) e o painel "O que você pode fazer".
- Motivo: uma fonte só, sem sincronizar estado manualmente; limpar o cache no logout impede que dados de um tenant apareçam para a próxima sessão no mesmo browser. O mapa evita `role === 'admin'` espalhado e torna o modelo de permissões visível ao avaliador.
- Trade-offs: o mapa é duplicado do servidor e pode divergir; ele só molda a UI, quem garante é o servidor. Uma chamada leve a `/auth/me` por navegação. Contas demo no login (flag `VITE_SHOW_DEMO_ACCOUNTS`) expõem credenciais do seed, aceitável só em demo.
- Em produção: permissões vindas do servidor no payload de `/auth/me` (fonte única), flag de contas demo desligada, e refresh token silencioso antes de mandar o usuário ao login.

## D-13: Preço em centavos inteiros
- Status: aceita
- Contexto: produtos têm preço, e o agente de IA filtra e compara preços com dados reais.
- Opções: `Number` com decimais, `Decimal128`, inteiro em centavos.
- Decisão: `priceCents` inteiro `>= 0`, validado com zod na borda e no schema Mongoose (`Number.isInteger`). A formatação em reais fica no web.
- Motivo: ponto flutuante não representa a maioria dos valores decimais (`0.1 + 0.2 !== 0.3`); inteiros somam, comparam e ordenam sem erro e serializam em JSON sem conversão, ao contrário de `Decimal128`.
- Trade-offs: a API expõe centavos, e todo cliente (incluindo o agente) precisa converter para exibir. Uma só moeda (BRL).
- Em produção: moeda por empresa (ISO 4217) junto do valor, se houver clientes em outros países.

## D-14: Categoria como string livre no produto
- Status: aceita
- Contexto: produtos são filtrados por categoria, e o web e o agente precisam da lista de categorias do tenant.
- Opções: coleção `categories` por tenant com referência, string livre no produto.
- Decisão: `category` string (trim, 2 a 60 caracteres) no produto; a lista vem de `distinct("category", { company_id })`, coberta pelo índice `{ company_id, category }`. O texto é gravado como digitado, sem normalizar maiúsculas.
- Motivo: sem CRUD extra nem consistência entre coleções; uma categoria deixa de existir sozinha quando seu último produto é removido.
- Trade-offs: "Brinquedos" e "brinquedos" viram categorias diferentes; renomear uma categoria exige atualizar vários produtos; sem metadados (ordem, ícone).
- Em produção: coleção de categorias por tenant com slug único, ou collation case-insensitive (`strength: 2`) no índice e no distinct.
