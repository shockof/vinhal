# Igreja Videira — demonstração responsiva

Site de testes: https://shockof.github.io/vinhal/

Atualizado a partir do HTML `igreja_videira_site_atualizado.html`, do logo original e dos requisitos recuperados da conversa “Improve Product UX Interface”. A identidade roxa e verde-água e a estrutura pública do protótipo foram mantidas. Todos os perfis, contatos, municípios, igrejas e endereços dos registros são fictícios. As fotografias de ambiente são imagens ilustrativas externas já usadas no protótipo original.

## Acessar
Clique em **Login** e digite um dos usuários: `master`, `supervisor`, `pastor`, `obreiro`, `discipulador`, `lider` ou `lider.norte`. Não há senha. Nenhuma senha real foi incluída no código. Não há cadastro público de contas.

## Implementado
- Site público com Início, Sobre, diretório de células filtrado por igreja/rede, mensagens/reflexão e materiais demonstrativos, endereço ilustrativo e contribuições sem pagamentos.
- Logo original no cabeçalho, login, painéis e rodapé. Navegação e gestão responsivas para computador e celular.
- Master com aba lateral Personalização do site: identidade visual, páginas inicial/sobre/células/mensagens, menu e rodapé; textos, imagens, links, visibilidade e ordem dos blocos. Cores, logo, tipografia, largura, espaçamento, cantos e metadados. Salvar rascunho, visualizar, publicar localmente e descartar.
- Pregações: YouTube/Vimeo/vídeo HTTPS ou MP4/WebM/OGG local (até 100 MB), título, pregador, data, série, descrição, capa, destaque na página inicial, editar e ocultar.
- Arquivos da Palavra: PDF/TXT/DOC/DOCX/PPT/PPTX/XLS/XLSX/MP3 local (até 20 MB) ou endereço HTTPS, título, data, categoria, descrição, editar, ocultar e baixar.
- Cadastro e edição de pessoas com nome, telefone fictício, categoria, batismo, estado civil, célula e foto local.
- Cadastro, edição, busca e desativação/reativação de acessos fictícios por username; função, igreja, rede, célula, responsável e foto. Não cria credenciais reais.
- Equipe Pastoral pública alimentada pelos cadastros ativos de supervisor, pastor e obreiro; área de líderes/discipuladores com célula, endereço fictício, mapa e link de compartilhamento. Alterações dos cadastros refletem imediatamente no site deste navegador.
- Escopos visuais: líder (células vinculadas), discipulador (células dos seus liderados), pastor (rede), obreiro (igreja), supervisor/Master (todas).
- Presença/ausência por encontro; bloqueio de datas repetidas ou fora de ordem; histórico de encontros e registros individuais; visitante convertido em membro após três encontros consecutivos com presença. Todas as reuniões precisam ser registradas para a sequência refletir a realidade.
- Visão geral com contagens calculadas e acompanhamento de células/liderados.
- Criação de igrejas/municípios e redes; criação/edição de células, horários e endereços; vínculos com líder e discipulador.
- Relatórios por igreja/município, filtros por igreja, rede e período, contagem de pessoas/membros/visitantes, presenças e frequência; exportação Excel formatada (.xlsx).
- Histórico local ilustrativo e restauração da demonstração.

## Painéis inspirados nos previews recuperados
- Tela de login com identidade roxa/verde-água e atalhos explícitos para os perfis demonstrativos.
- Gestão com barra lateral roxa, avatar de iniciais/foto local, navegação com ícones e visão específica de cada função.
- Cartões coloridos com ações de navegação; gráfico circular de frequência, evolução por encontro e últimos registros calculados a partir dos dados locais.
- Filtros de igreja, rede e período nos painéis gerais; relatório com comparação de membros/visitantes por rede e municípios clicáveis.
- Cartões de células com detalhamento; seleção visual entre novo membro e visitante; presença com status, contagem ao vivo, marcar todos/limpar e confirmação visual com destaque para conversões.
- Celular com cabeçalho roxo, cartões em duas colunas, atalhos inferiores e menu lateral para as demais funções.
- Sem fotos reais ou indicadores inventados: as iniciais e os números correspondem aos cadastros fictícios do demo.

