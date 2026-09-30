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

## D-15: Exclusão física de produtos
- Status: aceita
- Contexto: `DELETE /products/:id` (só admin) precisa remover o produto do catálogo e das respostas do agente.
- Opções: exclusão física, soft delete com `deletedAt`, soft delete + log de auditoria.
- Decisão: `deleteOne({ _id, company_id })`, resposta 204; produto inexistente ou de outro tenant retorna 404 `PRODUCT_NOT_FOUND`.
- Motivo: nenhum outro dado referencia produtos (sem pedidos), e soft delete obrigaria todo repository e toda tool do agente a filtrar `deletedAt`, um filtro a mais para esquecer.
- Trade-offs: sem desfazer nem histórico de quem apagou o quê.
- Em produção: soft delete aplicado por plugin (como o `tenantScoped`), log de auditoria por tenant (quem, quando, antes/depois) e expurgo após o prazo de retenção.

## D-16: Busca de produtos por regex escapada
- Status: aceita
- Contexto: `GET /products?search=` e as tools do agente buscam por trechos do nome ou da descrição ("ração" deve achar "Ração Premium 15kg").
- Opções: regex case-insensitive, text index do MongoDB, Atlas Search.
- Decisão: regex com flag `i` em `name` e `description`, montada só depois de `escapeRegex` (entrada tratada como texto literal); `search` limitado a 100 caracteres. Mesmo método (`ProductRepository.search`) atende a API e o agente e revalida os filtros com zod (tipos estritos, sem coerção): NaN, objetos como `{ $ne: "x" }` e sorts desconhecidos são rejeitados antes da query, e `limit` acima de 50 é reduzido a 50.
- Motivo: casa trechos e prefixos, que o text index não faz (ele casa palavras inteiras com stemming); nesta escala (dezenas de produtos por tenant, sempre filtrados por `company_id`) o scan é barato. Sem escape, `.*` ampliaria a busca e padrões como `(a+)+$` causariam backtracking catastrófico.
- Trade-offs: regex sem âncora não usa índice; sem ranking por relevância; acentos contam ("racao" não acha "ração").
- Em produção: Atlas Search com analyzer pt-BR (acentos, stemming, fuzzy e relevância) ou text index; para o agente, busca semântica com embeddings.

## D-17: Ordenação por nome com collation pt
- Status: aceita
- Contexto: ordenação binária põe "Água" depois de "Zíper" e maiúsculas antes de minúsculas.
- Opções: ordenação binária, campo `nameSort` normalizado, collation `{ locale: "pt" }`.
- Decisão: `sort=name_asc` usa collation pt, e o índice `{ company_id, name }` é criado com a mesma collation.
- Motivo: ordem correta em português sem campo extra; o MongoDB só usa um índice para ordenar quando a collation da query é igual à do índice.
- Trade-offs: só `name_asc` usa collation; filtros de igualdade (categoria) continuam sensíveis a maiúsculas (D-14). Um banco criado antes da collation mantém o índice antigo, e o `autoIndex` falha em silêncio ao recriá-lo; o seed usa `syncIndexes()`, então basta rodar `pnpm db:seed`.

## D-18: Envelope de listagem paginada `{ data, meta }` com offset
- Status: aceita
- Contexto: `GET /products` devolve uma página e o web precisa montar a paginação; os demais endpoints usam envelope nomeado (`{ product }`, `{ users }`, `{ categories }`).
- Opções: array puro com headers (`X-Total-Count`), envelope nomeado (`{ products, total }`), `{ data, meta }`; paginação por offset ou por cursor.
- Decisão: listas paginadas usam `{ data, meta: { page, limit, total, totalPages } }`; recursos únicos e listas curtas sem paginação seguem com envelope nomeado. Paginação por `page`/`limit` (máx. 50), com `countDocuments` e `find` em paralelo. `meta` é montado campo a campo no controller.
- Motivo: o formato separa dados de metadados e é o mesmo para qualquer recurso paginado futuro; offset permite pular para uma página e mostrar o total, o que a UI de catálogo precisa.
- Trade-offs: dois formatos de resposta na API (paginado e não paginado); offset fica caro em coleções grandes (`skip` percorre os documentos) e pode repetir ou pular itens se o catálogo mudar entre páginas; o `count` custa uma query a mais.
- Em produção: paginação por cursor (`createdAt` + `_id`) para listas grandes ou infinitas, e contagem aproximada ou em cache.

