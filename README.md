# Alex — Finanças pessoais

Base de uma aplicação pessoal responsiva: React + TypeScript + Vite, Tailwind CSS, React Router, React Hook Form + Zod e Firebase (Authentication, Firestore e Hosting). SDK web direto, sem API própria.

## Executar

Requer Node.js 22.12+ e npm.

```sh
npm ci
cp .env.example .env # apenas em um checkout sem .env; preserve a configuração existente
npm run dev
```

Preencha as variáveis de `.env`. Nunca versione esse arquivo. As variáveis `VITE_*` são incorporadas ao JavaScript público: use apenas configuração web e UID, nunca senha, chave privada ou service account.

## Conta pessoal e Firebase

1. No projeto do Firebase indicado em `.firebaserc`, habilite Authentication → Sign-in method → Email/Password.
2. Em Authentication → Users → Add user, crie manualmente sua conta. A senha pertence exclusivamente ao Authentication.
3. O UID informado é `Jhi9dIY92RbShnVhAVl5CaHuFJK2`, configurado em `.env`, `.env.example` e `firestore.rules`. Ao trocar de conta, atualize os três e publique as regras novamente.
4. Crie o Cloud Firestore em modo de produção. Adicione o domínio de acesso em Authentication → Settings → Authorized domains, se necessário.
5. Autentique o CLI com `npx firebase login` e confira o projeto usando `npx firebase projects:list`.
6. Publique as regras **antes de usar dados reais**:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes
```

Não há cadastro público na interface nem chamada a `createUserWithEmailAndPassword`. A autorização real está nas regras: outro UID é negado, inclusive em seu próprio caminho. A ausência da tela de cadastro não impede chamadas diretas ao endpoint de criação de contas do Authentication; contas eventualmente criadas não terão acesso aos dados. O bloqueio de criação no serviço de identidade, se necessário, exige configuração adicional fora deste MVP.

As regras locais só passam a proteger o projeto remoto depois do deploy. Regras anteriores do console permanecem vigentes até lá.

## Estrutura

- `src/pages`: login e consultas iniciais (visão geral, cartões, faturas, despesas fixas, recebíveis e futuros).
- `src/components`: componentes compartilhados e proteção de rotas.
- `src/contexts`: sessão com hooks/context; persistência da sessão no navegador por aba.
- `src/domain`: modelos e cálculos puros. Dinheiro em centavos inteiros; datas de vencimento `YYYY-MM-DD`; meses `YYYY-MM`.
- `src/repositories`: assinaturas Firestore tipadas e validadas com Zod.
- `src/lib`: inicialização do SDK e validação da configuração.

Dados em `/users/{uid}/cards/{id}`, `/invoices/{id}`, `/fixedExpenses/{id}` e `/receivables/{id}` (todos os caminhos de coleção sob `/users/{uid}`). Documentos não armazenam o ID, que vem do Firestore. Consulte os tipos em `src/domain/finance.ts` e os schemas em `src/repositories/financeRepository.ts`.

A navegação mensal consulta vencimentos; compromissos futuros são pendências com mês posterior ao selecionado. O saldo exibido considera apenas compromissos, sem representar saldo bancário. Despesas fixas ainda não geram recorrências automaticamente. Esta entrega inicial prepara autenticação e consultas; formulários de inclusão/edição, parcelamento e regras de fechamento de cartão ficam para a próxima etapa. Não há dados fictícios.

## Validação e publicação

```sh
npm test
npm run build
npm run test:rules
npm run deploy
```

`npm run test:rules` exige Java 21+ para o emulador Firestore. Os testes de regras são ignorados no `npm test` quando não há emulador; o comando específico inicia um emulador isolado. O deploy publica regras, índices e a SPA em Firebase Hosting, com fallback das rotas para `index.html`. Não publica sozinho durante o desenvolvimento.
