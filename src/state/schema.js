// Forma do save + versão + migrações. Salvar nunca pode quebrar entre updates:
// toda mudança estrutural ganha um número de versão e uma função de migração.

export const SAVE_VERSION = 11;

// Estado "vazio" de referência — documenta a forma completa do save.
export function emptyState() {
  return {
    meta: {
      version: SAVE_VERSION,
      seed: 0,
      rngState: null, // estado do PRNG principal (uint32) — persistido para retomar
      dificuldade: 'NORMAL',
      criadoEm: null,
      salvoEm: null,
    },
    tempo: {
      mes: 0, // meses decorridos desde o início
      anoInicial: 2026,
      pontosRestantes: 12,
      pontosPorMes: 12,
      energia: 100,
      energiaMax: 100,
    },
    personagem: {
      nome: '',
      idade: 28,
      profissaoId: null,
      traçoId: null,
      ufOrigem: 'PE',
      cidade: 'RECIFE', // Fase 26 — cidade jogável (RECIFE | OLINDA)
      fase: 'VIDA', // VIDA -> VIDA_PUBLICA -> PARTIDO -> CANDIDATO -> MANDATO
      cargoAtual: 'NENHUM',
      mandatosExercidos: [], // Fase 25 — cargoIds já exercidos (elegibilidade p/ cargos superiores)
      partidoId: null,
      atributos: {},
      skills: {},
      patrimonio: 0,
      historicoProfissional: [],
      historicoPolitico: [],
      grupoPolitico: [], // ids de mundo.politicos alinhados ao jogador
      emprego: null, // { id, titulo, setor, salario, horas, mesInicio }
      licenciado: false, // afastado do emprego (campanha/mandato) — meio salário, zero horas
      // Fase 22 — vida pessoal
      vida: { estadoCivil: 'solteiro', conjuge: null, filhos: 0, hobby: null, saude: 100 },
      // Fase 23 — militância por bairro { bairroId: nVoluntarios }
      militancia: {},
      // Fase 14 — imagem pública: como o eleitor te enxerga (0-100 por eixo)
      imagem: { competencia: 50, proximidade: 50, combatividade: 50, renovacao: 50 },
    },
    financas: {
      pessoal: 0,
      campanha: 0,
      partidaria: 0,
      gabinete: 0,
      rendaMensal: 0,
      custoVidaMensal: 0,
      doadores: [], // Fase 17 — { id, nome, setor, interesse, valorTotal, mesUltima, risco, cobrado }
    },
    reputacao: {
      aprovacao: 50,
      confianca: 40,
      rejeicao: 8,
      notoriedade: 3,
      ecoMidiatico: 0,
    },
    redes: {
      seguidores: 0,
      alcanceMedio: 0,
      engajamento: 0.04,
      crescimentoMensal: 0,
    },
    relacionamentos: {
      // id -> { id, nome, papel, profissao, ideologiaEixo, influencia, confianca, nivel, ultimoContatoMes }
      pessoas: {},
    },
    territorio: {
      // bairroId -> { presenca (0-100), penetracao (0-100) }
      porBairro: {},
    },
    mundo: {
      memoria: [], // ver Fase 2 abaixo
      // Etapa 3 — mundo político persistente
      inicializado: false,
      politicos: {}, // id -> ator político (ver engine/world.js)
      partidosRuntime: {}, // partidoId -> { caixa, popularidade, bancada, forcaDelta, apoioAoJogador, lideres:[] }
      noticias: [], // { id, mes, tipo, texto, atores:[], destaque }
      aliancas: [], // { aId, bId, forca, desde }
      crisesHistorico: {}, // Etapa 5 — eventoId -> mês da última ocorrência (cooldown)
      // Fase 2 — memória do mundo com gatilho de retorno
      // memoria[]: { id, mes, tipo, texto, dados, gatilho:{aposMeses,chance,condicao,disparo,maturaEm}, disparado, resolvido }
      cascatas: [], // Fase 31 — { id, tipo, dados, estagio, proximoMes, encerrada }
      investigacoes: [], // Fase 10 — { id, jornalistaId, tema, estagio, proximoMes, encerrada, dados }
      satisfacaoGrupos: {}, // Fase 8 — grupoId -> -100..100, persiste, alimenta o modelo de votos
      nacional: { evento: null, clima: 0, historico: [] }, // Fase 24 — cenário macro
      influenciadores: [], // Fase 15/16 — { id, nome, nicho, plataforma, alcance, eixo, cache, relacao, humor, aliadoDe, contratadoAte }
      influInicializado: false,
    },
    eleicao: null, // preenchido na Etapa 2
    eventoPendente: null, // Etapa 5 — crise aguardando escolha do jogador (bloqueia o avanço do mês)
    entrevistaAtiva: null, // Fase 13 — { jornalistaId, veiculoNome, perguntas, idx, score, respostas }
    // Etapa 4 — mandato de vereador
    mandato: null, /* {
      mesInicio, mesFim, cargo,
      gabinete: { cargos: { chaveCargo: {assessorId} }, verbaMensal, verba, contratados: { id: assessor } },
      projetos: [], // { id, titulo, tema, bairroFoco, status, apoio, custoPolitico, impacto, popularidade, mesProposto, votos }
      sessoes: [], // { mes, itens: [{projetoId, resultado, placar}] }
      promessas: [], // { id, texto, bairroId, tema, mesFeita, prazo, cumprida }
      indicadores: { obrasEntregues, projetosAprovados, projetosRejeitados, fiscalizacoes },
      relacaoPrefeitura: 0,
      posicao: 'INDEFINIDO', // Fase 18 — BASE | OPOSICAO | INDEPENDENTE | INDEFINIDO
      comissoes: { participando: [], presidindo: null }, // Fase 19
    } */
    series: [], // { mes, aprovacao, rejeicao, notoriedade, seguidores, intencaoVoto } — histórico p/ Pesquisas
    marcos: [], // Fase 28 — { mes, tipo, texto } marcos anotados na linha do tempo
    conquistas: { desbloqueadas: {} }, // Fase 27 — { achievementId: mes }
    log: [], // { mes, tipo, texto }
    flags: {
      tutorialPasso: 0,
      onboardingConcluido: false,
      dicasVistas: [],
      tutorialDesligado: false,
    },
  };
}

