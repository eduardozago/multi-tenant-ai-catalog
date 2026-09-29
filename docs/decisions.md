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
- Status: aceita
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