## D-19: Códigos de erro por recurso; validação do Mongoose como bug
- Status: aceita
- Contexto: o módulo de produtos é a referência para os próximos, e o cliente (web e agente) precisa distinguir erros sem ler a mensagem.
- Opções: código genérico (`NOT_FOUND`), código por recurso (`PRODUCT_NOT_FOUND`); erro de validação do Mongoose como 400 ou como 500.
- Decisão: erros de domínio levam código por recurso (`new NotFoundError("PRODUCT_NOT_FOUND", ...)`, código primeiro, como `ConflictError`). O contrato de entrada é o schema zod, que usa as mesmas regras do schema Mongoose (constantes compartilhadas em `product.constants.ts`); um `ValidationError` do Mongoose significa que as duas camadas divergiram e continua virando 500, logado.
- Motivo: códigos estáveis por recurso deixam o web mostrar mensagens específicas; tratar a divergência como bug evita esconder uma regra que o zod deixou passar. Um teste cobre o caso que já divergiu (URL com espaço).
- Trade-offs: se uma nova regra for adicionada só no Mongoose, o cliente vê 500 até a correção.
- Em produção: alerta sobre `ValidationError` do Mongoose nos logs, ou teste que compara as regras do zod e do schema.

## D-20: Preço digitado com máscara e convertido para centavos no cliente
- Status: aceita
- Contexto: a API recebe `priceCents` inteiro (D-13); o formulário do web precisa aceitar valores em reais no formato pt-BR sem introduzir ponto flutuante no payload.
- Opções: `<input type="number">` em reais convertido com `* 100`; texto livre interpretado no submit; máscara "caixa registradora" (dígitos entram pela direita) sobre texto.
- Decisão: máscara sobre texto (`maskPriceInput` em `lib/format.ts`), com "R$" como adorno fora do valor. O schema zod do formulário transforma o texto em centavos com `parseBRLToCents`, que trabalha só com a string de dígitos. A divisão por 100 existe apenas para exibir (`formatBRL`).
- Motivo: `12.34 * 100` em float dá `1233.9999…`; operar na string elimina o arredondamento. A máscara sempre produz um valor bem formado, então o usuário não precisa saber se o separador é vírgula ou ponto.
- Trade-offs: a máscara não permite posicionar o cursor no meio do número para editar um dígito; apagar é sempre a partir da direita.
- Em produção: o mesmo, com testes unitários dos helpers (o web ainda não tem runner de testes).

## D-21: Chaves de query hierárquicas para produtos
- Status: aceita
- Contexto: listagem paginada com filtros, detalhe e categorias são três caches que qualquer escrita pode deixar desatualizados.
- Opções: chaves planas por recurso (`['products', filters]`, `['products', id]`); chaves hierárquicas.
- Decisão: `['products', 'list', filters]`, `['products', 'detail', id]`, `['products', 'categories']`. Toda mutação invalida `['products']`. A exclusão remove antes o detalhe do produto excluído, para que um painel aberto não busque de novo um recurso que retornaria 404.
- Motivo: um único prefixo invalida tudo o que uma escrita pode afetar (novo total, categoria nova, nome alterado), e o segundo segmento evita que uma lista com `filters` colida com um detalhe.
- Trade-offs: invalidar o prefixo inteiro marca como obsoletas todas as páginas em cache; só as que estão na tela são buscadas de novo na hora, as outras quando voltarem a ser exibidas, mesmo que a escrita não as tenha afetado.

