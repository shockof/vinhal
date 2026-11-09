# Supabase da Igreja Videira

Atualizado em 08/11/2026. Projeto `videira-producao`, região São Paulo, plano Free.
Painel: https://supabase.com/dashboard/project/jlnjgjtqpnomofylacgu

## Aplicado e verificado

- Migrações 202611080001 e 202611080002 aplicadas pelo editor SQL. Este registro é documental; não representa execução pela CLI ou registro automático no histórico da CLI.
- Dez tabelas com RLS; isolamento por organização, igreja, rede e célula. Perfis sem escrita direta pelo cliente e sem promoção automática.
- Arquivos privados no bucket videira-private. Nenhum acesso anônimo aos cadastros.
- Registro de encontro em transação única, com lista completa de participantes, validação de datas e conversão de visitante após três encontros consecutivos com presença.
- Auditoria de alterações sem conteúdo pessoal nos registros de auditoria.
- Cadastro público e acesso anônimo desativados. Confirmação de e-mail mantida. Proteção na alteração de senha reforçada.
- URL do site e retorno: https://shockof.github.io/vinhal/

Testes SQL em transações descartadas passaram para seis funções, isolamento entre organizações, bloqueio de autopromoção, arquivos privados, sequência de presenças, reinício após falta e rejeição de datas futuras/repetidas e de outra célula. Conferência final: 10 tabelas protegidas, zero pessoas e bucket privado. Na conferência anterior à criação do primeiro acesso havia zero usuários Auth; o primeiro acesso foi criado posteriormente pelo responsável. Dados sintéticos dos testes foram revertidos.

## Pendente antes de dados reais

1. Primeiro usuário Auth criado pelo responsável e vinculado, com autorização explícita, à organização Igreja Videira. Perfil verificado: username `master`, cargo `master`, ativo. Nenhuma senha acessada ou armazenada no código.
2. Integrar login por nome de usuário, sessões, recuperação e provisionamento seguro de contas. Não publicar mapeamento de nome de usuário para e-mail.
3. Conectar os cadastros e relatórios do site ao banco, com validações e testes completos de acesso negado. O site público continua como demonstração local.
4. Implementar publicação compartilhada de conteúdo e separação explícita de arquivos públicos e privados.
5. Configurar e testar envio de e-mail, backup/restauração, proteção de contas administrativas e regras de publicação de fotos, contatos e endereços, incluindo Kids.

Nenhuma senha ou chave secreta integra estes arquivos. Não enviar service_role ao navegador. Não migrar automaticamente os dados fictícios da demonstração para produção. Não liberar cadastros reais enquanto a integração não estiver pronta e validada.


## Integração de 08/11/2026

Migração 202611080003_portal aplicada e testes portal.sql + portal_crud.sql aprovados em transações descartadas. Função videira-gateway publicada. O portal gestao.html já usa autenticação real e operações de cadastro/presença com RLS. Não confundir com a personalização e os uploads demonstrativos, que ainda são locais. Cadastro de novas contas, recuperação, MFA, CMS compartilhado e backup/restauração continuam pendentes. Exige validação do primeiro login pelo próprio responsável.