## Testes realizados em navegador
- Login dos seis papéis principais e verificação de células/abas correspondentes.
- Rascunho sem alterar o site publicado; prévia com título alterado; publicação aplicada somente no navegador.
- Envio local de PNG para o logo do rascunho.
- Criação de pastor fictício e exibição automática de seu perfil; desativação com remoção do perfil público.
- Conversão de Ana no terceiro encontro; encontro com todos ausentes; duas presenças após falta mantendo Visitante; terceira presença após falta convertendo para Membro.
- Filtro de relatório para Videira Norte e download CSV.
- Layout de painel em 390 × 844, sem transbordamento horizontal da página.
- Verificação de sintaxe JavaScript e ausência de erros de execução capturados durante os fluxos acima.
- Painéis visuais: cartões/atalhos, detalhes de célula, marcar todos/limpar, contagem de presença e confirmação com conversão em membro.
- Seleção visual de categoria com cadastro de membro; relatórios de líder e supervisor com gráficos calculados.
- Filtros gerais por igreja, troca de papel sem herdar o filtro de outra liderança, tela vazia para célula sem encontros.
- Menu móvel, atalhos inferiores e relatório a 390 × 844 sem transbordamento horizontal da página.
- Master: salvar rascunho, sair para a prévia pública e retornar ao editor no novo layout.

- Personalização ampliada: upload real de MP4 de teste CC0, player com metadados carregados e controles, arquivo TXT com download, salvar/prévia/publicar e persistência após recarregar. Arquivos de teste retirados da biblioteca ao concluir.

## Limitações e próximos passos
Demonstração estática em GitHub Pages. Tudo é público, inclusive os dados de exemplo no código e no armazenamento do navegador. Os controles de função são apenas simulações de interface; não são autenticação nem autorização real. Não cadastrar pessoas, fotos, contatos ou senhas reais.

`Publicar neste navegador` não grava no GitHub, não modifica o site de outros visitantes e não sincroniza dispositivos. Vídeos e documentos enviados ficam no IndexedDB deste navegador, sem envio ao servidor; metadados, cadastros e imagens ficam no localStorage, sujeito ao limite e à limpeza do navegador; imagens aceitas: PNG/JPEG/WebP até 500 KB por arquivo. O histórico local pode ser alterado pelo usuário e não é auditoria de segurança.

Autenticação por username/senha, criação e recuperação de credenciais, autorização hierárquica no servidor, banco de dados, armazenamento de imagens, publicação compartilhada, auditoria e backups dependem de backend. Edição de igrejas/redes existentes, histórico retroativo e reversão de conversões ainda precisam de evolução. Os relatórios usam categorias atuais e presenças/ausências efetivamente registradas no período; não são relatórios históricos de filiação.

Nenhum endereço foi verificado: os mapas executam uma busca genérica por Igreja Videira. Vídeos/áudios, fotos oficiais, materiais, canais sociais e instruções de contribuição ainda precisam ser fornecidos. Não há pagamento, envio de mensagem nem recebimento de interesse de visitantes.

## Arquivos e publicação
`index.html`, `original.css` (estilos recuperados), `app.css`, `app.js`, `dashboard.css`, `dashboard.js`, `customize.css`, `customize.js` e `assets/logo.png`. Sem dependências de compilação.

Prévia local: `python3 -m http.server 8765 --directory . --bind 127.0.0.1`.

GitHub Pages configurado para `main` / raiz. Cada atualização da branch gera uma implantação; acompanhe em Actions → pages build and deployment. A versão anterior continua recuperável pelo histórico de commits.

## Mapa de células
Mapa interativo Leaflet 1.9.4 / OpenStreetMap na página Células, com filtros compartilhados de igreja/rede, marcadores com detalhes, enquadramento de todos os pontos e links de rota. Master/Supervisor podem cadastrar latitude e longitude públicas em Redes e células. As duas coordenadas são opcionais, mas devem ser preenchidas juntas e dentro dos limites geográficos. Células sem coordenadas ficam na lista com aviso, sem posição inventada.

As três células originais usam pontos explicitamente fictícios na região de Maceió, apenas para demonstração; não são endereços confirmados. Pontos cadastrados e alterações continuam locais a este navegador. Não há geocodificação automática ou solicitação da localização do visitante. O fundo do mapa depende da conexão com OpenStreetMap e a biblioteca é carregada via unpkg; se indisponíveis, a lista e links permanecem acessíveis. Atribuição preservada. Para uso público em escala, revisar a política de uso dos tiles e contratar provedor adequado quando necessário.

Verificado: três marcadores, filtro Videira Norte com um ponto, popup, botão Ver no mapa, rejeição de coordenada incompleta, salvar coordenadas e atualização pública, celular 390px sem transbordamento, sem erros de execução capturados. Arquivos adicionais: cell-map.js e cell-map.css.

