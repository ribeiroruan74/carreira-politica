# ARCHITECTURE.md — Carreira Política

> **Progresso da expansão:** FASE 0 ✅ · Pré-fases P1–P4 ✅ ·
> **Bloco A** (6,2,31,29) ✅ · **Bloco B** (18-21) ✅ · **Bloco C** (5,9,10,13,12) ✅ ·
> **Bloco D** (8,17,22,23,24) ✅ · **Bloco E** (D1 refactor, 25, 26) ✅ ·
> **Bloco F** (14, 15, 16, 27, 28) ✅ · **Bloco G** (30, 32–37) ✅ — testados 31/08. Save v12.
> **Fase 6 — BALANCEAMENTO + CORREÇÕES** (13 etapas) ✅ — testada 31/08. Save v15.
> **Fase 7 — NOVA RODADA DE CONTEÚDO + VARIAÇÃO** (24 itens) ✅ — testada 01/09. Save **v20**.
> **Fase 8 — EXPANSÃO + BALANCEAMENTO + UI** (10 prioridades) ✅ — Agenda/UI hub/fama/cargos/
> relações/projetos/gabinete/finanças/mídia real/crises sazonais+CPI. Save **v21** (energia
> vira recurso único máx 15; XP de atributos removido).
> **Fase 9 — REBUILD + NOVOS SISTEMAS** (10 focos) ✅ — hub visual estilo life sim, mini-jogos,
> políticos/personalidades reais (CSV), atributos por dinheiro, serviços de estilo de vida,
> autofinanciamento + bens, estabilização de decaimentos, conversar com assessor.
> **As 39 fases + Fases 6–9 estão implementadas.** Refinamento de UI segue contínuo
> e dependente de playtest humano.

Plano/auditoria original (rebuild): https://claude.ai/code/artifact/a59a51d2-6707-4209-9ec4-c3c999e9a07c
Backlog de funcionalidades: https://claude.ai/code/artifact/45fe2859-f397-4679-82ba-0b5992becd9a
Relatório da FASE 0 (matriz das 39 fases): https://claude.ai/code/artifact/ac8153df-a778-45e6-8a3e-9aeac64faeaf

---

## 1. Visão geral

App React (Vite) **100% client-side**. Sem servidor em runtime. Toda a
simulação roda no navegador; save em IndexedDB. `backend/` e `scripts/` no repo
são **só toolchain de dados** (processar CSV do TSE) — não são usados pelo jogo.

- **Build:** `cd frontend && npm run dev` (ou `npm run build`). Passa limpo.
- **Bundle:** ~384 KB / ~119 KB gzip. ~3.300 linhas de engine+state, ~1.400 de UI, ~1.400 de conteúdo JSON.
- **Debug:** em DEV, `window.__game` expõe o store Zustand.

## 2. Estrutura de arquivos

