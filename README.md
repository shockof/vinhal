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
- Relatórios por igreja/município, filtros por igreja, rede e período, contagem de pessoas/membros/visitantes, presenças e frequência; exportação CSV.
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
