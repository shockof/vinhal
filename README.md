# Igreja Videira — demonstração estática

Implementação independente baseada nos requisitos da conversa. O HTML e logo mencionados em /mnt/data não estavam disponíveis nesta sessão; a marca é provisória. Todos os dados são fictícios.

## Testar
Abra https://shockof.github.io/vinhal/ ou abra index.html no navegador.
Área da liderança: escolha master, lider, discipulador, pastor, obreiro ou supervisor. Não há senha nem autenticação real. Nunca use credenciais reais.

- Master: edite título, apresentação, cor, horários e título da mensagem; salve rascunho, veja a prévia, volte ao painel e publique. Publicar altera somente o navegador atual.
- Líder: vê Oliveira; discipulador/pastor: rede Esperança; obreiro: Videira Norte; supervisor: todas as igrejas.
- Pessoas: cadastre nomes fictícios como visitante ou membro na célula disponível.
- Presenças: marque Ana em 2026-10-29 para convertê-la em membro após os encontros de 15 e 22/10. Faltas interrompem a sequência. Encontros devem ser únicos e em ordem cronológica. Todos os encontros devem ser registrados para a regra funcionar corretamente.
- Supervisor: confira relatórios por igreja/município, filtre e exporte CSV; cadastre pastor/obreiro com igreja e rede associadas.
- Restaurar demonstração apaga somente o estado fictício deste demo no navegador.

## Implementado
Página pública responsiva; células; perfis ilustrativos; buscas genéricas no Google Maps; mensagem/reflexão de exemplo. Seis painéis com escopos visuais. Cadastro de pessoas, presenças, conversão, contagens, relatórios e CSV. Associações igreja/município/rede. Rascunho/prévia/publicação local de conteúdo e aparência. Persistência em localStorage quando disponível.

## Limites
Sem servidor, autenticação, autorização real, sincronização, banco de dados, auditoria, recuperação de senha, upload de logo ou mídia. Os papéis apenas alteram a interface; qualquer visitante pode acessar os dados de demonstração. Não cadastrar pessoas reais. Não há senha Master no código. Conteúdo oficial, endereços verificados, vídeo/áudio de sermões e identidade visual original ainda precisam ser fornecidos. Cadastro de novas igrejas/redes, vínculo de múltiplas células por discipulador e políticas de conversão retroativa dependem de evolução do modelo. A edição Master não altera GitHub Pages para outros usuários.

## Publicação GitHub Pages
Settings → Pages → Source: Deploy from a branch → Branch: main → /(root) → Save. Acompanhe Actions → pages build and deployment. URL esperada: https://shockof.github.io/vinhal/.