```
frontend/src/
  engine/            (motor — funções puras, determinísticas)
    rng.js           PRNG mulberry32. Estado = 1 uint32 em meta.rngState (retoma O(1)).
                     streamRng(seed, rótulo, ...) = stream independente por rótulo.
    tick.js          runTick(s): 1 mês — tempo, finanças, decaimentos, série histórica.
                     [Fase 6] custoPolitico mensal por cargo eletivo (VER 4,5k / DEP_EST 9k /
                     DEP_FED 12k / PREF 11k) abatido do saldo pessoal.
    world.js         worldTick(s): mundo político — ~39 NPCs com IA, partidos, alianças,
                     disputa interna, feed de notícias, evento de cidade.
                     [Fase 6] fatorRelacao(state,p,tipo) 0.25-1.7 + acaoRelacao/ACOES_RELACAO;
                     limiarAlianca/chanceAlianca/tentarAlianca/romperAlianca/tickAliancas;
                     popularidade do partido do jogador pesa relevanciaMidiatica + cargo.
    mandate.js       iniciarMandato + mandateTick + projetos/sessões/gabinete/fiscalização.
                     [Fase 6] temaCanonico() + cumprirPromessas (match tema+bairro → 100%);
                     multGabinete(state,area) 0.85-1.75 (consumido em social/press/world/actions);
                     mandateTick reversão à média mais forte + desgaste de mandato.
    election.js      iniciarEleicao + tickEleicao (campanha 5 meses) + finalizarEleicao.
    voteModel.js     jogadorComoCandidato + estimarVotos (softmax de propensão
                     cand×grupo×bairro) + apurar (quociente + D'Hondt + cláusula).
    candidates.js    gerarChapa — 130-190 candidatos (20 reais TSE + procedural).
    events.js        sortearEvento + resolverEvento (crises com escolha, cooldown, memória).
    social.js        postar — Instagram, 5 formatos × 5 pautas, viralização cauda longa.
                     [Fase 6] relevanciaMidiatica(state) 0-100 (notoriedade+audiência+
                     repercussão+cargo) — presença de mídia, NÃO é voto; alimenta partido e convites.
    press.js         tomCobertura + concederEntrevista.
                     [Fase 6] convitesMidiaAtivos/tickConvitesMidia — mundo.convitesMidia[]
                     (chance e teto escalam com relevanciaMidiatica + gabinete de comunicação).
    jobs.js          empregos — salário, horas/mês, promoção, aumento, freela.
    career.js        objetivoDaFase + aplicarObjetivo (transições VIDA→...→MANDATO).
    actions.js       acoesDisponiveis (leque mensal) + aplicarAcao (registry de efeitos — P3).
                     [Fase 6] pools próprios por cargo: MANDATO roteia por mandato.cargo
                     (VEREADOR→mandato.json, PREFEITO→prefeito.json, DEPUTADO*→deputado.json) +
                     MANDATO_COMPARTILHADAS + midia.json + AUTOCUIDADO. pesoContextual(a,state)
                     tempera o leque da Agenda. Efeitos entregaLocal/gabineteBonus/treinarAtributo.
    sim.js           harness de simulação em lote (jogador-IA) p/ calibrar dificuldade.
    runMonth.js       [Bloco A] pipeline mensal único — usado pelo store E pelo sim.
    calendar.js       [Bloco A/F6] ciclo eleitoral fixo (4 anos), janela de candidatura,
                      fim de mandato na eleição, pleito que acontece à revelia do jogador.
    worldMemory.js    [Bloco A/F2] registrarFato() com gatilho → tickMemoria() dispara
                      investigações/cobranças meses depois. "Promessa do ano 1 volta no ano 4."
    cascade.js        [Bloco A/F31] semear() planta uma cascata → tickCascatas() avança
                      1 estágio/mês (ignorar bairro → líder reclama → jornal → rival → viral).
    coalitions.js     [Bloco B/F20] formarColigacoes() — federações fixas + coligações
                      ad-hoc por ideologia. apurar() calcula o quociente por coligação.
    electorate.js     [Bloco D/F8] mundo.satisfacaoGrupos por grupo social — impactoDeTema()
                      sobe, tickEleitorado() decai/deriva. Termo na voteModel.propensao.
    national.js       [Bloco D/F24] content/national.json — evento macro cria mundo.nacional.clima
                      que tempera grupos (F8) e popularidade dos partidos.
    donors.js         [Bloco D/F17] financas.doadores[] com setor+interesse+risco. captarDoacao()
                      registra origem; tickDoadores() → cobrança de contrapartida ou investigação.
    militancy.js      [Bloco D/F23] personagem.militancia{bairro:n} — recrutarMilitancia() /
                      tickMilitancia() sustenta presença passiva e multiplica campanha no bairro.
    personal.js       [Bloco D/F22] personagem.vida{saude,...} — saúde define energiaMax; eventos
                      de vida raros. cuidarDeSi() na Agenda.
    offices.js        [Bloco E/D1] cargos.json + cidades + estado-pe.json — cargoPorId(),
                      unidadesCircunscricao(), cadeirasDoCargo(), usaSegundoTurno(),
                      cidadesDisponiveis(). Fim do hardcode de cidade/cargo.
    voteModel.js      [Bloco E] estimarVotos/apurar parametrizados por cargo. apurarMajoritario()
                      (mais votado + 2º turno). jogadorComoCandidato(state, cargoId).
    election.js       [Bloco E] iniciarEleicao(state, cargoId). tickEleicao com turno 1/2.
                      finalizarTurno() → PROPORCIONAL (quociente) ou MAJORITARIO (2 turnos).
    image.js          [Bloco F/F14] personagem.imagem (4 eixos) — puro. bonusImagemGrupo()
                      alimenta voteModel; preferenciaImagem() é heurística por grupo.
    podcasts.js       [Bloco F/F14] content/podcasts.json — gravarPodcast(state, id, postura)
                      move imagem + satisfação de nicho + notoriedade. Ação em midia.json.
    influencers.js    [Bloco F/F15-16] content/influencers.json → mundo.influenciadores vivo:
                      cache/alcance/relação/humor. cultivar/colaborar (Agenda) + contratar
                      (Instagram). tickInfluenciadores: rivais capturam, hostis atacam.
                      [Fase 6/E12] 6 reais (só trabalho público, eixo 0) + 10 fictícios. Guards
                      real:true — sem captura por rival, sem ataque hostil, collab exige relação
                      alta, custo nacional ~5x. Efeito = alcance/notoriedade/repercussão, nunca voto.
    achievements.js   [Bloco F/F27] CONQUISTAS[] com cond pura. checarConquistas() no tick.
    milestones.js     [Bloco F/F28] state.marcos[] — registrarMarco() + tickMarcos() (deriva
                      do log). Anotados como linhas verticais na Sparkline (aba Pesquisas).
    attributes.js     [Fase 6/E10] engine/attributes.js — 7 atributos treináveis, ganharXp() +
                      custoNivel() (ponto a cada limiar, teto 92), progressoAtributo().
                      XP passivo em aplicarAcao (ação de custo≥2 → +2-6 xp no atributo-peso).
    family.js         [Fase 6/E11] acaoFamilia(state, nome) (wrapper que cria rng internamente),
                      7 ações leves, tickFamilia(). personagem.vida expandida (estadoCivil,
                      conjuge{nome,relacao}, filhos, saude, bemEstar, paisRelacao). Aba Familia (👪).
    party.js          [Fase 7/I1] janela partidária, receptividade, negociar/trocar/sair,
                      partidoHistorico[]. articularColigacao (I12) força parceiro na
                      coligação do jogador via coalitions.formarColigacoes.
    phone.js          [Fase 7/I10] contatosTelefone (jornalistas+famosos) + ligar() —
                      desfechos variados, convite de entrevista, relação com decaimento.
    intel.js          [Fase 7/I5] pesquisarBairro/Grupo/Rival, analisarTendencias,
                      eleitoradoPotencial, forcasEfraquezas, temasPopulares, sugerirProjetos
                      ("O que devo propor?"). Importa temaCanonico de mandate (sem ciclo).
    assets.js         [Fase 7/I16-17,21] empresas fictícias (comprar/criar/investir/vender,
                      conflito de interesse via registrarFato), instituições nomeáveis
                      (fundar/ampliar — impacto social → legado, nunca voto), investimento
                      financeiro passivo (3 perfis de risco).
    endgame.js        [Bloco G/F30] checarFimDeJogo() no tick — idade 75+/78, saúde, derrota
                      terminal (3 derrotas + partido de costas), escândalo fatal, ou escolha.
                      arquivarMandato() acumula em personagem.legado. montarBiografia() +
                      "veredito da história" (título + nota 0-100). runMonth para se fimDeJogo.
    (P3) actions.js   EFEITOS{} + ORDEM_EFEITOS[] + registrarEfeito() — registry de
                      handlers; adicionar efeito = adicionar entrada, sem tocar no loop.
    (P2) ui/shell/ModalHost.jsx — decide QUAL modal aparece por prioridade
                      (apuração > crise > resumo do mês). Um só por vez.
  state/
    schema.js        emptyState() + migrações (SAVE_VERSION = 15) + migrar().
    newGame.js       novoJogo(opcoes) — estado inicial.
    store.js         Zustand + persist(IndexedDB). avancarMes / aplicar / resolverEventoAtual.
  content/           (data-driven — sem lógica)
    balance.json  attributes.json  professions.json  parties.json (16)
    electorate.json (12 grupos)  contacts.json  politicians.json
    jobs.json  staff.json  laws.json  crises.json (16)  press.json
    candidates-recife.json (20 reais)  candidate-gen.json  tutorial.json (11 dicas)
    neighborhoods/{recife,olinda}.json (25 / 14 bairros)
    actions/{etapa1,campanha,politica,mandato,midia,prefeito,deputado}.json
    [Fase 6] cargos.json · estado-pe.json · podcasts.json · influencers.json (6 reais + 10 fict.)
  ui/
    shell/  AppShell · TopBar · TabBar · Dashboard · CriseModal · TickEventos · tabsConfig
            · ModalHost · BiografiaFinal
    tabs/   CriarPersonagem · Personagem · Agenda · Eleicao · Mandato · Gabinete ·
            Pessoas · Mapa · Politica · Instagram · Imprensa · Pesquisas · Financas ·
            Historico · Config · ResultadoEleicao · Familia (👪) · Conquistas (🏆) ·
            [Fase 7] Telefone (📞) · Negocios (🏢)
    components/  FichaPolitico (modal de qualquer ator político)
    components/  primitives.jsx (Card/Stat/Meter/Pill/Sparkline/PageHead) · DicaTutorial
```

