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


## Contas de liderança — 09/11/2026

Migração 202611090001_leadership_accounts aplicada e gateway atualizado. Cadastro Master de líder, discipulador, pastor de rede e obreiro, com pré-validação, organização derivada do ator, auditoria e criação Auth somente no servidor. Testes SQL revertidos, testes do gateway simulados e formulário conferido localmente. Senhas iniciais são definidas e submetidas pelo próprio responsável no site, nunca pelo agente em contas reais. O cadastro não envia e-mails. Recuperação, troca de senha e edição/desativação de contas no site continuam pendentes.


## Endereço e posição de células — 09/11/2026

Migração 202611090002_cell_location aplicada: coluna privada address_details e atualização da operação cell, sem migração/publicação de endereços. Mantém RLS e cadastros anteriores. Testes de formato, origem/precisão, preservação e autorização passaram em rollback. O aparelho só é consultado a pedido do usuário; o botão Salvar grava a posição no Supabase. Consulta de CEP no cliente envia somente o CEP a BrasilAPI/ViaCEP.


## E-mail opcional e contas Master/Supervisor — 09/11/2026

Migração 202611090003_optional_email_admin_roles aplicada; gateway aceita e-mail vazio e usa alias aleatório não entregável somente no Auth. Master pode provisionar Master e Pastor Supervisor na própria organização, sem igreja/rede; demais funções mantêm validação de escopo. Somente Master ativo pode chamar o fluxo via gateway. Testes dos seis cargos/isolamento/auditoria passaram em rollback, gateway sem e-mail passou em teste simulado e formulário foi testado localmente. Nenhuma conta real adicional criada pelo agente.


## Chamada pessoal de Master e Pastor Supervisor — 09/11/2026

Migração 202611090004_admin_cell_leaders aplicada. Os dois cargos podem liderar células da própria organização. Para esses cargos, record_meeting exige leader_id igual ao usuário autenticado; consultas administrativas permanecem amplas. Testes de vínculo ativo/organização, chamada própria e recusa sem vínculo passaram em rollback; interface filtrada conferida localmente.


## Meu perfil — 09/11/2026

Migração 202611090005_my_profile aplicada. Contatos próprios em videira_private.profile_details, RPC própria autenticada com campos limitados, bucket privado videira-avatars com RLS por proprietário ativo. Gateway aceita leitura/edição própria e troca de senha com current_password pelo endpoint Auth de usuário. Contato de e-mail não altera a identidade de login. Testes SQL revertidos e testes de gateway/interface com dados simulados passaram. Nenhuma senha ou foto pessoal real foi usada para testar.


## Edição administrativa e Maps — 10/11/2026

Migração 202611090006_admin_edit_and_maps aplicada e testes SQL revertidos aprovados. RPC Master-only para edição de contas da própria organização; proteção de acesso próprio, vínculos e auditoria; limite de redefinições. Senha é verificada/alterada apenas no Auth, sem trafegar no p_data SQL. Gateway resolve URLs de Maps e importa dados contidos no link. GOOGLE_MAPS_API_KEY não configurada: geocodificação oficial de coordenadas para rua permanece bloqueada por falta de projeto/chave Google Maps Platform. Nenhum serviço pago ativado.


## Chamada simplificada, exclusão recuperável e Pastor de prédio — 10/11/2026

Aplicadas as migrações `202611100001_building_pastor_role.sql` (enum em transação separada) e `202611100002_call_archive_and_building_pastor.sql`. O gateway permite `meeting_archive`, sempre autorizado no banco pelo usuário autenticado. A confirmação para ampliar estas permissões foi fornecida pelo usuário nesta conversa.

- A data usa o calendário local do dispositivo ao abrir o cartão. “Alterar data” expande o campo somente quando necessário. O servidor conserva a validação de data futura no fuso America/Maceio e de ordem cronológica; relógios incorretos podem exigir ajuste.
- Master e Supervisor gerem chamadas da organização; Pastor de rede, da rede vinculada; Obreiro, da sua igreja; Pastor de prédio, da sua igreja. Líder e discipulador não excluem chamadas.
- Exclusão é lógica, com autor/data e auditoria. Chamadas excluídas e suas presenças ficam fora dos painéis, relatórios e contagem de encontros consecutivos. O histórico é mantido e o mesmo perfil autorizado pode restaurar. Restauração é bloqueada se já houver outra chamada ativa na mesma data. Categorias atuais de membros não são revertidas automaticamente; isso evita desfazer cadastros ou conversões anteriores sem revisão.
- A função `predio` aparece como Pastor (a) de prédio na criação/edição Master, filtros, ordenação e painel. Recebe uma igreja, sem rede específica. Lê pessoas, células e redes dessa igreja; pode cadastrar/editar redes e células, sem cadastrar outras igrejas ou administrar contas. Pode liderar células de sua igreja; a chamada pessoal depende desse vínculo. Perfil e fotos continuam disponíveis como nos demais acessos.
- Não foram criadas contas reais, alteradas senhas ou excluídas chamadas reais durante os testes. Os testes SQL usaram identificadores reservados dentro de transação revertida. Cobrem os escopos por função, negação entre igrejas/organizações, cadastro de rede/célula pelo Pastor de prédio, criação de conta em modo de validação, exclusão/restauração e ausência dos registros excluídos nos relatórios. Testes locais cobrem data do dispositivo e fluxo visual com dados fictícios.

A migração conserva as colunas e dados existentes. Ela substitui a unicidade de todas as chamadas por índice único de chamadas ativas, para permitir refazer uma chamada excluída. Não concede DELETE direto a usuários e não expõe dados anônimos.


## Resumo de células por responsável — 10/11/2026

O painel agrupa células por `discipler_id` para Master, Supervisor, Pastor de prédio, Pastor de rede e Obreiro. Ao expandir o nome do discipulador, aparecem as células vinculadas. Para Discipulador o agrupamento usa `leader_id`, reunindo múltiplas células do mesmo líder. Para Líder as células continuam diretas. Os filtros de igreja/rede/período e os detalhes de cada célula são preservados; a frequência de um grupo é calculada sobre todos os registros de chamada, sem média simples de percentuais.

Células sem vínculo ficam em “Sem discipulador vinculado” ou “Sem líder vinculado”. Identificadores diferentes permanecem separados mesmo se houver nomes iguais. Os dados não são redistribuídos e nenhum vínculo é alterado pelo agrupamento.

Aplicada `202611100003_dashboard_hierarchy.sql`: o carregamento do portal inclui `cell_leadership`, somente ID/nome dos líderes/discipuladores associados às células ativas já permitidas a quem está conectado. Não inclui contatos, e-mails ou usuários, não amplia o escopo das células e não dá acesso anônimo. Isso resolve “Líder: A definir” quando o vínculo existe, mas a lista de perfis administrativos não estava disponível para a função.

Validação: testes JavaScript de agrupamento, múltiplas células por responsável, frequência ponderada, grupos sem vínculo e visão direta do líder; teste SQL com transação revertida de nomes no escopo, ausência de contatos/nomes externos e bloqueio anônimo; prévia local com expansão e abertura dos detalhes de uma célula. Nenhum cadastro real modificado.