## D-22: Filtros do catálogo na URL
- Status: aceita
- Contexto: busca, categoria, ordenação e página do catálogo precisam sobreviver a um refresh e poder ser compartilhadas (`/products?category=Rações&page=2`).
- Opções: estado local do componente; `localStorage`; search params da rota.
- Decisão: search params validados por `productSearchSchema` no `validateSearch` da rota. Valores inválidos caem no padrão via `.catch` (nunca uma página de erro), e padrões (`sort=newest`, `page=1`) ficam fora da URL. Qualquer filtro novo volta para a página 1; a busca é aplicada 300ms após a última tecla e substitui a entrada do histórico em vez de criar uma por letra. Uma página além da última (link antigo, produtos excluídos) é corrigida para a última existente.
- Motivo: a URL é a única fonte do estado do filtro, então refresh, voltar/avançar e links compartilhados funcionam sem sincronização extra, e a chave de query deriva direto dela.
- Trade-offs: como toda busca substitui a entrada do histórico, "voltar" a partir de uma busca sai do catálogo em vez de voltar à lista sem filtro.

## D-23: Categoria normalizada para a grafia existente (só no cliente)
- Status: aceita
- Contexto: categoria é texto livre no servidor; "Rações", "rações" e "Racoes" virariam três categorias no filtro e nas respostas do agente.
- Opções: coleção de categorias com id; normalização no servidor (collation/lowercase); sugestão e normalização no formulário.
- Decisão: o combobox do formulário sugere as categorias existentes e, ao confirmar, troca um valor igual a uma existente ignorando caixa e acento (`localeCompare` com `sensitivity: "base"`) pela grafia existente. Um nome realmente novo é criado com "Criar «x»".
- Motivo: resolve o caso comum (o admin digita uma categoria que já existe) sem mudar o modelo de dados nem a API perto da entrega.
- Trade-offs: a regra vale só para o web; a API e o seed ainda aceitam quase-duplicatas.
- Em produção: normalizar no servidor (índice com collation pt de força 1) ou categorias como entidade própria.

## D-24: Edição envia só os campos alterados
- Status: aceita
- Contexto: `PATCH /products/:id` trata campo omitido como "não alterar". Enviar o formulário inteiro sobrescreve com valores antigos o que outro admin mudou em outro campo enquanto o formulário estava aberto.
- Opções: enviar tudo; enviar só os campos alterados (`dirtyFields` do react-hook-form); controle de concorrência otimista (versão/`updatedAt`).
- Decisão: o PATCH contém só os campos alterados; `imageUrl: null` só quando o campo de imagem foi esvaziado. Sem alterações, o formulário fecha sem requisição (o servidor rejeitaria um PATCH vazio).
- Motivo: segue o contrato da API e reduz a perda de atualização ao caso de dois admins mudarem o mesmo campo.
- Trade-offs: no mesmo campo, a última gravação ainda vence sem aviso.
- Em produção: `If-Match` com versão do documento e 409 em conflito.

## D-25: Provedor de LLM atrás de uma interface, SDK oficial da OpenAI
- Status: aceita (detalha D-07)
- Contexto: o agente precisa de um LLM real com tool calling, e o loop precisa ser testável sem rede nem chave de API.
- Opções: LangChain, Vercel AI SDK, SDK oficial chamado direto atrás de uma interface própria.
- Decisão: interface `LLMProvider` (`generate` e `stream`) com tipos neutros (blocos `text`, `tool_use`, `tool_result`); `OpenAIProvider` usa o SDK `openai` e só traduz. A tradução fica em funções puras (`openai.mapping.ts`), testadas sem rede. Erros do SDK (429, 5xx, timeout, rede, chave inválida) viram `LLMUnavailableError` (502 `LLM_UNAVAILABLE`); abort do cliente é repassado como está. No streaming, qualquer erro ao ler o próximo chunk (exceto o nosso abort) também vira 502, porque uma conexão derrubada chega como `Error` comum do cliente HTTP; a montagem do request e o acumulador ficam fora desse `try`, então um bug nosso continua sendo 500. Modelo e chave só no env, sem modelo padrão no código.
- Motivo: o loop de tool calling é o que está sendo avaliado, então fica explícito no nosso código; frameworks escondem o loop e o formato das mensagens. Os testes usam um `FakeLLMProvider` roteirizado, que registra o que o modelo teria recebido.
- Trade-offs: mapeamento de mensagens e streaming escritos à mão; trocar de provedor exige uma nova implementação (a interface já isola o resto).
- Em produção: segundo provedor como fallback em 429/5xx, circuit breaker e métricas de erro por provedor.

