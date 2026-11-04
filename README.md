# Igreja Videira — demonstração responsiva

Site de testes: https://shockof.github.io/vinhal/

Atualizado a partir do HTML `igreja_videira_site_atualizado.html`, do logo original e dos requisitos recuperados da conversa “Improve Product UX Interface”. A identidade roxa e verde-água e a estrutura pública do protótipo foram mantidas. Todos os perfis, contatos, municípios, igrejas e endereços dos registros são fictícios. As fotografias de ambiente são imagens ilustrativas externas já usadas no protótipo original.

## Acessar
Clique em **Login** e digite um dos usuários: `master`, `supervisor`, `pastor`, `obreiro`, `discipulador`, `lider` ou `lider.norte`. Não há senha. Nenhuma senha real foi incluída no código. Não há cadastro público de contas.

## Implementado
- Site público com Início, Sobre, diretório de células filtrado por igreja/rede, mensagens/reflexão e materiais demonstrativos, endereço ilustrativo e contribuições sem pagamentos.
- Logo original no cabeçalho, login, painéis e rodapé. Navegação e gestão responsivas para computador e celular.
- Master com título, apresentação, horários, cores principal/destaque/fundo/botões, logo, banner, imagem/textos da visão, título/reflexão da pregação e informação de contribuições. Fluxo separado de salvar rascunho, visualizar, publicar localmente e descartar.
- Cadastro e edição de pessoas com nome, telefone fictício, categoria, batismo, estado civil, célula e foto local.
- Cadastro, edição, busca e desativação/reativação de acessos fictícios por username; função, igreja, rede, célula, responsável e foto. Não cria credenciais reais.
- Equipe Pastoral pública alimentada pelos cadastros ativos de supervisor, pastor e obreiro; área de líderes/discipuladores com célula, endereço fictício, mapa e link de compartilhamento. Alterações dos cadastros refletem imediatamente no site deste navegador.
- Escopos visuais: líder (células vinculadas), discipulador (células dos seus liderados), pastor (rede), obreiro (igreja), supervisor/Master (todas).
- Presença/ausência por encontro; bloqueio de datas repetidas ou fora de ordem; histórico de encontros e registros individuais; visitante convertido em membro após três encontros consecutivos com presença. Todas as reuniões precisam ser registradas para a sequência refletir a realidade.
- Visão geral com contagens calculadas e acompanhamento de células/liderados.
- Criação de igrejas/municípios e redes; criação/edição de células, horários e endereços; vínculos com líder e discipulador.
- Relatórios por igreja/município, filtros por igreja, rede e período, contagem de pessoas/membros/visitantes, presenças e frequência; exportação CSV.
- Histórico local ilustrativo e restauração da demonstração.

## Testes realizados em navegador
- Login dos seis papéis principais e verificação de células/abas correspondentes.
- Rascunho sem alterar o site publicado; prévia com título alterado; publicação aplicada somente no navegador.
- Envio local de PNG para o logo do rascunho.
- Criação de pastor fictício e exibição automática de seu perfil; desativação com remoção do perfil público.
- Conversão de Ana no terceiro encontro; encontro com todos ausentes; duas presenças após falta mantendo Visitante; terceira presença após falta convertendo para Membro.
- Filtro de relatório para Videira Norte e download CSV.
- Layout de painel em 390 × 844, sem transbordamento horizontal da página.
- Verificação de sintaxe JavaScript e ausência de erros de execução capturados durante os fluxos acima.

## Limitações e próximos passos
Demonstração estática em GitHub Pages. Tudo é público, inclusive os dados de exemplo no código e no armazenamento do navegador. Os controles de função são apenas simulações de interface; não são autenticação nem autorização real. Não cadastrar pessoas, fotos, contatos ou senhas reais.

`Publicar neste navegador` não grava no GitHub, não modifica o site de outros visitantes e não sincroniza dispositivos. Cadastros e imagens ficam no localStorage, sujeito ao limite e à limpeza do navegador; imagens aceitas: PNG/JPEG/WebP até 500 KB por arquivo. O histórico local pode ser alterado pelo usuário e não é auditoria de segurança.

Autenticação por username/senha, criação e recuperação de credenciais, autorização hierárquica no servidor, banco de dados, armazenamento de imagens, publicação compartilhada, auditoria e backups dependem de backend. A configuração de todos os textos e imagens de cada seção, edição de igrejas/redes existentes, histórico retroativo e reversão de conversões ainda precisam de evolução. Os relatórios usam categorias atuais e o conjunto atual de pessoas como denominador; não são relatórios históricos de filiação.

Nenhum endereço foi verificado: os mapas executam uma busca genérica por Igreja Videira. Vídeos/áudios, fotos oficiais, materiais, canais sociais e instruções de contribuição ainda precisam ser fornecidos. Não há pagamento, envio de mensagem nem recebimento de interesse de visitantes.

## Arquivos e publicação
`index.html`, `original.css` (estilos recuperados), `app.css`, `app.js` e `assets/logo.png`. Sem dependências de compilação.

Prévia local: `python3 -m http.server 8765 --directory . --bind 127.0.0.1`.

GitHub Pages configurado para `main` / raiz. Cada atualização da branch gera uma implantação; acompanhe em Actions → pages build and deployment. A versão anterior continua recuperável pelo histórico de commits.
