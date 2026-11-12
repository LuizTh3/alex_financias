# Alex — Finanças pessoais

Base de uma aplicação pessoal responsiva: React + TypeScript + Vite, Tailwind CSS com shadcn/ui, React Router, React Hook Form + Zod e Firebase (Authentication e Firestore), com hospedagem do site na Vercel. SDK web direto, sem API própria.

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

- `src/pages`: as seis telas (Visão geral, Faturas, Cartões, Previsão dos meses, Rendas, A receber) e o login.
- `src/forms`: formulários de cartão, lançamento, renda e a receber.
- `src/components/ui`: componentes do [shadcn/ui](https://ui.shadcn.com/) (botões, campos, diálogos, cards, tabela). Adicione novos com `npx shadcn@latest add <nome>`; a configuração fica em `components.json`.
- Animações suaves de janelas, confirmações, calendário de meses, filtros e caixas de seleção vêm do [Animate UI](https://animate-ui.com/) (`npx @animate-ui/cli@latest animate <componente>`), com respeito à preferência de reduzir movimento. A licença do Animate UI (MIT + Commons Clause) permite o uso no app, mas não a revenda dos componentes.
- `src/components`: peças do app montadas sobre o shadcn/ui: cartão visual, seletor de mês, selos, diálogos de confirmação e de detalhes.
- `src/domain`: validações e cálculos puros (parcelas, faturas, saldo, previsão). Dinheiro em centavos inteiros; meses `YYYY-MM`; datas `YYYY-MM-DD`.
- `src/data`: leitura e gravação no Firestore, sempre validadas com Zod.
- `src/hooks`: assinatura das coleções em tempo real e mês/cartão selecionados na URL.

O [modelo de dados](docs/modelo.md) descreve as coleções e as regras de cálculo.

## Como funciona

A ideia central é **gravar só o que você digita e calcular o resto**. Uma compra parcelada é um único documento; as parcelas, as faturas, o saldo e a previsão são calculados na tela.

- **Cartões:** nome, cor, dia de fechamento e de vencimento. Cartão sem compras nem faturas pagas é excluído; com dados, é inativado e some das telas (os dados continuam guardados).
- **Faturas:** escolha o cartão (ou chegue por um cartão da Visão geral/Cartões) e o mês. Lance compras à vista ou parceladas (até 24x); o 1º mês de vencimento é sugerido pelo fechamento. O histórico mostra "Parcela 7/12" e permite filtrar, editar, excluir (parcelado: todas as parcelas) e ver detalhes. "Marcar como paga" é só uma identificação, com confirmação.
- **Rendas:** valor mensal com início e fim opcional. Editar altera todos os meses; para mudar o valor a partir de um mês, encerre a renda e crie outra.
- **A receber:** valores que terceiros lhe devem, com marcação de recebido por parcela. Não entra no saldo.
- **Visão geral:** renda, a pagar (soma das faturas dos cartões ativos) e saldo previsto (renda − a pagar) do mês, os cartões com a fatura e o total a receber.
- **Previsão dos meses:** 12 meses a partir do mês escolhido, com A receber em coluna informativa.

O mês e o cartão escolhidos ficam no endereço (`/faturas?cartao=…&mes=2026-12`): recarregar ou compartilhar o link mantém a seleção.

## Desenvolvimento com emulador

`npm run dev:emulator` sobe o login e o Firestore do emulador local e o app em http://localhost:5180, ligado a eles e com as regras de `firestore.rules`. Não usa o `.env` nem o Firebase real (projeto `demo-alex-financias`, configurado em `.env.emulator`). Como o app não tem cadastro público, crie um usuário de teste pela API do emulador (os dados somem ao desligá-lo):

```sh
curl -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo" -H "Content-Type: application/json" -d "{\"email\":\"teste@exemplo.test\",\"password\":\"senha-de-teste\"}"
```

Em desenvolvimento há também a vitrine de componentes em `/dev/componentes`, que fica fora do build de produção.

Os emuladores exigem Java 21+. No Windows, o script já contorna a falha "Unable to establish loopback connection", causada por espaço no caminho da pasta do usuário.

## Validação e publicação

```sh
npm test
npm run build
npm run test:rules
```

`npm test` roda os testes de domínio, componentes e telas; os de regras e repositórios são ignorados sem emulador. `npm run test:rules` sobe o emulador Firestore com projeto demo e roda esses testes.

Ao publicar uma versão que muda as regras, publique as regras e o site juntos: `npx firebase deploy --only firestore:rules,firestore:indexes` e um novo deploy na Vercel. O comando opcional `npm run deploy` publica regras, índices e o site no Firebase Hosting, e não na Vercel.

## Licença e versionamento

Projeto open source sob a [licença MIT](LICENSE). Permite uso, modificação e distribuição, inclusive comercial, preservando os avisos da licença. As dependências mantêm suas respectivas licenças.

Versão atual: **0.3.0**. O projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/): novas funcionalidades incrementam a versão menor e correções incrementam a versão de patch. A série `0.x` indica desenvolvimento inicial, sem compromisso de estabilidade definitiva. Consulte o [histórico de versões](CHANGELOG.md).

O campo `private: true` no package.json apenas impede publicação acidental no npm; não altera a licença do código.