## 3. Fluxo de um mês (`store.avancarMes`)

```
if (eventoPendente) return;                      // crise trava o avanço
work = structuredClone(estado)                   // UM clone
runTick(work)         → tempo, renda, decaimentos, série
worldTick(work)      → NPCs agem, partidos, prefeito, notícias
tickCalendario(work) → o ciclo eleitoral acontece à revelia do jogador
tickMemoria(work)    → fatos antigos que voltam (investigação/cobrança)
tickCascatas(work)   → cascatas de narrativa em andamento
mandateTick(work)    → verba, base×oposição, comissões, sessão, projetos, promessas
tickEleicao(work)    → mês de campanha (se em eleição)
tickAliancas / tickConvitesMidia / tickFamilia / tickInfluenciadores  → [Fase 6]
sortearEvento(work)  → talvez uma crise para o mês
set({ estado: work })   // via engine/runMonth.js
```
Cada `store.aplicar(fn)` (ação do jogador) faz **1 structuredClone** e roda `fn`.

## 4. Forma do estado (save)

`meta`(seed,rngState,version,dificuldade) · `tempo`(mes,pontosRestantes,energia) ·
`personagem`(fase,cargoAtual,partidoId,atributos,skills,emprego,grupoPolitico,
historicoPolitico) · `financas`(4 caixas + renda/custoVida) ·
`reputacao`(aprovacao,confianca,rejeicao,notoriedade,ecoMidiatico) ·
`redes`(seguidores,alcance,engajamento) · `relacionamentos.pessoas{}` ·
`territorio.porBairro{}` · `mundo`(politicos{},partidosRuntime{},noticias[],
aliancas[],memoria[],crisesHistorico{}) · `eleicao` · `eventoPendente` ·
`mandato`(gabinete,projetos[],sessoes[],promessas[],indicadores,relacaoPrefeitura) ·
`series[]` · `log[]` · `flags`.

**Fases do personagem:** `VIDA → VIDA_PUBLICA → PARTIDO → CANDIDATO → MANDATO`.
Cargos jogáveis: **VEREADOR, PREFEITO, DEPUTADO_ESTADUAL, DEPUTADO_FEDERAL** (+ reeleição),
cada um com pool de ações próprio. GOVERNADOR/SENADOR ficam para expansão futura.

## 5. O que está PRONTO e sólido (não reconstruir)

| Sistema | Onde |
|---|---|
| RNG determinístico, retomável em O(1) | `engine/rng.js` |
| Pipeline de tick + store + `structuredClone` único | `state/store.js`, `engine/tick.js` |
| Save/load IndexedDB + migrações versionadas + export/import | `state/schema.js`, `state/store.js` |
| Modelo de votos (softmax de propensão, `T=2.2`), escala realista (~950k válidos, quociente ~24k) | `engine/voteModel.js` |
| Geração de chapa (130-190 candidatos, 20 reais do TSE) | `engine/candidates.js` |
| Mandato: gabinete, projetos, sessões, promessas, fiscalização | `engine/mandate.js` |
| Motor de crises com escolha + modal bloqueante | `engine/events.js`, `ui/shell/CriseModal.jsx` |
| Instagram + algoritmo de viralização de cauda longa | `engine/social.js` |
| Imprensa: veículos com tom dinâmico + entrevista (roll simples) | `engine/press.js` |
| Território de Recife (25 bairros) + cartograma | `content/neighborhoods/recife.json`, `ui/tabs/Mapa.jsx` |
| Mundo político persistente: ~39 NPCs com IA, partidos como entidades | `engine/world.js` |
| Empregos (salário/horas/promoção) | `engine/jobs.js` |
| Tutorial progressivo (11 dicas) | `content/tutorial.json`, `ui/components/DicaTutorial.jsx` |
| Harness de simulação em lote | `engine/sim.js` |
| Sistema de design (tema claro/escuro, tokens) | `src/index.css` |

## 6. Riscos de performance (identificados na FASE 0)

1. **Assinatura ampla no React.** Cada aba faz `useGame((g) => g.estado)` — qualquer
   `set()` re-renderiza a aba ativa inteira (~5-15ms hoje com 39 NPCs + 80 notícias).
   Piora com FASE 22-25. → **usar seletores/`useShallow` por aba.**
2. **`estimarVotos` é O(bairros × grupos × candidatos).** 48ms com 134 candidatos.
   Eleição estadual (FASE 25) com ~200 unidades × 12 grupos × 500 candidatos ≈ 30×.
   → **otimizar antes da FASE 25** (bucketing espacial / grão mais grosso).
3. **`world.js agirPolitico` faz `Object.values(politicos)` dentro do loop por NPC** →
   O(n²). Ok em 39; refatorar antes de escalar o número de atores.
4. **`structuredClone` do estado inteiro** a cada ação. ~5ms com 55KB. FASE 2/17/22
   adicionam ~20KB — ainda ok. FASE 25/26 podem estourar se o mundo crescer sem poda.
5. Arrays com poda: `noticias` (80), `log` (200), `series` (120). Manter esse hábito
   em todo array novo (memória, doadores, militância).
6. **Sem loops infinitos conhecidos** (o de `gerarChapa` foi corrigido).

## 7. Dívida técnica / fragilidades (limpar antes de escalar)