## Kids e fotos dos eventos
Página Kids no cabeçalho, ao lado de Liderança. Conteúdo da página editável em Master > Personalização do site > Página Kids. Em Página inicial e Página Kids, o editor Fotos que passam no destaque permite selecionar várias fotos, descrever, ordenar, retirar e restaurar imagens ilustrativas. Até 8 imagens PNG/JPEG/WebP por área, 500 KB por imagem, sujeito ao espaço disponível no navegador. Segue o fluxo compartilhado de rascunho, prévia e publicação local.

Os destaques alternam a cada 6 segundos, com anterior/próxima/pausar, pausa em aba oculta, foco ou ponteiro sobre o destaque e respeito à preferência de movimento reduzido. Fotos iniciais são ilustrações existentes do protótipo, não eventos oficiais. Arquivos adicionais: slides.js e slides.css. Verificado envio de imagem, prévia Kids com três fotos, navegação entre fotos e descarte restaurando a versão publicada.

## Atualização do mapa vetorial
O mapa foi migrado de Leaflet com imagens raster para MapLibre GL JS 4.7.1 / OpenFreeMap Liberty, com renderização vetorial, zoom até 20 e tela cheia. Filtros, coordenadas, marcadores e fotos da liderança foram preservados. Depende de WebGL e conexão para carregar os dados. Sem suporte gráfico, a lista e os links Como chegar continuam disponíveis. Atribuições do provedor preservadas. Verificado zoom, filtro por igreja e popup de liderança.

## Rede Kids e funções
Rede Kids cadastrada inicialmente na Videira Centro (primeira igreja do demo), com migração aditiva dos navegadores existentes, sem substituir células ou vínculos. Não duplica a rede ao recarregar. Novas redes chamadas Rede Kids também recebem a identidade Kids. Funções exibem Pastor (a), Discipulador (a), Obreiro (a), preservando identificadores de acesso.

Logo extraída da primeira página do PDF fornecido pelo usuário, preservando a arte; arquivo assets/rede-kids.png. Marcadores e popups das células vinculadas à Rede Kids exibem essa logo automaticamente. Verificado cadastro da rede, seleção no formulário e criação de célula fictícia local Kids · Exemplo com logo no marcador e no popup. Essa célula de teste não foi incluída nos dados iniciais publicados.

## Exportação Excel pelo site
O botão dos relatórios agora gera um arquivo .xlsx real no navegador, no modelo aprovado: título e escopo da função, responsável, período selecionado e data de geração; tabela filtrável com igreja, município, células, pessoas, membros, visitantes, presenças, registros e frequência; totais por fórmula e gráfico de membros/visitantes editável. Cada arquivo contém somente o relatório do usuário atual, respeitando os filtros e o escopo visual do demo, sem incluir abas de outras funções.

Frequência total usa soma de presenças / soma de registros, não média das porcentagens. Sem registros exibe —. Período invertido bloqueia a exportação. Nomes são texto literal, nunca fórmulas; sem macros ou vínculos externos. Geração local, sem dependência de serviço ou biblioteca externa. Arquivo adicional: reports-excel.js.

Validado com downloads reais de supervisor, pastor, obreiro e discipulador; filtro por igreja e período, incluindo uma única data; arquivo sem registros de presença; integridade ZIP/XML; leitura de fórmulas e valores por leitor independente; tabela com filtros e gráfico nativo; renderização do Excel baixado. Conferida preservação do destaque de navegação e da transição de fotos. A segurança por função continua sendo uma simulação local, sem backend.


## Gestão conectada ao Supabase — 08/11/2026

Acesse `gestao.html` ou o botão Login do cabeçalho. A demonstração permanece separada no rodapé. Não há importação automática dos exemplos.

Implementado: autenticação por username/senha via Edge Function, consulta por perfil com RLS, cadastro/edição de igrejas e município, redes (incluindo Kids), células e vínculos, pessoas, encontro/presenças com conversão transacional após três presenças consecutivas; relatório Excel com dados reais autorizados e filtros. O Master pode cadastrar líderes, discipuladores, pastores de rede e obreiros na aba Contas e liderança, com acesso Auth e vínculos validados no servidor.

Sessão somente em memória; recarregar exige novo login. Senhas não são persistidas no navegador. A chave no arquivo gestao-config.js é anon pública, nunca service_role. A função mantém Verify JWT with legacy secret ativo usando a chave anon na borda; a sessão do usuário segue em X-Videira-Session e é validada no Supabase Auth. Todas as operações do portal consultam RLS com o JWT do usuário. A busca privada de username/e-mail e o limite de tentativas somente podem ser executados pelo servidor. O esquema videira permanece fora da exposição direta da Data API.

