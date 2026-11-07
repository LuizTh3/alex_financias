# Alex — Finanças pessoais

Base de uma aplicação pessoal responsiva: React + TypeScript + Vite, Tailwind CSS, React Router, React Hook Form + Zod e Firebase (Authentication e Firestore), com hospedagem do site na Vercel. SDK web direto, sem API própria.

## Executar

Requer Node.js 22.12+ e npm.

```sh
npm ci
cp .env.example .env # apenas em um checkout sem .env; preserve a configuração existente
npm run dev
```

Preencha as variáveis de `.env`. Nunca versione esse arquivo. As variáveis `VITE_*` são incorporadas ao JavaScript público: use apenas configuração web, nunca senha, chave privada ou service account.

## Conta pessoal e Firebase

1. No projeto do Firebase indicado em `.firebaserc`, habilite Authentication → Sign-in method → Email/Password.
2. Em Authentication → Users → Add user, crie manualmente sua conta. A senha pertence exclusivamente ao Authentication.
3. Qualquer usuário autenticado pode acessar sua própria área; não é necessário configurar UID no ambiente.
4. Crie o Cloud Firestore em modo de produção. Adicione o domínio de acesso em Authentication → Settings → Authorized domains, se necessário.
5. Autentique o CLI com `npx firebase login` e confira o projeto usando `npx firebase projects:list`.
6. Publique as regras **antes de usar dados reais**:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes
```

Não há cadastro público na interface. As regras permitem que cada usuário autenticado leia e grave somente em users/{seu UID}; caminhos de outros usuários permanecem bloqueados.

As regras locais só passam a proteger o projeto remoto depois do deploy. Regras anteriores do console permanecem vigentes até lá.

## Hospedagem na Vercel

O site está hospedado na [Vercel](https://vercel.com/). A plataforma oferece o plano **Hobby gratuito** para projetos pessoais e não comerciais, sujeito aos limites do plano. Para uso comercial, consulte as condições dos planos. O login e os dados continuam no Firebase.

### Como hospedar

1. Envie o projeto para um repositório Git. Na Vercel, escolha **Add New → Project** e importe o repositório.
2. Selecione **Vite** como framework e a raiz do projeto. Configure instalação `npm ci`, build `npm run build` e saída `dist`. Use Node.js 22.x compatível com o requisito 22.12+ do projeto.
3. Em **Environment Variables**, cadastre as seis variáveis `VITE_FIREBASE_*` de [.env.example](.env.example), com os valores do seu Firebase. Configure Production e, se utilizar, Preview. Não é necessário informar UID nem enviar o `.env` ao repositório.
4. Para abrir ou atualizar rotas como `/conta` sem erro 404, crie `vercel.json` na raiz com:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

5. Clique em **Deploy**. No Firebase, confira **Authentication → Settings → Authorized domains** e adicione o domínio utilizado, como `seu-projeto.vercel.app` ou seu domínio próprio.
6. Publique as regras e os índices do banco separadamente: `npx firebase deploy --only firestore:rules,firestore:indexes`. O deploy da Vercel não publica essas configurações.

Com o repositório conectado, novos pushes na branch de produção geram novas publicações. Após alterar variáveis de ambiente, faça um novo deploy. Confira o login e atualize uma rota interna diretamente no navegador após publicar.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [variáveis de ambiente](https://vercel.com/docs/environment-variables) e [plano Hobby](https://vercel.com/docs/plans/hobby).

## Estrutura

- `src/pages`: login, cartões/categorias, lançamentos e consultas mensais.
- `src/components`: componentes compartilhados e proteção de rotas.
- `src/contexts`: sessão com hooks/context; persistência da sessão no navegador por aba.
- `src/domain`: validações, modelos e cálculos puros. Dinheiro em centavos inteiros; datas de vencimento `YYYY-MM-DD`; meses `YYYY-MM`.
- `src/repositories`: assinaturas validadas com Zod e transações Firestore de cadastros e lançamentos/parcelas.
- `src/lib`: inicialização do SDK e validação da configuração.

## Cartões e categorias

Acesse **Cartões** ou **Categorias** para cadastrar e editar. Arquivamento tem confirmação e preserva os vínculos; os filtros Ativos/Arquivados/Todos permitem reativar cadastros. Cartões têm nome, cor, fechamento e vencimento; categorias têm nome e aplicação em despesas, recebimentos ou ambos.

Cada gravação usa `serverTimestamp()`. Edições e arquivamentos usam transações e detectam versões alteradas por outra aba. IDs estáveis por formulário e bloqueio de envio impedem duplicação em tentativas repetidas. Horários são exibidos em `America/Rio_Branco`.

As regras locais agora autorizam cartões e categorias para o UID pessoal, validam os campos, protegem `createdAt` e negam exclusão física. Lançamentos, parcelas e materialização de faturas também têm regras específicas de gravação atômica; pagamento integral/reversão de faturas e seu histórico têm validação específica; recorrências versionadas, ocorrências e confirmações diretas têm regras específicas. É necessário publicar `firestore.rules` no Firebase para os formulários funcionarem no projeto remoto.

O [contrato financeiro](docs/financial-contract.md) registra o modelo Firestore, os comportamentos já implementados e os requisitos acordados para compras, parcelas, pagamentos e recorrências. Recorrências e confirmações diretas agora também estão disponíveis. Não há dados fictícios nem migração automática de documentos antigos.

## Lançamentos e motor financeiro

Acesse **Lançamentos** para criar despesas ou recebimentos, conferir a sugestão de competência e a prévia das parcelas, editar o conjunto completo ou excluir com confirmação. Dinheiro usa centavos inteiros; o total é dividido exatamente. Limite de 24 parcelas por lançamento. Operações acima de cinco parcelas são gravadas por etapas verificadas, com retomada após interrupções.

O [motor financeiro](docs/financial-engine.md) documenta os cálculos, o limite, os comandos idempotentes, as transações, as revisões, a exclusão com auditoria e os bloqueios de parcelas/faturas liquidadas. As cobranças futuras são geradas no cadastro e ficam disponíveis nas consultas mensais. A confirmação integral/reversão de faturas já está disponível. Recorrências versionadas e confirmações diretas já estão integradas às consultas mensais.

## Faturas mensais e histórico

Em **Faturas**, consulte mês, cartão e situação, abra a composição das cobranças e confirme o pagamento **integral**. A reversão exige confirmação e libera as cobranças para correção, preservando o pagamento original no histórico. Cartões arquivados continuam visíveis nos períodos com faturas.

O [módulo de faturas](docs/invoices.md) detalha saldos materializados, comandos idempotentes, histórico imutável, concorrência e a ferramenta administrativa de migração dos cabeçalhos anteriores (modo de conferência por padrão). Pagamento não cria outra despesa e não altera quitações individuais das parcelas em cartão.

## Recorrências e recebimentos parcelados

Em **Despesas fixas**, alterne entre ocorrências mensais e modelos com histórico de versões. Crie, pause, retome ou encerre a partir de uma competência. Ocorrências já geradas permanecem intactas; a geração automática cria apenas as faltantes, sem duplicar em duas abas. Compromissos futuros incluem projeções dos próximos 12 meses.

Em **A receber**, cadastre entradas parceladas, confirme ou desfaça cada recebimento e consulte seu histórico. Ocorrências diretas de gastos fixos também têm pagamento reversível; as cobradas em cartão derivam a quitação da fatura.

O [guia de recorrências e recebimentos](docs/recurrences-and-receivables.md) detalha vigências, ocorrências, preservação dos registros existentes, auditoria, repositórios e regras de acesso. Não é necessário migrar parcelas anteriores para usar confirmações diretas.

## Validação e publicação

```sh
npm test
npm run build
npm run test:rules
```

`npm run test:rules` exige Java 21+ para o emulador Firestore. Os testes de regras e transações são ignorados no `npm test` quando não há emulador; o comando específico inicia um emulador com projeto demo, sem usar dados de produção. A publicação atual do site é feita pela Vercel, conforme o guia acima. O comando opcional `npm run deploy` permanece como alternativa para Firebase Hosting: publica regras, índices e o site no Firebase, e não na Vercel.

## Licença e versionamento

Projeto open source sob a [licença MIT](LICENSE). Permite uso, modificação e distribuição, inclusive comercial, preservando os avisos da licença. As dependências mantêm suas respectivas licenças.

Versão atual: **0.2.0**. O projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/): novas funcionalidades incrementam a versão menor e correções incrementam a versão de patch. A série `0.x` indica desenvolvimento inicial, sem compromisso de estabilidade definitiva. Consulte o [histórico de versões](CHANGELOG.md).

O campo `private: true` no package.json apenas impede publicação acidental no npm; não altera a licença do código.


### Parcelamentos até 24x

Despesas e recebimentos aceitam de 1 a 24 parcelas. Operações que envolvem mais de cinco parcelas são salvas por etapas verificadas no Firestore. Durante a gravação, o sistema aguarda a conclusão para exibir os saldos; se houver interrupção, use **Retomar parcelamento**. Não é necessário backend nem migração dos dados atuais. Publique as novas regras do Firestore antes de atualizar o frontend.