| # | Problema | Bloqueia |
|---|---|---|
| ~~D1~~ | ✅ Bloco E — `engine/offices.js` centraliza cidade/cargo/circunscrição; voteModel/candidates/election parametrizados | — |
| ~~D2~~ | ✅ Bloco E — `cargosElegiveis()` lê `cargos.json`; SENADOR/GOVERNADOR ficam para bloco futuro (coattail nacional) | — |
| D3 | `mundo.candidatos` — campo morto no schema | limpeza |
| D4 | Overlays (`TickEventos`, `CriseModal`, `ResultadoEleicao`) gerenciados ad hoc no `AppShell` | FASE 12, 13, 29, 30 |
| ~~D5~~ | ✅ P3 — `EFEITOS{}` + `ORDEM_EFEITOS[]` + `registrarEfeito()`; adicionar efeito não toca no loop | — |
| ~~D6~~ | ✅ P1 — `engine/runMonth.js` é o pipeline único; `sim.js` e o store consomem o mesmo | — |
| D7 | Sem granularidade dia/semana — tick é mensal | FASE 1 (se levada ao pé da letra) |
| D8 | Assessor com `risco: "vira rival"` sem desfecho implementado | FASE 4 (completar), 21 |
| D9 | `crises.json` tem campo `memoria` que só empurra texto — nada lê de volta | FASE 2 |

## 8. Matriz das 39 fases → estado atual

Legenda: ✅ pronto · 🟡 parcial · ⛔ ausente