## D-26: Chat Completions em vez da Responses API
- Status: aceita
- Contexto: a OpenAI oferece duas APIs com tool calling; a Responses API pode guardar o histórico no servidor dela (`previous_response_id`).
- Opções: Responses API com estado no provedor, Responses API sem estado, Chat Completions.
- Decisão: Chat Completions. O histórico vive na nossa coleção de conversas, escopada por tenant e por usuário, e cada chamada envia as mensagens explicitamente.
- Motivo: o modelo sem estado mapeia um para um no loop explícito (mensagem do assistente com `tool_calls`, uma mensagem `tool` por chamada); o histórico fica sob as nossas regras de isolamento, e não no provedor.
- Trade-offs: cada iteração reenvia o histórico (mais tokens de entrada); recursos novos da OpenAI tendem a sair primeiro na Responses API.
- Em produção: limitar o histórico por tokens (não por número de turnos) e avaliar prompt caching do provedor.

## D-27: Schemas de tool em modo strict e validação com zod
- Status: aceita
- Contexto: argumentos de tool vêm do modelo e podem ser malformados ou manipulados via prompt injection.
- Opções: JSON Schema sem strict e validação manual, strict sem validação própria, strict mais zod.
- Decisão: tools declaradas com `strict: true` (todo campo em `required`, opcionais como tipos anuláveis, `additionalProperties: false` em todo objeto), geradas a partir do schema zod; o registry revalida com zod e trata `null` como "não informado". JSON inválido, input inválido ou tool desconhecida viram `{ error, details }` como resultado de tool com `isError`, nunca exceção.
- Motivo: strict garante a forma dos argumentos; zod garante valores (faixas, tamanhos) e remove campos extras como `company_id`. O modelo recebe o erro e pode corrigir a chamada na próxima iteração.
- Trade-offs: o modo strict não aceita parte do JSON Schema (ex.: `default`, `minLength`/`maxLength` em strings), então padrões são aplicados no código da tool e os limites de tamanho são removidos do JSON Schema enviado (o zod continua aplicando). O que o UI mostra e a conversa grava em `toolCalls` é o input já validado (campos extras removidos), nunca os argumentos crus do modelo.

## D-28: Resultado de tool separado entre modelo e UI; falhas inesperadas não viram erro de tool
- Status: aceita
- Contexto: o modelo precisa de poucos campos (cada campo custa tokens em toda iteração seguinte), mas os cards da UI precisam de `imageUrl`; e uma tool pode falhar por culpa do modelo (input inválido) ou da infraestrutura (banco fora).
- Opções: mesmo payload para modelo e UI; segunda leitura do banco para montar os cards; tool devolve `{ content, products }`. Para falhas: tudo vira erro de tool, ou só o que o modelo pode corrigir.
- Decisão: `execute` devolve `content` (projeção enviada ao modelo: id, nome, categoria, preço em BRL e em centavos, descrição truncada em ~200 caracteres) e `products` (DTO completo, só para a resposta HTTP). JSON inválido, input inválido, tool desconhecida e `product_not_found` voltam ao modelo como erro de tool; qualquer outra exceção é relançada e vira 500 logado. Id malformado e id de outro tenant dão o mesmo `product_not_found`.
- Motivo: menos tokens sem uma segunda query; o modelo corrige o que pode corrigir, e uma queda do banco não vira "não encontrei produtos".
- Trade-offs: dois formatos de produto no módulo de chat; a resposta do chat falha inteira se o banco cair no meio do loop.