Pendente: recuperação de senha e manutenção/desativação administrativa de contas pelo site, MFA, compartilhamento/publicação real do CMS e materiais/fotos, backup/restauração testados. A personalização e os arquivos do painel demonstrativo continuam locais. O diretório público e os dados internos não foram unidos. A chave anon legada exige migração antes da retirada anunciada pelo Supabase para 2027; a chave pública nova não funciona com a verificação JWT legada ativa.

Testes: funções SQL com seis perfis e dois tenants; criação e edição em transações descartadas, presença via API, consulta anônima e busca de login negadas, limite de tentativas, validação sintática JS e rejeição real de login inexistente pelo navegador. O primeiro login pessoal deve ser feito pelo responsável; senha não acessada pelo agente.


## Cadastro de liderança pelo Master — 09/11/2026

Aba Contas e liderança: nome, username único, e-mail, função, igreja, rede e senha inicial com confirmação (12–128 caracteres). Somente Master ativo pode criar contas, incluindo Master e Pastor Supervisor, conforme atualização abaixo. Obreiro tem escopo de igreja; pastor de rede tem escopo de rede; líderes e discipuladores precisam ser vinculados às células após a criação. E-mail/senha não são incluídos no perfil ou na listagem. A senha é enviada somente para a autenticação do Supabase, sem armazenamento no código/localStorage/logs. Não há envio automático de e-mail. O Master entrega os dados iniciais por um meio privado. A aba Meu perfil permite trocar a própria senha; recuperação sem a senha atual segue pendente.

O gateway valida a sessão com Auth e a função Master com RLS antes de chamar a API administrativa. Pré-valida nome de usuário, função, igreja e rede no servidor; a organização vem do Master. Após criar Auth, grava o perfil e audita o autor. Se o vínculo falhar de forma confirmada, tenta reverter apenas a nova identidade criada naquela requisição; em falha de rede ou compensação pendente, informa conferência administrativa em vez de repetir a criação. Contas preexistentes não são substituídas.

Migração 202611090001_leadership_accounts aplicada. Testes SQL em rollback: quatro funções, isolamento, vínculos obrigatórios, usuário repetido, auditoria e bloqueio de chamadas diretas pelo cliente/anon. Testes do gateway com rede simulada: Master, recusa de outras funções, pré-validação, conflito de e-mail e compensação. Interface testada com dados locais descartáveis: filtros, escopo do obreiro, senhas divergentes e retorno de sucesso. Nenhuma conta real foi criada pelo agente para testar.


## Local da célula — 09/11/2026

Criação/edição de células na gestão real: botão Usar localização do aparelho (pedido pontual, alta precisão quando disponível, prazo de 15s, sem rastreamento), CEP de oito dígitos com consulta automática e opção Buscar CEP, rua, número, complemento, bairro, cidade e UF. Coordenadas podem ser conferidas por link no Maps ou alteradas manualmente. O retorno do aparelho informa precisão estimada em metros. CEPs carregam posição aproximada quando a BrasilAPI fornece coordenadas; não identificam a residência/número exato. Se o serviço não fornecer coordenadas, o endereço é preenchido e a tela pede localização do aparelho ou ajuste manual, sem inventar um ponto.

Somente o CEP é enviado a BrasilAPI CEP V2 (fallback ViaCEP para endereço). Coordenadas do aparelho e número da residência não são enviados a esses serviços. O link Maps compartilha a posição somente quando acionado pelo usuário. Captura não salva automaticamente: a gravação é feita pelo botão Salvar no Supabase, mantendo a posição/endereço internos e o RLS. Não publica local residencial no site. Endereços antigos são preservados. Coluna privada address_details guarda componentes, origem (cep/device/manual) e precisão informada. Alterar CEP invalida a coordenada anterior derivada de CEP, mas preserva um ponto do aparelho ou manual. Respostas atrasadas não substituem uma posição escolhida depois.

Validações: teste unitário do controlador (CEP, GPS simulado e negado, respostas atrasadas, ausência de coordenadas, privacidade dos parâmetros), teste SQL com rollback (preservação de texto/coords antigos, componentes e origem/precisão, formato de CEP e permissões), navegador com consulta real do CEP público 01001-000, captura de aparelho simulada e gravação/reabertura em fixture local. Não foi capturada a localização real do responsável para testar.