| Fase | Tema | Estado | Nota |
|---|---|---|---|
| 0 | Auditoria | ✅ | este documento |
| 1 | Refator + motor tempo/eventos | ✅ | `runMonth` unificado (P1); mensal |
| 2 | World Memory | ✅ | `worldMemory.js` — fatos com gatilho disparam investigação/cobrança meses depois; crises marcadas `investigavel`/`gatilho` alimentam |
| 3 | Personagens + relações | ✅ | 39 NPCs persistentes; falta idade/vida pessoal de NPC |
| 4 | Gabinete + assessores | ✅ | falta trajetória do assessor (D8) |
| 5 | Central de Inteligência | ✅ | `engine/intel.js` + aba Inteligência — 7 relatórios (eleitoral, territorial, político, mídia, oposição, risco, recomendação do gabinete) 100% derivados do estado |
| 6 | Calendário eleitoral | ✅ | `calendar.js` — eleições em mês fixo (33, 81…), janela de candidatura, perder o ciclo custa 4 anos, mandato encerra na eleição |
| 7 | Território + bairros | ✅ | 25 bairros, cartograma |
| 8 | Eleitorado dinâmico + incerteza | ✅ | `engine/electorate.js` — `mundo.satisfacaoGrupos` (−100..100 por grupo, persiste). Entregas/fiscalização sobem a satisfação dos grupos da pauta (via `impactoDeTema`); decai à média, sofre deriva por desalinhamento ideológico do partido e pelo humor nacional. Termo `sat` na `voteModel.propensao` (só o jogador). Card na aba Pesquisas + linha no relatório ELEITORAL |
| 9 | Imprensa + jornal | ✅ | `engine/newspaper.js` — edição "RECIFE AGORA" com manchete de capa + editorias (Política, Câmara, Cidade, Redes, O Embate) montadas das notícias recentes. Card na aba Imprensa |
| 10 | Investigações | ✅ | `worldMemory.tickInvestigacaoProativa` — a imprensa vai atrás sozinha quando o estado tem cheiro de problema (caixa alto s/ lastro, promessa furada + gasto, desafeto que vaza). Vira crise com escolha; responder mal a faz voltar |
| 11 | Instagram + viralização | ✅ | — |
| 12 | Polêmicas + crises | ✅ | cascata `polemica_viral` (5 estágios: trending → colunistas → adversários → influenciadores → pesquisa), semeada por Reels viral negativo. Ação "conter repercussão" reduz o estrago |
| 13 | Entrevistas | ✅ | `engine/interview.js` + `content/interviews.json` + `EntrevistaModal` — 4-6 perguntas escolhidas pelo contexto (promessa furada, crise, ataque, posição, rejeição), cada uma com 2-3 tons; score acumulado + rigor do jornalista → desfecho |
| 14 | Podcasts + imagem pública | ✅ | `engine/podcasts.js` + `engine/image.js` + `content/podcasts.json` (6 programas). `personagem.imagem` (competência/proximidade/combatividade/renovação, 0-100) movida por podcast (forte) e postura escolhida; alimenta `voteModel.propensao` via casamento com o que cada grupo valoriza. Card na aba Instagram + linha no relatório ELEITORAL |
| 15 | Influenciadores | ✅ | `engine/influencers.js` + `content/influencers.json` (10 creators). Ações "aproximar-se" / "gravar vídeo com" na Agenda (relação → collab). Empresta audiência de nicho (canal da Fase 8) |
| 16 | Mercado de influência | ✅ | `mundo.influenciadores` vivo: cache (preço) escala com alcance + humor + disputa. Contratar na aba Instagram (paga da caixa de campanha, tranca por N meses, nega a rivais). `tickInfluenciadores`: alcance oscila, rivais capturam, contratos vencem, hostis atacam (→ cascata) |
| 17 | Financiamento rastreado | ✅ | `engine/donors.js` — `financas.doadores[]` com setor + interesse + `valorTotal` + `risco`. "Jantar de captação" (campanha) e "Jantar com financiadores" (mandato) usam `captarDoacao`. `tickDoadores`: risco alto → cobrança de contrapartida (`eventoPendente._cobrancaDoador`, resolvida em `resolverCobrancaDoador`) ou investigação da imprensa (via `registrarFato`). `exposicaoDoadores()` na aba Finanças + relatório FINANCIAMENTO |
| 18 | Base × oposição | ✅ | `mandato.posicao` BASE/OPOSICAO/INDEPENDENTE — declarada na aba Mandato. BASE: +apoio a projetos, obras do governo, efeito vagão na aprovação. OPOSICAO: fiscalização rende mais, projetos de lei penam. Prefeito NPC tem `aprovacao` que oscila |
| 19 | Comissões | ✅ | `content/committees.json` (8 comissões). Pedir vaga / disputar presidência na aba Mandato. Participar → relatoria (+apoio nos projetos do tema); presidir → +12 apoio + notoriedade mensal + alvo de rivais |
| 20 | Coligações/federações | ✅ | `coalitions.js` — federações fixas (PT/PCdoB, PSOL/REDE) + ~5 coligações ad-hoc por ideologia por eleição. `apurar()` calcula o quociente por coligação → nanico entra de carona numa legenda forte. Card na aba Política |
| 21 | Política partidária interna | ✅ | `partidosRuntime.presidenteMunicipal` + `diretorioDoJogador`. `disputarDiretorio()` — precisa de base interna (filiados aliados + apoio institucional). Presidir o diretório = piso de apoio alto + controle de candidaturas. Card na aba Política. Convenção como set-piece = fase contínua |
| 22 | Vida pessoal | ✅ (leve) | `engine/personal.js` — `personagem.vida {estadoCivil, conjuge, filhos, hobby, saude}`. Saúde acompanha o ritmo de trabalho e define a energia máxima (85–110). Ação "Cuidar da saúde". Eventos de vida raros (casamento, filho, problema de saúde). Card na aba Personagem |
| 23 | Militância | ✅ | `engine/militancy.js` — `personagem.militancia {bairroId: nVoluntarios}`. Ação "Formar núcleo" (etapa1/campanha/mandato). `tickMilitancia`: voluntários sustentam presença passiva no bairro + `bonusMilitancia` multiplica campanha ali; núcleo cresce com aprovação alta, esvazia por atrito. Card na aba Mapa |
| 24 | Cenário nacional | ✅ | `engine/national.js` + `content/national.json` (10 eventos macro genéricos/fictícios). `mundo.nacional {evento, clima, historico}`. `clima` (−100 esquerda .. +100 direita) tempera a satisfação dos grupos (F8) e a popularidade dos partidos. Card no Dashboard + relatório NACIONAL + editoria "Brasil" no jornal |
| 25 | Cargos superiores | ✅ | `content/cargos.json` (VEREADOR, PREFEITO, DEPUTADO_ESTADUAL/FEDERAL) + `estado-pe.json` (circunscrição estadual, 9 regiões). `apurarMajoritario` com 2º turno. Elegibilidade por idade/notoriedade/mandato prévio (`personagem.mandatosExercidos`). Card de escolha de cargo na Agenda; `Eleicao`/`ResultadoEleicao` cobrem majoritário e 2 turnos. GOVERNADOR/SENADOR ficam para depois |
| 26 | Mais cidades | ✅ | `neighborhoods/olinda.json` (14 bairros, 21 cadeiras). Escolha da cidade na criação de personagem. `offices.bairrosDaCidade()` — Agenda/Mapa/Mandato/Dashboard/world.js parametrizados. Textos de crise/cascata ainda citam bairros do Recife por padrão (cosmético) |
| 27 | Conquistas | ✅ | `engine/achievements.js` — 27 conquistas em 8 grupos, condição pura sobre o estado, `checarConquistas()` no tick → MARCO + evento. Aba **Conquistas** (🏆) com progresso e cards bloqueados/desbloqueados |
| 28 | Gráficos + ficha de adversário | ✅ | `engine/milestones.js` — `state.marcos[]` (registrarMarco + tickMarcos derivado do log). `Sparkline` aceita `marks` (linhas verticais); aba Pesquisas tem gráficos anotados + card "Linha do tempo". `FichaPolitico` — modal clicável de qualquer ator político (aba Pessoas → "Cenário político"): stats, relação, alianças, últimos movimentos |
| 29 | Resumo mensal | ✅ | `TickEventos` agrupa por categoria (Marcos · Mídia · Política · Mandato · Cidade · Finanças) e destaca o que exige decisão |
| 30 | Fim de jogo + legado | ✅ | `engine/endgame.js` — 5 finais (escolha, aposentadoria 75+/78, saúde, derrota terminal, escândalo fatal). `personagem.legado` acumula a carreira toda; `BiografiaFinal.jsx` mostra o balanço + "veredito da história" (10 títulos: Estadista, Cacique de território, O eterno candidato, Nota de rodapé, A queda…) + nota 0-100. `ModalHost` prioridade 0. "Encerrar a carreira" na Agenda |
| 31 | Narrativa emergente | ✅ (motor) | `cascade.js` — 3 modelos de cascata que encadeiam estágios mês a mês; semeadas por crises/viral/projeto rejeitado. Mais modelos e gatilhos = fase contínua |
| 32 | Integração | ✅ (contínuo) | Bloco G — varredura de stress: 5×120mo + 6×200mo (cargos superiores) + Olinda, ações aleatórias tocando todo subsistema, telas derivadas consumidas — zero exceções |
| 33 | Balanceamento | ✅ | Bloco G + **Fase 6/E13**: `voteModel.T` 1.35→2.2 (comprime a disputa); `mandateTick` reversão à média mais forte + desgaste de mandato (aprovação para de grudar em 75-80); reeleição = referendo mais duro (centro em 50 de aprovação, desgaste de incumbência, apoio do partido pode cair); `custoPolitico` mensal por cargo. Bateria (4 perfis×2 esforços×20): ótimo elege 0.9–1.0 / casual 0.75–0.95, reeleição 0.87–1.0, aprovMédia 59–67, dinheiro −20%. Jogo ruim → **derrota garantida** (16/16). Ajuste fino segue com playtest |
| 34 | Testes de fracasso | ✅ | Bloco G — `g_failure`: empresário combativo em Recife, DIFÍCIL, piores escolhas de crise, sem base → **0/16 se elegeram, 16/16 terminaram em DERROTA** ("Nota de rodapé") |
| 35 | Testes de sucesso | ✅ | Bloco G — `oldage`/`fullsweep`: carreiras longas chegam a APOSENTADORIA aos 78 com biografia coerente; 6 perfis × 6 partidas cada, zero erros |
| 36 | Save/load | ✅ | Bloco G — migração testada de CADA versão v1→v12 + jogável após migrar + round-trip export/import |
| 37 | Performance | ✅ | Bloco G — 0.22 ms/mês em MANDATO; save ~93 KB; arrays podados (log 200, notícias 80, série 120, marcos 60) |
| 38 | UI/UX | 🟡 | 18 abas funcionais (+ Inteligência, + Conquistas). Câmara e Carreira ainda não são aba própria; polimento visual é contínuo |
| 39 | Polimento | 🟡 (contínuo) | Bloco G — deploy: `<title>`, favicon temático, meta OG, `vercel.json`. Restante depende de playtest |