## D-29: Histórico do chat no servidor, privado ao dono da conversa
- Status: aceita
- Contexto: o agente precisa do contexto das mensagens anteriores, e o histórico influencia o que o modelo responde.
- Opções: cliente envia o histórico a cada requisição; histórico no provedor (Responses API); histórico no nosso banco.
- Decisão: coleção `conversations` com `tenantScoped` e `userId`; toda leitura e escrita filtra `{ _id, company_id, userId }`, então outro usuário da mesma empresa ou de outra empresa recebe 404. O cliente envia só `message` e `conversationId`. Cada pergunta leva ao modelo as últimas 10 mensagens de texto (sem as tool calls antigas: o modelo consulta de novo). A troca (pergunta e resposta) só é gravada depois que o agente termina; em falha, nada é gravado. Rate limit de 20 mensagens/min por usuário, não por IP.
- Motivo: o cliente não consegue forjar mensagens de assistente ou resultados de tool para manipular o modelo; conversas não vazam entre usuários do mesmo tenant; preços antigos de respostas passadas não competem com os atuais.
- Trade-offs: o documento da conversa cresce sem limite (mensagens embutidas); os produtos da resposta são um snapshot e podem ficar desatualizados na tela; o limite por usuário é em memória.
- Em produção: janela de histórico por tokens com resumo das mensagens antigas, mensagens em coleção própria ou limite por conversa, rate limit e cota de tokens por tenant com store compartilhado (Redis).

## D-30: Streaming do agente por SSE sobre POST
- Status: aceita
- Contexto: uma resposta com tool calls leva vários segundos; sem progresso, a UI parece travada.
- Opções: WebSocket, SSE via `GET` com `EventSource`, SSE como resposta de um `POST` lido com `fetch`.
- Decisão: `POST /chat/stream` com o mesmo corpo e os mesmos guards de `POST /chat`, respondendo `text/event-stream` com os eventos `meta` → `tool_start`/`tool_end` → `delta` → `done` ou `error`. O serviço tem duas etapas: `prepare` (dono da conversa, empresa, id da conversa) roda antes de abrir o stream, então 400/401/404 continuam JSON; `complete` roda o agente já com o stream aberto, e falhas viram um evento `error` com o mesmo código e mensagem do error handler (`toErrorResponse` compartilhado). Desconexão do cliente aborta a chamada ao provedor e o loop; só respostas completas são gravadas.
- Motivo: SSE é HTTP comum (cookies, CORS e o `requireJson` contra CSRF continuam valendo), unidirecional como o caso pede; `EventSource` não envia corpo nem permite `POST`, por isso o web lê o stream com `fetch`.
- Trade-offs: depois do 200 não há como mudar o status; o cliente precisa tratar o evento `error`. Texto escrito pelo modelo antes de chamar tools também chega como `delta`; o texto final autoritativo é o do `done`. Sem heartbeat, um proxy com timeout curto pode fechar respostas muito lentas.
- Em produção: heartbeat (comentário SSE a cada ~15s), `retry`/retomada por id de evento, e métricas de tempo até o primeiro token.

## D-31: Limite de iterações do agente: última chamada sem tools, 502 se o modelo insistir
- Status: aceita
- Contexto: o loop precisa de um teto (custo e latência), mas lançar erro depois de executar as tools da última volta descarta dados já buscados e devolve 502 para uma pergunta que podia ser respondida.
- Opções: lançar erro ao estourar o teto; na última chamada, não executar as tools pedidas; na última chamada, proibir tools (`tool_choice: "none"`) para forçar uma resposta em texto.
- Decisão: `AGENT_MAX_ITERATIONS` (padrão 5, mínimo 2) conta chamadas ao LLM. A última vai com as tools declaradas (o histórico as referencia) e `tool_choice: "none"`, então o modelo responde com os resultados que já tem. Se mesmo assim ele pedir tools, nenhuma é executada e o agente lança `AgentIterationLimitError` (502 `AGENT_ITERATION_LIMIT`).
- Motivo: o teto continua rígido, mas vira "responda com o que tem" em vez de "falhe". O status é 502 e não 4xx porque a requisição era válida, e não 500 porque o nosso servidor não falhou: a dependência não entregou uma resposta utilizável, o mesmo caso de `LLM_UNAVAILABLE`, com código próprio para distinguir nos logs.
- Trade-offs: uma pergunta que precisaria de mais consultas recebe uma resposta parcial; com mínimo 2, o modelo sempre tem ao menos uma volta de tools.
- Em produção: acompanhar a taxa de `outcome` por execução no `agent_run` e ajustar o teto por tenant ou por plano.