// migrações[v] transforma um save da versão v para v+1.
const migracoes = {
  // v1 -> v2: mundo político persistente (deepMerge preenche o resto)
  1: (s) => {
    s.personagem.grupoPolitico = s.personagem.grupoPolitico || [];
    s.mundo = {
      ...s.mundo,
      inicializado: false,
      politicos: {},
      partidosRuntime: {},
      noticias: [],
      aliancas: [],
    };
    return s;
  },
  // v2 -> v3: sistema de empregos. Cria um emprego a partir da renda atual.
  2: (s) => {
    if (!s.personagem.emprego) {
      s.personagem.emprego = {
        id: 'legado', titulo: 'Emprego atual', setor: 'privado',
        salario: s.financas.rendaMensal || 3000, horas: 3, mesInicio: 0,
      };
    }
    s.personagem.licenciado = false;
    return s;
  },
  // v3 -> v4: mandato (deepMerge cuida do resto)
  3: (s) => {
    s.mandato = s.mandato || null;
    return s;
  },
  // v4 -> v5: crises / mídia
  4: (s) => {
    s.eventoPendente = s.eventoPendente || null;
    s.mundo.crisesHistorico = s.mundo.crisesHistorico || {};
    s.mundo.memoria = s.mundo.memoria || [];
    return s;
  },
  // v5 -> v6: World Memory com gatilho + cascatas + calendário eleitoral
  5: (s) => {
    delete s.mundo.candidatos;
    s.mundo.cascatas = s.mundo.cascatas || [];
    s.mundo.memoria = (s.mundo.memoria || []).map((f) => ({
      gatilho: null, disparado: false, resolvido: true, ...f,
    }));
    return s;
  },
  // v6 -> v7: Bloco B — base×oposição, comissões, coligações, política interna
  6: (s) => {
    if (s.mandato) {
      s.mandato.posicao = s.mandato.posicao || 'INDEFINIDO';
      s.mandato.comissoes = s.mandato.comissoes || { participando: [], presidindo: null };
    }
    // backfill leve nos partidos já existentes (sem recriar o mundo)
    for (const pr of Object.values(s.mundo.partidosRuntime || {})) {
      if (!pr.presidenteMunicipal) pr.presidenteMunicipal = (pr.lideres || [])[0] || null;
      if (pr.diretorioDoJogador === undefined) pr.diretorioDoJogador = false;
    }
    return s;
  },
  // v7 -> v8: Bloco C — mídia viva (investigações + entrevistas interativas)
  7: (s) => {
    s.mundo.investigacoes = s.mundo.investigacoes || [];
    s.entrevistaAtiva = s.entrevistaAtiva || null;
    return s;
  },
  // v8 -> v9: Bloco D — eleitorado dinâmico, financiamento rastreado, cenário nacional, militância, vida pessoal
  8: (s) => {
    s.personagem.vida = s.personagem.vida || {
      estadoCivil: 'solteiro', conjuge: null, filhos: 0, hobby: null, saude: 100,
    };
    s.personagem.militancia = s.personagem.militancia || {};
    s.financas.doadores = s.financas.doadores || [];
    s.mundo.satisfacaoGrupos = s.mundo.satisfacaoGrupos || {};
    s.mundo.nacional = s.mundo.nacional || { evento: null, clima: 0, historico: [] };
    return s;
  },
  // v9 -> v10: Bloco E — cargos superiores + cidades parametrizadas
  9: (s) => {
    s.personagem.cidade = s.personagem.cidade || 'RECIFE';
    if (!Array.isArray(s.personagem.mandatosExercidos)) {
      const atual = s.personagem.cargoAtual;
      s.personagem.mandatosExercidos = (atual && atual !== 'NENHUM') ? [atual]
        : (s.mandato?.cargo ? [s.mandato.cargo] : []);
    }
    if (s.mandato && !s.mandato.cargo) s.mandato.cargo = 'VEREADOR';
    if (s.eleicao && !s.eleicao.cargo) s.eleicao.cargo = 'VEREADOR';
    // o formato de flags.eleicoesRealizadas mudou (nº do mês -> "TIPO_mês")
    s.flags = s.flags || {};
    s.flags.eleicoesRealizadas = [];
    return s;
  },
  // v10 -> v11: Bloco F — podcasts/imagem, influenciadores, conquistas, marcos
  10: (s) => {
    s.personagem.imagem = s.personagem.imagem
      || { competencia: 50, proximidade: 50, combatividade: 50, renovacao: 50 };
    s.mundo.influenciadores = s.mundo.influenciadores || [];
    s.mundo.influInicializado = s.mundo.influInicializado || false;
    s.marcos = s.marcos || [];
    s.conquistas = s.conquistas || { desbloqueadas: {} };
    return s;
  },
};

export function migrar(save) {
  let s = save;
  let v = s?.meta?.version ?? 0;
  while (v < SAVE_VERSION) {
    const fn = migracoes[v];
    if (!fn) {
      // sem caminho de migração — mescla com o vazio para não quebrar
      s = deepMerge(emptyState(), s || {});
      break;
    }
    s = fn(s);
    v++;
    s.meta.version = v;
  }
  // garante que campos novos existam mesmo sem migração explícita
  return deepMerge(emptyState(), s);
}

function deepMerge(base, over) {
  if (Array.isArray(base)) return over ?? base;
  if (typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (over && k in over) out[k] = deepMerge(base[k], over[k]);
  }
  // preserva chaves extras do save (ex: mapas dinâmicos)
  if (over) for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
  return out;
}
