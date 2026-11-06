# Histórico de versões

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