**Placar (após Fase 6):** 38 prontas · 1 parcial (38/39 polimento de UI, contínuo) · 0 ausentes. **As 39 fases estão implementadas.** A Fase 7 (24 itens de conteúdo/variedade, ver abaixo) foi concluída em seguida.

### Fase 6 — BALANCEAMENTO + CORREÇÕES (13 etapas)

Passada dedicada a balanceamento, bugs, integração e progressão — sem novos sistemas.
Auditoria inicial em `frontend/BALANCE_AUDIT.md`. `CLAUDE.md` + `.claudeignore` na raiz.

| Etapa | Entrega |
|---|---|
| 1 | Auditoria (`BALANCE_AUDIT.md`) — fórmulas, sistemas desconectados, ordem de execução |
| 2 | Promessas: `temaCanonico()`; `cumprirPromessas` exige match tema+bairro → progresso 100 → confiança + impactoDeTema; id com dedup |
| 3 | Popularidade: `relevanciaMidiatica(state)` (0-100, presença de mídia, **não é voto**) entra na média do partido do jogador |
| 4 | Relações: `fatorRelacao(state,p,tipo)` 0.25-1.7 modula toda interação com NPC |
| 5 | Alianças: `limiarAlianca`/`chanceAlianca`/`tentarAlianca`/`romperAlianca`/`tickAliancas` — aliança tem custo, rolagem e rompimento |
| 6 | Cargos: pool de ações próprio por cargo (`prefeito.json`/`deputado.json`/`midia.json` + compartilhadas + autocuidado) |
| 7 | Agenda: `pesoContextual(a,state)` — o leque reage a crise, promessa vencendo, notoriedade baixa |
| 8 | Gabinete: `multGabinete(state,area)` 0.85-1.75 consumido em social/press/world/actions |
| 9 | Entrevistas: `convitesMidiaAtivos`/`tickConvitesMidia` — `mundo.convitesMidia[]`, chance e teto escalam com relevância + comunicação |
| 10 | Atributos: `engine/attributes.js` — 7 treináveis, XP (ação de custo≥2 → xp passivo), `custoNivel`, teto 92. Sem `ação → +10` automático |
| 11 | Família: `engine/family.js` leve — `personagem.vida` expandida, `acaoFamilia`, `tickFamilia`. `personal.js` reescrito (energiaMax = f(saúde,bem-estar)); removido casamento/filho automático. Aba Familia |
| 12 | Influenciadores: 6 reais (só trabalho público, sem posicionamento) + 10 fictícios; guards `real:true`; efeito só em alcance/notoriedade/repercussão |
| 13 | Balanceamento final: `voteModel.T` 1.35→2.2; `mandateTick` reversão à média + desgaste; reeleição como referendo mais duro; `custoPolitico` mensal. **Meta: difícil + justo + dinâmico** |

**Save v12 → v15** (migrações 12→13→14→15). Regressão 31/08: `g_failure` 16/16 DERROTA ·
`oldage` APOSENTADORIA aos 78 · `promessa` 6/6 · migração v1→v15 + round-trip OK ·
perf 0,21 ms/mês. Harness de teste: scripts `.mjs` no scratchpad (Node 24 exige um
`--experimental-loader` que resolve extensão + `type:json`).

### Observação de balanceamento (resolvida na Fase 6/E13)

> Tratado: teto de voto por bairro mais duro, `T` do softmax maior, reeleição como
> referendo com desgaste, custo de vida de político. Ver linha 33 da matriz.

O calendário eleitoral expôs um problema que já existia: durante os ~24 meses de
espera como `PARTIDO`, o jogador só tem o que fazer construir território e
notoriedade, e esses valores não decaem rápido o bastante. Resultado nas
simulações: o jogador chega à eleição superconstruído e vence em 1º lugar quase
sempre. Já apliquei um paliativo (presença territorial esvai fora de campanha,
`tick.js`), mas a solução real — teto de voto por bairro mais duro, fidelidade do
eleitor, campo dos 20 fortes mais competitivo, e/ou conteúdo real para os anos de
espera (blocos B/C) — é trabalho da **fase 33 (balanceamento)** com o harness
`sim.js`. Registrado aqui para não esquecer.

### Fase 7 — NOVA RODADA DE CONTEÚDO + VARIAÇÃO (24 itens)

Spec do usuário: funcionalidades menores + variedade + imersão, sem sistemas gigantes,
implementados um item por vez com teste e regressão entre cada um. Prioridade absoluta:
variedade da Agenda (item 13). Reais (políticos/famosos) só com informação pública, sem
inventar fatos; influência afeta alcance/repercussão, nunca dá voto direto; empresas e
veículos de mídia nacionais são fictícios (para poder ter linha editorial própria sem
atribuir falas a marcas reais).

