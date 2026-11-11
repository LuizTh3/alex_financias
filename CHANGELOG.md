# Histórico de versões

## 0.3.0 — 2026-11-11

Refatoração para simplificar o app, seguindo o novo diagrama de fluxo. **Mudança incompatível:** começa do zero, sem migrar lançamentos, faturas, recorrências e contas da v0.2.0. Publique `firestore.rules` junto com o site.

### Funcionalidades

- Menu reduzido a seis telas: Visão geral, Faturas, Cartões, Previsão dos meses, Rendas e A receber.
- Visão geral com renda, a pagar (soma das faturas) e saldo previsto do mês, cartões com fatura e pagamento rápido, e card isolado de A receber.
- Faturas por cartão e mês, com cartão visual, lançamentos à vista ou parcelados (até 24x), filtros, detalhes, edição e exclusão de todas as parcelas.
- Fatura paga como marcador simples, com confirmação para marcar e desmarcar.
- Cartões com prévia ao vivo e busca; cartão com dados é inativado em vez de excluído.
- Rendas mensais com início e fim opcional.
- A receber de terceiros com marcação por parcela, fora do saldo.
- Previsão de 12 meses a partir de um mês escolhido, com A receber informativo.
- Mês e cartão selecionados ficam na URL.
- `npm run dev:emulator` para desenvolver com login e Firestore do emulador local.

### Removido

- Categorias, Lançamentos de despesas diretas, Rendas e despesas mensais versionadas, Minha conta (saldo e movimentos), Compromissos futuros e Como usar.
- Parcelas e faturas materializadas, histórico de eventos de pagamento, protocolo de parcelamento em etapas e script de migração de faturas.

### Modelo de dados

- Cinco coleções: `cards`, `purchases`, `invoiceStatus`, `incomes`, `receivables`. Parcelas, faturas, saldo e previsão são calculados. Detalhes em [docs/modelo.md](docs/modelo.md).
- Regras do Firestore reescritas (de 597 para cerca de 120 linhas).

### Validação

- 84 testes locais e 16 testes de regras e repositórios no emulador.
- Fluxos do diagrama conferidos no navegador com o emulador local.

## 0.2.0 — 2026-11-06

Primeira versão marcada com tag, consolidando as funcionalidades desenvolvidas até aqui.

### Funcionalidades

- Autenticação com Firebase e isolamento dos dados por usuário, sem UID fixo no ambiente.
- Categorias e cartões com edição, arquivamento e reativação.
- Lançamentos parcelados, faturas, pagamentos e reversões com histórico.
- Rendas e despesas mensais recorrentes, versionamento e recebimentos parcelados.
- Saldo em conta, ajustes justificados e projeção acumulada de caixa.
- Dashboard com totais, navegação, estados vazios e tratamento de erros.
- Tutorial Como usar e apresentação inicial para usuários sem documento de perfil.
- Tema escuro com preferência persistida, paleta compartilhada e seletor no menu.

### Correções e documentação

- Preservação do tipo Recebimento ao editar renda recorrente.
- Reorganização do menu e instruções de hospedagem na Vercel.
- Licença MIT e metadados de versão sincronizados.

### Validação

- Build de produção aprovado; 43 testes locais passaram na validação funcional mais recente.
- 60 testes de integração/regras dependem do emulador Firestore e permanecem pendentes.
- As regras do Firestore precisam ser publicadas junto à atualização da aplicação.

## 0.1.0

Versão inicial declarada no pacote, sem tag de lançamento.