Fontes: https://brasilapi.com.br/docs#tag/CEP-V2 e https://viacep.com.br/


## E-mail opcional e funções administrativas — 09/11/2026

E-mail de contato opcional no formulário e no gateway. Sem e-mail, Auth recebe um identificador aleatório não entregável no domínio reservado accounts.videira.invalid; ele fica apenas no Auth e na consulta privada de login, sem ser mostrado à pessoa. Login segue por username/senha e não envia mensagens. Contas existentes não são alteradas.

Somente Master ativo pode criar os seis cargos, agora incluindo Master e Pastor (a) Supervisor (a). Os dois cargos globais recebem a própria organização do ator e church/network nulos, sem exigir igreja cadastrada. Pastor Supervisor mantém o escopo e permissões já existentes de supervisor; não ganha criação de contas. Igreja/rede continuam obrigatórias conforme a função para líderes, discipuladores e pastores de rede, e igreja para obreiros. O formulário esconde vínculos locais nas funções globais. Sem e-mail, não há endereço de contato para uma futura recuperação por e-mail; troca da própria senha está disponível em Meu perfil; recuperação segue pendente.

Migração 202611090003_optional_email_admin_roles aplicada. Testes SQL dos seis cargos, vínculo global, isolamento/auditoria e recusa a outros administradores/cliente anônimo, todos em rollback. Teste do gateway sem e-mail verifica identificador aleatório, ausência de credenciais no perfil/resposta e fluxo existente. Teste de interface local criou Master sem e-mail e sem igrejas (simulado), sem bloquear a validação HTML. Nenhuma conta administrativa real foi criada pelo agente.


## Master e Pastor Supervisor como líderes — 09/11/2026

A seleção Líder no cadastro/edição de células inclui Master e Pastor Supervisor ativos da própria organização, mesmo sem vínculo fixo de igreja/rede no perfil. Líderes comuns e discipuladores continuam limitados à igreja/rede correspondente; os seletores filtram esses vínculos. Na aba Presenças, Master e Supervisor recebem apenas as células em que leader_id corresponde à própria conta. A operação de gravação no banco exige esse mesmo vínculo para esses dois cargos. Visão geral, leitura e relatórios mantêm o escopo administrativo. Outras funções mantêm as regras anteriores.

Migração 202611090004_admin_cell_leaders aplicada. Testes SQL com rollback: vínculo Master/Supervisor e chamadas próprias passam; chamadas sem vínculo e vínculos com outra organização/inativos são rejeitados; acompanhamento administrativo permanece. Interface com fixture local: dois grupos na visão geral, somente a própria célula na seleção de chamada, Master/Supervisor na lista de líderes. Nenhum vínculo ou encontro real foi alterado para testar.


## Organização e filtro das contas — 09/11/2026

Contas vinculadas ordenadas por Master, Pastor Supervisor, pastores de rede/obreiros (mesmo nível), discipuladores e líderes. Dentro de cada nível, ordem alfabética pt-BR, com username como desempate. Filtro por função com Todas as funções e contador de resultados. Filtrar atualiza apenas a tabela e o contador, preservando o formulário de cadastro em preenchimento. Nenhuma alteração de cadastros/permissões no banco. Conferido no navegador com sete contas fictícias em ordem embaralhada, nomes acentuados, filtro de discipulador e preservação de campo não salvo.


## Filtro de contas por igreja — 09/11/2026

Filtro Filtrar por igreja ao lado do filtro de função. Os critérios são combinados (AND), mantendo a hierarquia, ordem alfabética e contador. Todas as igrejas desativa o filtro; uma igreja específica seleciona o vínculo church_id; Acesso a todas (Master/Supervisor) reúne contas globais desses cargos. Filtros atualizam somente a lista, preservando cadastro não salvo. Verificado no navegador com quatro perfis fictícios de duas igrejas, combinação função+igreja, ausência de resultados e contas globais. Nenhuma mudança no banco/permissões.


## Meu perfil para todas as funções — 09/11/2026

Aba Meu perfil em Master, Pastor Supervisor, pastor de rede, obreiro, discipulador e líder. Edição do próprio nome, telefone, e-mail de contato opcional e foto; username permanece fixo. E-mail de contato é separado da identidade Auth e não muda o login por username nem envia confirmação por e-mail. Telefones/e-mails ficam em tabela privada sem leitura direta pelo cliente; não se tornam diretório público. Alterações de cargo, organização, estado e vínculos são ignoradas/negadas no fluxo de perfil.