| Item | Entrega |
|---|---|
| 13 (prioridade) | Agenda: `meta.acoesRecentes` anti-repetição, leque 6-7 c/ spread por categoria, `variantes` (rótulo cosmético por mês), +19 ações novas |
| 1 | Partido: `engine/party.js` — janela partidária, receptividade, negociar entrada, trocar, sair, histórico (`partidoHistorico[]`) |
| 3 | Grupos sociais: `cortejarGrupo` (encontro/discurso dirigido), oportunidades por nível de satisfação em `tickEleitorado` |
| 6 | Entrevistas: EXATAMENTE 3 perguntas, +7 contextos dinâmicos (cargo/projeto/adversário/troca de partido/grupo/notícia), resposta afeta grupo e relação com rival |
| 5 | Inteligência: pesquisas dirigidas (bairro/grupo/rival), tendências, eleitorado potencial, forças/fraquezas, temas populares, "O que devo propor?" |
| 11 | Políticos: `ACOES_RELACAO` 5→13 verbos, `REACAO_ESTILO` por personalidade (combativo/articulador/técnico/midiático/cabo eleitoral) |
| 10 | Telefonemas: `engine/phone.js` — jornalistas + famosos fictícios, desfechos variados, convites de entrevista |
| 12 | Alianças: limiar/chance recalibrados (mais possível), `oferecerApoio`, `articularColigacao` |
| 14/15 | Gabinete: chefe multiplica toda a equipe (`fatorChefe`), experiência, personalidade, prioridade de área, delegação de rotinas, reunião de alinhamento |
| 16/17 | Empresas fictícias (comprar/criar/investir/vender, conflito de interesse) + instituições nomeáveis (fundar/ampliar, impacto social → legado, nunca voto) |
| 9 | Redes: lives (aberta/bairro/caixa de perguntas puxando o histórico) |
| 2 | Atributos: `cursoAtributo` — cursos pagos dão pontos DIRETOS (não a XP das ações comuns) |
| 7 | Imprensa: 6→14 veículos (nacionais fictícios + regionais), 5→14 jornalistas, convites escalam com relevância |
| 8 | Fama estável: notoriedade regride proporcionalmente (não dispara/despenca), painel separando as 8 métricas, seguidores confirmados nunca tocam o voto |
| 20 | Cenário Político do Recife virou clicável → `FichaPolitico` completa |
| 21 | Investimento financeiro passivo (3 perfis de risco) complementando as empresas |
| 18 | Eventos: inauguração/premiação/congresso/encontro empresarial/convenção partidária |
| 22 | Causalidade: achadas e corrigidas 2 métricas mortas (`confianca`, `engajamento`) |
| 23 | Balanceamento final: `voteModel.T` 2.2→2.6, reeleição mais dura — compensa o drift acumulado da rodada |
| 24 | Teste final: 22 cenários (4 cargos, 100k/1M seguidores, relações, partido, aliança, entrevista, gabinete, promessa, agenda, empresa, instituição) — **22/22 OK** |

**Save v15 → v20** (migrações 15→...→20, cada uma opcional-guardada). Regressão final:
`g_failure` 16/16 DERROTA · `oldage` APOSENTADORIA aos 78 · `promessa` 6/6 · migração
v1→v20 + round-trip OK · perf 0,22 ms/mês · `final24.mjs` 22/22 OK. Bateria: `elege`/
`reeleic` ~0,9-1,0 em jogo bem tocado (aceito — 39 cadeiras não é um cargo hostil pra
campanha real); jogo ruim segue derrota garantida.

### Fase 8 — EXPANSÃO + BALANCEAMENTO + UI (10 prioridades)

| Prio | Entrega |
|---|---|
| 1 Agenda | `content/actions/vida.json` (16 ações família/lazer/viagens) + efeitos `bemEstar`/`viagem`; `pesoContextual` reage a proximidade de eleição, cônjuge, sazonalidade, patamar de fama, território fraco |
| 2 UI hub | `shell/SectionHub.jsx` — bottom bar → grade de cards → sub-tela com back bar; `AppShell` state `{secao, aba}`; SubNav removido |
| 3 Fama | `postar`/`fazerLive` viral = BUZZ (eco) + AUDIÊNCIA (seguidores), não reconhecimento instantâneo; `PISO_CARGO` de notoriedade (VER 12 … PRES 60) |
| 4 Cargos | `cargos.json` +Governador/Senador/Presidente; `brasil.json` circunscrição NACIONAL; pools de ação próprios (`governador/senador/presidente.json`); verba de gabinete escala por cargo; vereditos "Chegou à Presidência" |
| 5 Relações | deriva de relação com políticos rumo a linha de base por partido/ideologia (não cai a 0); verbo "jantar"; `articularColigacaoVia(politicoId)` |
| 6 Projetos | `laws.json` 12→20 temas, 5→10 tipos de proposição; repercussão (notoriedade+eco) na aprovação |
| 7 Gabinete | `treinarAssessor` — investir do bolso em experiência (retorno decrescente, cooldown) |
| 8 Finanças | `Financas.jsx` — 3 blocos: seu dinheiro / seu patrimônio / recursos político-eleitorais (carimbados) |
| 9 Mídia | `press.json`/`podcasts.json`/`famosos.json` — nomes REAIS (Globo, Record, SBT, Band, CNN Brasil, Podpah, Flow, Inteligência Ltda; jornalistas fictícios; `linha`/`eixoHost` dos reais = só inclinação leve de público) |
| 10 Eventos | `events.js` predicados `mesDoAnoIn`/`cargoIn`/`rejeicaoMin`; `crises.json` 18→26 (microcrises sazonais: dengue, estiagem, calor, carnaval, tarifa; CPI municipal e de alto cargo) |
| Item 1 spec | **energia vira recurso ÚNICO do mês** (`tempo.energia`, máx `energiaMax` base 15 modulado por saúde/bem-estar); `custo.energia` dos JSONs ignorado; `pontosRestantes`/`pontosPorMes` extintos. **XP de atributos removido** (`ganharXp` sobe direto com headroom) |
| Item 6 spec | 3 eventos de corrupção fictícia (propina, caixa dois, loteamento de cargo) — ganho MAS memória investigável com gatilho agressivo, EV negativo |

**Save v20 → v21** (migração 20 + normalização pós-loop em `migrar()`). Regressão: `g_failure`
não elegeu 16/16 · bateria — votos +~3% (fusão num recurso limpo), win-rate estável.

### Fase 9 — REBUILD + NOVOS SISTEMAS (10 focos)

Referência visual: prints de Music Star / Movie Star (life sim mobile). CSV do usuário
com influenciadores/podcasts/emissoras reais.