Fotos JPG/PNG/WebP de até 8 MB são recortadas ao centro/reduzidas a 512px e convertidas em JPEG pelo navegador. Upload normalizado limitado pelo gateway, bucket videira-avatars privado, políticas por UUID do próprio usuário ativo, caminhos imutáveis, URL assinada de uma hora apenas para a foto própria. Foto antiga é removida após confirmação da gravação e nova foto é compensada em falha confirmada de gravação. Foto não é publicada no site automaticamente. Só gravar após Salvar meu perfil.

Senha em formulário separado: atual, nova (12–128 caracteres) e repetição. Gateway usa o endpoint de usuário do Supabase Auth com JWT do próprio usuário e current_password; não usa troca administrativa. Após sucesso, revoga as sessões de refresh e volta ao login. Tokens JWT já emitidos seguem as regras de expiração do Supabase. Não guarda senhas em perfil, logs, código ou armazenamento do navegador. O usuário digita/submete as senhas diretamente; nenhuma senha real foi acessada/alterada pelo agente.

Migração 202611090005_my_profile aplicada. Testes SQL em rollback para seis funções, escopo próprio, rejeição de foto de outro usuário, ausência de autopromoção, fotos/contatos privados, contas inativas e anon. Testes do gateway com rede simulada verificaram campos permitidos, upload/URL privada, senha atual no endpoint certo e falha de senha. Interface local de discipulador: foto PNG de teste preparada, nome/telefone/e-mail/foto salvos e reabertos, senhas divergentes bloqueadas, sucesso simulado retorna ao login. Contas existentes preservadas. Documentação de segurança: https://supabase.com/docs/guides/auth/password-security


## Edição de contas e link do Maps — 10/11/2026

Master encontra Editar conta na lista de contas vinculadas, inclusive após filtrar. Modal permite nome, username, telefone, e-mail de contato, função, igreja/rede e ativação. Mudanças são validadas no servidor e auditadas. Não permite retirar o próprio cargo Master/desativar a própria conta. Mudança de função/escopo incompatível com células vinculadas exige revisar os vínculos primeiro; impede acesso a contas de outra organização. Contatos editados não alteram o e-mail da identidade Auth; o login segue username.

Redefinição de senha de outra conta em formulário separado: exige senha atual do Master e confirmação da nova senha. Servidor verifica o Master no Auth, limita tentativas, usa atualização administrativa apenas para o UUID autorizado e registra sucesso sem credenciais. Senhas não são enviadas à função SQL nem retornadas ao navegador/logs. A própria senha segue Meu perfil. Sessões já emitidas do destinatário obedecem à validade do Supabase; o fluxo não promete encerramento instantâneo de todos os JWTs.

Local da célula aceita link HTTPS do Google Maps. Servidor resolve links curtos maps.app.goo.gl/goo.gl/maps, revalidando hosts/path em cada redirecionamento (sem proxy arbitrário). Lê coordenadas de ponto em query/!3d!4d e a rua quando escrita no endereço do link. Não confunde centro de viewport /@ com ponto de residência. Importar substitui os componentes obtidos; número/complemento permanecem para o usuário. Rua não é presumida a partir de nomes de estabelecimentos. Links e endereços permanecem internos.

**Limitação atual:** não há projeto/chave de Google Maps Platform. Links só com coordenadas importam o ponto, mas a rua deve ser digitada ou obtida via CEP. Para geocodificação oficial, o gateway já suporta GOOGLE_MAPS_API_KEY exclusivamente no ambiente do servidor, com Geocoding API habilitada e faturamento/cotas configurados pelo proprietário. Nenhuma chave foi criada/colocada no repositório e nenhum faturamento foi ativado. Nem todo link contém endereço ou ponto; links incompletos/direções/viewport devem ser substituídos por Compartilhar local ou ajuste manual. Não faz scraping de páginas HTML do Google.

Migração 202611090006_admin_edit_and_maps aplicada. Testes SQL em rollback: edição/contato/desativação, própria conta Master protegida, escopos vinculados e organizações, supervisor sem edição, metadados Maps. Gateway simulado: autorização, prova de senha Master, limite, ausência de senhas em SQL, parsing/endereço/coord, número manual, host e redirecionamento inseguros. Interface local: edição refletida na lista, senhas divergentes bloqueadas, reset simulado, rua importada e número vazio. Nenhuma senha real ou conta real foi alterada para testes. Fontes oficiais: https://developers.google.com/maps/documentation/urls/get-started e https://developers.google.com/maps/documentation/geocoding/start-v4