| Foco | Entrega |
|---|---|
| 1-2 UI | `SectionHub` reestilizado — título fantasma, pill de atalho, linhas grandes UPPERCASE, botão circular |
| 3 Mini-jogos | `engine/minigame.js` + `content/minigames.json` — 7 modelos (discurso/debate/comício/reunião/evento/negociação/projeto), passos com escolhas pontuadas → tier (ótimo/bom/neutro/ruim) escala os efeitos da ação (0.55×–1.28×); 34 ações da Agenda + negociação de projeto; entrevistas e crises já eram mini-jogos |
| 4 Agenda | já ampliada nas Fases 7-8 |
| 5 Reais | `influencers.json` 16→47 (37 reais, eixo 0); `politicians.json` semente +18 políticos reais (Lula, Alckmin, Motta, Alcolumbre, governadores, bancada de PE) — só cargo+partido públicos; `world.js`: figuras `real` não geram ataque/aliança/troca autônomos (só o jogador inicia); filtro Recife\|Nacionais |
| 6 Atributos $ | `attributes.js` `treinarAtributoPago` — dinheiro (custo cresce com o nível) + 2 energia → ponto direto; botão por atributo em Personagem.jsx |
| 7 Serviços | `content/lifestyle.json` (7 serviços × 3 níveis) + `engine/lifestyle.js` — assinatura mensal do caixa pessoal: +energiaMax (teto +5), saúde, bem-estar, notoriedade, −risco de crise; aba `estilo` (Perfil) |
| 8 Finanças | `donors.js` `autofinanciarCampanha` (pessoal→campanha, teto por cargo, sem risco de exposição); `assets.json`/`assets.js` bens pessoais (imóveis valorizam, veículos depreciam, manutenção mensal, efeitos) — `comprarBem`/`venderBem`, seção em Negócios |
| 9 Estabilização | `relacionamentos` decaem 0.8/mês (era 1.2), só após 3 meses, com piso; eco midiático ×0.75/mês (era 0.63); deriva de relação com políticos mais lenta |
| 10 Gabinete | `conversarAssessor` — 1 energia, +lealdade (modulado por empatia), cooldown, traz alerta da área frágil |

**Save v21** (campos novos `servicos:{}`, `bens:[]`, `minigameAtivo` opcional-guardados —
sem bump). Regressão: `g_failure` não elegeu 16/16 · `oldage` 68 · bateria — votos +~1.5%
(estabilização; efeito pedido pelo usuário), win-rate e aprovação estáveis · save ~116 KB.

## 9. Plano técnico de implementação

### Pré-fases (limpeza — 1 PR pequeno, antes de tudo)
- **P1.** Extrair `runMonth(state)` compartilhado por `store.avancarMes` e `sim.js` (D6).
- **P2.** Introduzir um `ModalRouter` / fila de modais no `AppShell` (D4).
- **P3.** Trocar a ladder de efeitos de `actions.js` por um registry `{ chave: handler }` (D5).
- **P4.** Remover `mundo.candidatos` (D3); alinhar mapa de cargos de `career.js` (D2).

### Ordem recomendada (respeitando dependências — ver §10)

| Bloco | Fases | Por quê primeiro |
|---|---|---|
| **A — Espinha temporal** | 6, 2, 31, 29 | Calendário eleitoral destrava a dificuldade; World Memory + cascata + resumo agrupado são a base da narrativa emergente. Tudo depois se pendura aqui. |
| **B — Institucional** | 18, 19, 20, 21 | Base×oposição, comissões, coligações e política interna aprofundam o mandato e a eleição já existentes. Reusam `mandato`, `partidosRuntime`, `apurar`. |
| **C — Mídia viva** | 5, 9, 10, 13, 12 | Central de Inteligência (relatórios), jornal periódico, investigações (usa World Memory do bloco A), entrevistas contextualizadas, cascata de polêmica. |
| **D — Vida e sociedade** | 8, 22, 23, 24, 17 | Eleitorado que lembra, vida pessoal, militância, cenário nacional, financiamento rastreado (usa World Memory). |
| **E — Escala** | D1 (refator), 25, 26 | Cargos superiores exigem tirar o hardcode de cidade/cargo do voteModel + otimizar `estimarVotos`. Mais cidades vem quase de graça depois. |
| **F — Extras e influência** | 14, 15, 16, 27, 28 | Podcasts, influenciadores + mercado, conquistas, gráficos/ficha de adversário. |
| **G — Fecho** | 30, 32, 33, 34, 35, 36, 37, 38, 39 | Fim de jogo + legado, integração, re-balanceamento com `sim.js`, testes, save, performance, UI, polimento. |

Dentro de cada fase: implementar → rodar → testar → corrigir → regressão (`sim.js` + smoke manual) → atualizar este doc → próxima.

## 10. Dependências entre fases

```
LIMPEZA (P1-P4) ─────────────────────────────────────────────► tudo

6 Calendário eleitoral ─┬─► 25 Cargos superiores
                        ├─► 21 Política interna (janela de convenção)
                        └─► 31 Narrativa (adversários crescem na espera)

2 World Memory ─┬─► 10 Investigações
                ├─► 17 Financiamento rastreado
                ├─► 31 Narrativa emergente ──► 29 Resumo mensal (o que destacar)
                └─► 30 Legado (biografia = leitura da memória)

3 Personagens ──► 4 Assessores c/ trajetória ──► 21 Política interna
                                              └─► 25 (assessor vira candidato a cargo maior)

7 Território ──► 8 Eleitorado dinâmico ──► 23 Militância (núcleos por bairro)

9 Imprensa ──► 10 Investigações ──► 13 Entrevistas (perguntas citam investigação)
          └──► 12 Cascata de polêmica

D1 (tirar hardcode cidade/cargo) ──► 25 Cargos superiores ──► 26 Mais cidades
                                 └─► otimizar estimarVotos (pré-requisito de 25)

18 Base×oposição ──► 19 Comissões (presidência depende de ser da base)
20 Coligações ──► altera 25 (quociente em escala estadual)

Tudo ──► 32 Integração ──► 33 Balanceamento ──► 34/35 Testes ──► 30 Legado ──► 39 Polimento
```

## 11. Definição de "pronto" (do prompt mestre)

O jogo estará pronto quando: carreira construível · mundo que continua ·
eleições com pressão temporal · ações com custo/risco · votos que sobem **e caem** ·
adversários que evoluem · relações com memória · bairros com dinâmica própria ·
imprensa reativa · Instagram que viraliza ou fracassa · entrevistas contextualizadas ·
crises · investigações que voltam · gabinete que aconselha · assessores com trajetória ·
partidos com política interna · cargos que mudam a escala · pesquisas com incerteza ·
fracasso possível · recuperação possível · carreira com começo/meio/fim ·
cada partida com uma história diferente.

**Hoje:** todos os itens acima existem no jogo. O que resta é polimento de UI (38/39) e
calibragem fina guiada por playtest humano.

---
*Blocos P1–P4, A–G e Fases 6–9 concluídos e testados. Save **v21**.
Deploy: `git push origin master` → Vercel auto-deploy → https://carreira-politica-jogo.vercel.app*
