import { createRng, streamRng, clamp } from './rng';
import { sincronizarRenda } from './jobs';
import { fimDoMandato, janelaCandidatura } from './calendar';
import { impactoDeTema } from './electorate';
import { cargoPorId } from './offices';
import staffDef from '../content/staff.json';
import lawsDef from '../content/laws.json';
import committeesDef from '../content/committees.json';
import neighborhoods from '../content/neighborhoods/recife.json';
import partiesDef from '../content/parties.json';
import pressDef from '../content/press.json';

const pressJornalistas = pressDef.jornalistas;

const BAIRROS = neighborhoods.bairros;
const MANDATO_MESES = 48;
export const COMISSOES = committeesDef.comissoes;

// Etapa 2 — vocabulário de `bairro.problemas` != vocabulário de `laws.json`.
// Normaliza para o id canônico de tema usado nos projetos.
const TEMA_CANONICO = {
  agua: 'saneamento', alagamento: 'saneamento', comercio: 'empreendedorismo',
  emprego: 'empreendedorismo', gestao: 'transparencia', moradia: 'habitacao',
  turismo: 'cultura',
};
export function temaCanonico(tema) {
  return TEMA_CANONICO[tema] || tema;
}

export function comissaoDoTema(tema) {
  return COMISSOES.find((c) => c.temas.includes(tema)) || null;
}
export function comissaoPorId(id) {
  return COMISSOES.find((c) => c.id === id) || null;
}

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}
function nomeStaff(rng) {
  return `${rng.pick(staffDef.poolNomes.primeiros)} ${rng.pick(staffDef.poolNomes.sobrenomes)}`;
}

// gera 3 candidatos a assessor para um cargo
export function candidatosAssessor(state, cargoChave, rng) {
  const faixa = staffDef.salarioPorCargo[cargoChave] || [4000, 9000];
  return Array.from({ length: 3 }, () => {
    const traço = rng.weighted(staffDef.traços, (t) => (t.id === 'mediano' ? 2 : t.id === 'competente' ? 1.2 : 1));
    const compBase = rng.int(35, 75) + (traço.competencia || 0);
    const salBase = rng.rangeInt(faixa) * (traço.salario || 1);
    return {
      id: `as_${cargoChave}_${rng.int(1000, 9999)}`,
      nome: nomeStaff(rng),
      cargoChave,
      traço: traço.id,
      traçoNome: traço.nome,
      competencia: clamp(Math.round(compBase), 5, 98),
      lealdade: clamp(50 + (traço.lealdade || 0) + rng.int(-10, 10), 5, 98),
      experiencia: 0, // Item 14 — cresce no cargo, soma à competência efetiva
      salario: Math.round(salBase / 100) * 100,
      risco: traço.risco || null,
      mesContratado: null,
    };
  });
}

export function iniciarMandato(state, cargoId = 'VEREADOR') {
  const cargo = cargoPorId(cargoId);
  const tipoPleito = cargo.tipoPleito || 'MUNICIPAL';
  const executivo = cargo.sistema === 'MAJORITARIO';
  // o mandato vai até a próxima eleição do mesmo tipo (data fixa)
  // Senador cumpre 8 anos (dois ciclos); os demais vão até a próxima eleição do tipo.
  const mesFim = cargo.mandatoMeses && cargo.mandatoMeses > 60
    ? state.tempo.mes + cargo.mandatoMeses
    : Math.max(state.tempo.mes + 36, fimDoMandato(state, tipoPleito));
  // verba de gabinete escala com o porte do cargo
  const verbaMult = cargo.circunscricao === 'NACIONAL' ? 9
    : cargoId === 'GOVERNADOR' ? 7
      : cargoId === 'SENADOR' ? 3.2
        : cargo.circunscricao === 'ESTADO' ? 2.4
          : executivo ? 4 : 1;
  const verba = Math.round(staffDef.verbaMensalBase * verbaMult);
  state.mandato = {
    mesInicio: state.tempo.mes,
    mesFim,
    cargo: cargoId,
    cargoNome: cargo.nome,
    executivo,
    tipoPleito,
    gabinete: {
      verbaMensal: verba,
      contratados: {},
      prioridade: null, // Item 15 — área foco do gabinete
      delegacoes: {}, // Item 15 — { rotina: true } tarefas delegadas ao gabinete
      ultimaReuniao: -99,
    },
    projetos: [],
    sessoes: [],
    promessas: [],
    indicadores: { obrasEntregues: 0, projetosAprovados: 0, projetosRejeitados: 0, fiscalizacoes: 0 },
    relacaoPrefeitura: executivo ? 100 : 0, // se você É o executivo, "relação" é consigo mesmo
    posicao: executivo ? 'GOVERNO' : 'INDEFINIDO',
    comissoes: { participando: [], presidindo: null },
  };
  state.financas.gabinete = verba;
  sincronizarRenda(state);
  state.log.unshift({
    mes: state.tempo.mes, tipo: 'MARCO',
    texto: `Mandato de ${cargo.nome} iniciado. Verba de gabinete: R$ ${verba.toLocaleString('pt-BR')}/mês.`,
  });
}

// Item 14 — o chefe de gabinete. Competência efetiva já contando a experiência.
export function chefeGabinete(state) {
  return state.mandato?.gabinete?.contratados?.chefe_gabinete || null;
}
function compEfetiva(a) {
  if (!a) return 0;
  return clamp(a.competencia + (a.experiencia || 0) * 6, 5, 100);
}
// Fator global do chefe sobre TODO o gabinete: bom chefe multiplica a equipe,
// chefe fraco atrapalha, e a falta de um pesa.
export function fatorChefe(state) {
  const c = chefeGabinete(state);
  if (!c) return 0.82;
  return clamp(0.78 + (compEfetiva(c) / 100) * 0.4 + (c.lealdade / 100) * 0.14, 0.8, 1.32);
}

// competência efetiva do gabinete numa área
export function forcaGabinete(state, area) {
  const g = state.mandato?.gabinete;
  if (!g) return 0.5;
  let soma = 0; let n = 0;
  for (const cargo of staffDef.cargos) {
    const a = g.contratados[cargo.chave];
    if (a && cargo.afeta.includes(area)) {
      soma += compEfetiva(a) * (0.6 + a.lealdade / 250);
      n++;
    }
  }
  const base = n ? 0.5 + (soma / n / 100) : 0.45;
  // Item 15 — a área marcada como prioridade rende mais; as outras, um pouco menos
  const pri = g.prioridade;
  const ajustePri = !pri ? 0 : pri === area ? 0.12 : -0.04;
  return clamp((base + ajustePri) * fatorChefe(state), 0.2, 1.4);
}

// Etapa 8 — multiplicador prático do gabinete numa área (0.85..1.75). Fora de
// mandato não há gabinete → 1. Assessor bom na área compensa; nenhum, penaliza de leve.
export function multGabinete(state, area) {
  if (!state.mandato) return 1;
  return clamp(1 + (forcaGabinete(state, area) - 0.6) * 0.95, 0.85, 1.75);
}

export function contratarAssessor(state, assessor) {
  const g = state.mandato.gabinete;
  const custoAtual = Object.values(g.contratados).reduce((s, a) => s + a.salario, 0);
  if (custoAtual + assessor.salario > g.verbaMensal * 1.05) {
    throw new Error('A folha do gabinete estouraria a verba mensal.');
  }
  g.contratados[assessor.cargoChave] = { ...assessor, mesContratado: state.tempo.mes };
  state.log.unshift({ mes: state.tempo.mes, tipo: 'GABINETE', texto: `${assessor.nome} contratado(a) como ${staffDef.cargos.find((c) => c.chave === assessor.cargoChave).nome}.` });
}

// Item 15 — áreas de atuação do gabinete (para prioridade e leitura de UI)
export const AREAS_GABINETE = [
  { id: 'projetos', nome: 'Projetos de lei' },
  { id: 'negociacao_votos', nome: 'Negociação de votos' },
  { id: 'midia', nome: 'Comunicação e mídia' },
  { id: 'territorio', nome: 'Território e demandas' },
  { id: 'fiscalizacao', nome: 'Fiscalização e orçamento' },
  { id: 'aliancas', nome: 'Articulação política' },
];
export const DELEGACOES = [
  { id: 'comunicacao', nome: 'Cuidar da comunicação', desc: 'assessoria posta conteúdo e sustenta sua notoriedade.' },
  { id: 'territorio', nome: 'Monitorar o território', desc: 'equipe roda os bairros e mantém sua presença.' },
  { id: 'projetos', nome: 'Tocar os projetos', desc: 'assessoria parlamentar empurra o apoio dos projetos em tramitação.' },
  { id: 'entrevistas', nome: 'Buscar entrevistas', desc: 'gabinete corre atrás de espaço na imprensa.' },
];

// quantas rotinas o gabinete consegue tocar em paralelo depende do chefe
export function capacidadeDelegacao(state) {
  const c = chefeGabinete(state);
  if (!c) return 0;
  return c.competencia >= 65 ? 3 : c.competencia >= 45 ? 2 : 1;
}

export function delegar(state, rotina, ligar = true) {
  const g = state.mandato?.gabinete;
  if (!g) throw new Error('Sem gabinete.');
  if (!DELEGACOES.some((d) => d.id === rotina)) throw new Error('Rotina inválida.');
  g.delegacoes = g.delegacoes || {};
  if (ligar) {
    if (!chefeGabinete(state)) throw new Error('Contrate um chefe de gabinete antes de delegar.');
    const ativas = Object.values(g.delegacoes).filter(Boolean).length;
    if (ativas >= capacidadeDelegacao(state)) throw new Error(`Seu chefe de gabinete só dá conta de ${capacidadeDelegacao(state)} rotina(s) ao mesmo tempo.`);
    g.delegacoes[rotina] = true;
  } else {
    delete g.delegacoes[rotina];
  }
  return { ok: true };
}

export function definirPrioridade(state, area) {
  const g = state.mandato?.gabinete;
  if (!g) throw new Error('Sem gabinete.');
  g.prioridade = g.prioridade === area ? null : area;
  return { ok: true, prioridade: g.prioridade };
}

// reunião de alinhamento — 1 tempo, 1x/mês. Sobe a lealdade da equipe e devolve
// um briefing curto da situação (as áreas mais fracas do gabinete).
export function reuniaoGabinete(state) {
  const g = state.mandato?.gabinete;
  if (!g) throw new Error('Sem gabinete.');
  if (g.ultimaReuniao === state.tempo.mes) throw new Error('Você já reuniu o gabinete este mês.');
  if ((state.tempo.pontosRestantes ?? 0) < 1) throw new Error('Sem tempo (custa 1).');
  state.tempo.pontosRestantes -= 1;
  g.ultimaReuniao = state.tempo.mes;
  const rng = createRng(state.meta.seed, state.meta.rngState);
  for (const a of Object.values(g.contratados)) {
    a.lealdade = clamp(a.lealdade + rng.range([1, 3]), 0, 100);
  }
  state.meta.rngState = rng.state;
  const areas = AREAS_GABINETE.map((ar) => ({ ...ar, m: multGabinete(state, ar.id) })).sort((x, y) => x.m - y.m);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'GABINETE', texto: 'Reunião de gabinete — equipe alinhada.' });
  return {
    ok: true,
    briefing: [
      `Ponto mais frágil do gabinete: ${areas[0].nome} (rendimento ${Math.round(areas[0].m * 100)}%).`,
      `Mais forte: ${areas[areas.length - 1].nome} (${Math.round(areas[areas.length - 1].m * 100)}%).`,
      chefeGabinete(state) ? `Chefia: ${chefeGabinete(state).nome}, lealdade ${Math.round(chefeGabinete(state).lealdade)}.` : 'Você está sem chefe de gabinete — a casa rende menos.',
    ],
  };
}

export function promoverAssessor(state, cargoChave) {
  const g = state.mandato?.gabinete;
  const a = g?.contratados[cargoChave];
  if (!a) throw new Error('Ninguém nesse cargo.');
  const novoSalario = Math.round(a.salario * 1.25 / 100) * 100;
  const folha = Object.values(g.contratados).reduce((s, x) => s + x.salario, 0) - a.salario + novoSalario;
  if (folha > g.verbaMensal * 1.05) throw new Error('A folha estouraria a verba.');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  a.salario = novoSalario;
  a.lealdade = clamp(a.lealdade + rng.range([8, 16]), 0, 100);
  a.competencia = clamp(a.competencia + rng.range([1, 4]), 5, 100);
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'GABINETE', texto: `${a.nome} promovido(a) — salário e lealdade em alta.` });
  return { ok: true };
}

// Prioridade 7 — bancar capacitação do próprio bolso: sobe a experiência do
// assessor (soma à competência efetiva), com retorno decrescente e cooldown.
export function custoTreino(a) {
  return Math.round((3500 + (a?.salario || 0) * 0.4) / 100) * 100;
}
export function treinarAssessor(state, cargoChave) {
  const g = state.mandato?.gabinete;
  const a = g?.contratados[cargoChave];
  if (!a) throw new Error('Ninguém nesse cargo.');
  if (a.ultimoTreino != null && state.tempo.mes - a.ultimoTreino < 4) throw new Error('Capacitação recente — espere alguns meses.');
  const custo = custoTreino(a);
  if ((state.financas.pessoal || 0) < custo) throw new Error('Sem dinheiro para bancar a capacitação.');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.financas.pessoal -= custo;
  const teto = 2.5;
  const ganho = clamp((teto - (a.experiencia || 0)) * rng.range([0.18, 0.32]), 0.08, 0.6);
  a.experiencia = Math.min(teto, (a.experiencia || 0) + ganho);
  a.lealdade = clamp(a.lealdade + rng.range([2, 6]), 0, 100);
  a.ultimoTreino = state.tempo.mes;
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'GABINETE', texto: `${a.nome} fez uma capacitação (R$ ${custo.toLocaleString('pt-BR')}) — o rendimento melhora.` });
  return { ok: true, ganho: Math.round(ganho * 6) };
}

export function demitirAssessor(state, cargoChave) {
  const g = state.mandato.gabinete;
  const a = g.contratados[cargoChave];
  if (!a) return;
  delete g.contratados[cargoChave];
  // demissão de alguém leal pode gerar ressentimento; de ambicioso, um rival
  if (a.risco === 'vira rival') {
    state.log.unshift({ mes: state.tempo.mes, tipo: 'ALERTA', texto: `${a.nome} saiu do gabinete magoado(a) e promete disputar espaço político com você.` });
  } else {
    state.log.unshift({ mes: state.tempo.mes, tipo: 'GABINETE', texto: `${a.nome} desligado(a) do gabinete.` });
  }
}

// --- Projetos ---
export function gerarProposta(state, { tema, tipo, bairroId }, rng) {
  const t = lawsDef.temas.find((x) => x.id === tema);
  const tp = lawsDef.tipos.find((x) => x.id === tipo);
  const bairro = BAIRROS.find((b) => b.id === bairroId);
  const titulos = lawsDef.titulos[tema] || [`Projeto sobre ${t.nome}`];
  const titulo = rng.pick(titulos).replace('{bairro}', bairro ? bairro.nome : 'cidade');
  return {
    id: `pj_${state.tempo.mes}_${rng.int(1000, 9999)}`,
    titulo,
    tema,
    tipo,
    bairroFoco: bairroId || null,
    status: 'TRAMITANDO',
    apoio: 0, // 0-100, evolui com negociação
    custoPolitico: tp.custoPolitico,
    impacto: rng.rangeInt(tp.impacto),
    popularidade: 0,
    eixo: t.eixo,
    precisaMaioria: tp.precisaMaioria,
    mesProposto: state.tempo.mes,
    prazo: state.tempo.mes + tp.prazoMeses,
    votos: null,
  };
}

// apoio parlamentar base para um projeto: alinhamento das bancadas + relações do jogador
function apoioBaseParlamentar(state, projeto) {
  const meuPartido = partido(state.personagem.partidoId);
  let favor = 0; let total = 0;
  for (const p of partiesDef.partidos) {
    const pr = state.mundo.partidosRuntime?.[p.id];
    const cadeiras = pr?.bancada || 0;
    if (!cadeiras) continue;
    total += cadeiras;
    const distEixo = Math.abs(p.eixo - projeto.eixo) / 100;
    const alinhamento = 1 - distEixo; // 0..1
    const mesmoLado = p.id === meuPartido.id ? 0.35
      : Math.sign(p.eixo || 1) === Math.sign(meuPartido.eixo || 1) ? 0.18 : 0;
    favor += cadeiras * clamp(alinhamento + mesmoLado - 0.18, -0.35, 1);
  }
  // relações com políticos que são vereadores + aliados do grupo
  const vereadoresAmigos = Object.values(state.mundo.politicos || {})
    .filter((x) => x.cargo === 'VEREADOR' && x.relacaoJogador > 20).length;
  const grupoVereadores = state.personagem.grupoPolitico
    .filter((id) => state.mundo.politicos?.[id]?.cargo === 'VEREADOR').length;
  const base = total ? (favor / total) * 100 : 35;

  // Fase 18 — governista aprova mais fácil; oposição apanha nos projetos de lei
  const pos = state.mandato?.posicao;
  let bonusPosicao = 0;
  if (pos === 'BASE') bonusPosicao = projeto.precisaMaioria ? 14 : 8;
  else if (pos === 'OPOSICAO') bonusPosicao = projeto.precisaMaioria ? -12 : -2;

  // Fase 19 — relatoria: se você participa da comissão do tema, mais apoio;
  // e mais ainda se preside
  const com = comissaoDoTema(projeto.tema);
  let bonusComissao = 0;
  if (com && state.mandato?.comissoes) {
    if (state.mandato.comissoes.presidindo === com.id) bonusComissao = 12;
    else if (state.mandato.comissoes.participando.includes(com.id)) bonusComissao = 6;
  }

  return clamp(
    base + vereadoresAmigos * 2.5 + grupoVereadores * 5
    + (state.reputacao.aprovacao - 50) * 0.35 + bonusPosicao + bonusComissao,
    8, 94,
  );
}

export function proporProjeto(state, proposta, rng) {
  proposta.apoio = Math.round(apoioBaseParlamentar(state, proposta));
  proposta.popularidade = 0;
  state.mandato.projetos.unshift(proposta);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([0.5, 2]), 0, 100);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MANDATO', texto: `Você protocolou: "${proposta.titulo}" (apoio inicial estimado ${proposta.apoio}%).` });
}

export function negociarVotos(state, projetoId, rng) {
  const pj = state.mandato.projetos.find((p) => p.id === projetoId);
  if (!pj || pj.status !== 'TRAMITANDO') throw new Error('Projeto não está em tramitação.');
  const skill = forcaGabinete(state, 'negociacao_votos');
  const nego = (state.personagem.atributos.negociacao - 50) / 120;
  const ganho = clamp((rng.range([6, 15]) * skill) + nego * 10, 2, 28);
  pj.apoio = clamp(pj.apoio + ganho, 0, 98);
  pj.custoPolitico += 1;
  // custa capital: leve queda de relação com quem discorda
  return Math.round(ganho);
}

// resolve a sessão da Câmara do mês: vota projetos com prazo vencido ou apoio alto
function resolverSessao(state, rng, eventos) {
  const m = state.tempo.mes;
  const itens = [];
  for (const pj of state.mandato.projetos) {
    if (pj.status !== 'TRAMITANDO') continue;
    // só vai a voto se tiver chance real, ou se estourou de vez o prazo
    const vencido = (m >= pj.prazo && pj.apoio >= 40) || m > pj.prazo + 3;
    const pronto = pj.apoio >= 55 && rng.chance(0.5);
    if (!vencido && !pronto) continue;

    if (!pj.precisaMaioria) {
      pj.status = 'APROVADO';
      pj.votos = { sim: 0, nao: 0 };
      aplicarAprovacao(state, pj, rng);
      itens.push({ projetoId: pj.id, titulo: pj.titulo, resultado: 'APROVADO' });
      continue;
    }
    const cadeiras = 39;
    const p = clamp(pj.apoio / 100 + rng.gauss(0, 0.08), 0, 1);
    const sim = Math.round(cadeiras * p);
    const aprovado = sim > cadeiras / 2;
    pj.votos = { sim, nao: cadeiras - sim };
    pj.status = aprovado ? 'APROVADO' : 'REJEITADO';
    if (aprovado) aplicarAprovacao(state, pj, rng);
    else {
      state.mandato.indicadores.projetosRejeitados++;
      state.reputacao.aprovacao = clamp(state.reputacao.aprovacao - rng.range([0.5, 2]), 0, 100);
    }
    itens.push({ projetoId: pj.id, titulo: pj.titulo, resultado: pj.status, placar: `${sim}x${cadeiras - sim}` });
  }
  if (itens.length) {
    state.mandato.sessoes.unshift({ mes: m, itens });
    for (const it of itens) {
      eventos.push({ tipo: 'MANDATO', texto: `Sessão: "${it.titulo}" ${it.resultado === 'APROVADO' ? 'APROVADO' : it.resultado === 'REJEITADO' ? `REJEITADO (${it.placar})` : it.resultado}.` });
    }
  }
}

function aplicarAprovacao(state, pj, rng) {
  state.mandato.indicadores.projetosAprovados++;
  // retornos decrescentes: quanto mais alta a aprovação, menos um projeto move
  const teto = (100 - state.reputacao.aprovacao) / 100;
  const popGain = pj.impacto * rng.range([0.08, 0.18]) * (0.4 + teto);
  state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + popGain, 0, 100);
  state.reputacao.confianca = clamp(state.reputacao.confianca + popGain * 0.5, 0, 100);
  // território no bairro foco
  if (pj.bairroFoco) {
    const t = state.territorio.porBairro[pj.bairroFoco] || { presenca: 0, penetracao: 0 };
    t.presenca = clamp(t.presenca + pj.impacto * 0.4, 0, 100);
    t.penetracao = clamp(t.penetracao + pj.impacto * 0.5, 0, 100);
    state.territorio.porBairro[pj.bairroFoco] = t;
  }
  // Fase 8 — a entrega agrada os grupos sociais mobilizados pela pauta
  impactoDeTema(state, pj.tema, pj.impacto * rng.range([0.35, 0.7]));
  // Prioridade 6 — repercussão: entrega grande rende holofote e eco de mídia
  const rep = clamp(pj.impacto / 24, 0.15, 1.2);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rep * rng.range([0.5, 1.3]), 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rep * rng.range([0.6, 1.7]), -50, 100);
  // Etapa 2 — progride/cumpre promessas relacionadas (match estrutural, não string)
  cumprirPromessas(state, { tema: pj.tema, bairroId: pj.bairroFoco });
}

// Match por tema canônico + bairro. Projeto no par exato cumpre; mesmo tema em
// bairro diferente (ou vice-versa) rende progresso parcial.
export function cumprirPromessas(state, { tema, bairroId }) {
  if (!state.mandato) return;
  const t = temaCanonico(tema);
  for (const pr of state.mandato.promessas) {
    if (pr.cumprida) continue;
    const casaTema = pr.tema === t;
    const casaBairro = pr.bairroId === bairroId;
    if (!casaTema && !casaBairro) continue;
    // projeto entregue no par exato = promessa cumprida; senão, progresso parcial
    pr.progresso = casaTema && casaBairro
      ? 100
      : Math.min(95, (pr.progresso || 0) + (casaTema ? 22 : 12));
    if (pr.progresso >= 100) {
      pr.cumprida = true;
      pr.mesCumprida = state.tempo.mes;
      state.reputacao.confianca = clamp(state.reputacao.confianca + 4, 0, 100);
      impactoDeTema(state, pr.tema, 6);
      state.mundo.noticias.unshift({
        id: `nt_pr_${pr.id}`, mes: state.tempo.mes, tipo: 'CIDADE', destaque: true, atores: [],
        texto: `Você cumpriu a promessa sobre ${pr.tema} na ${BAIRROS.find((b) => b.id === pr.bairroId)?.nome || 'cidade'}.`,
      });
    }
  }
}

export function registrarPromessa(state, { tema, bairroId }) {
  const t = temaCanonico(tema);
  // não duplica: se já há promessa aberta no mesmo par, não cria outra
  if (state.mandato.promessas.some((p) => !p.cumprida && p.tema === t && p.bairroId === bairroId)) return;
  state.mandato.promessas.push({
    id: `prom_${state.tempo.mes}_${bairroId}_${t}_${state.mandato.promessas.length}`,
    tema: t, bairroId, mesFeita: state.tempo.mes, prazo: state.tempo.mes + 18,
    progresso: 0, cumprida: false,
  });
}

// fiscalização: chance de achar irregularidade → notoriedade + rejeição de alvo
export function fiscalizar(state, rng) {
  state.mandato.indicadores.fiscalizacoes++;
  const skill = forcaGabinete(state, 'fiscalizacao');
  const oposicao = state.mandato.posicao === 'OPOSICAO';
  const base = state.mandato.posicao === 'BASE' ? 0.14 : 0.25; // governista fiscaliza menos o próprio governo
  const achou = rng.float() < base + skill * 0.25 + (oposicao ? 0.12 : 0) + (state.personagem.atributos.coragem - 50) / 200;
  if (achou) {
    const m = oposicao ? 1.4 : 1;
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([3, 8]) * m, 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([4, 12]) * m, -50, 100);
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([0.5, 2]) * ((100 - state.reputacao.aprovacao) / 60), 0, 100);
    state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura - rng.int(oposicao ? 3 : 8, oposicao ? 8 : 18), -100, 100);
    impactoDeTema(state, 'transparencia', rng.range([3, 6]));
    return { achou: true, texto: 'Você expôs uma irregularidade num contrato. Repercussão alta — e a prefeitura não gostou.' };
  }
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([0, 1.5]), 0, 100);
  return { achou: false, texto: 'Fiscalização feita, sem achados relevantes desta vez.' };
}

// --- Fase 18: base × oposição ---
const PREF_ID = 'np_joao_campos';
function prefeitoDe(state) {
  return state.mundo.politicos?.[PREF_ID] || Object.values(state.mundo.politicos || {}).find((p) => p.cargo === 'PREFEITO');
}

export function declararPosicao(state, posicao, rng) {
  if (!state.mandato) throw new Error('Só no mandato.');
  const antes = state.mandato.posicao;
  state.mandato.posicao = posicao;
  const pref = prefeitoDe(state);
  const nomePref = pref?.nome || 'o prefeito';
  const m = state.tempo.mes;
  if (posicao === 'BASE') {
    state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura + rng.int(15, 30), -100, 100);
    if (pref) pref.relacaoJogador = clamp(pref.relacaoJogador + rng.int(10, 20), -100, 100);
    state.log.unshift({ mes: m, tipo: 'MANDATO', texto: `Você declarou apoio à gestão de ${nomePref}. Acesso a emendas e obras — mas sua imagem agora anda junto com a do prefeito.` });
  } else if (posicao === 'OPOSICAO') {
    state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura - rng.int(20, 40), -100, 100);
    if (pref) pref.relacaoJogador = clamp(pref.relacaoJogador - rng.int(12, 25), -100, 100);
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.int(2, 5), 0, 100);
    state.log.unshift({ mes: m, tipo: 'MANDATO', texto: `Você se declarou oposição a ${nomePref}. Liberdade para criticar e ganhar holofote — mas seus projetos de lei vão penar.` });
  } else {
    state.log.unshift({ mes: m, tipo: 'MANDATO', texto: 'Você optou por manter independência em relação à prefeitura.' });
  }
  state.mundo.noticias.unshift({
    id: `nt_pos_${m}`, mes: m, tipo: 'POLITICA', destaque: true, atores: [PREF_ID],
    texto: `Vereador${antes === posicao ? ' reafirma' : ' se declara'} ${posicao === 'BASE' ? 'na base do governo' : posicao === 'OPOSICAO' ? 'na oposição' : 'independente'}.`,
  });
}

// --- Fase 19: comissões ---
export function pedirVagaComissao(state, comissaoId, rng) {
  const c = comissaoPorId(comissaoId);
  if (!c) throw new Error('Comissão inválida.');
  const com = state.mandato.comissoes;
  if (com.participando.includes(comissaoId)) return { ok: true, msg: `Você já está na ${c.nome}.` };
  if (com.participando.length >= 3) return { ok: false, msg: 'Você já ocupa o máximo de 3 comissões.' };
  const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
  const chance = clamp(0.3 + (pr ? pr.apoioAoJogador / 200 : 0) + (state.personagem.atributos.negociacao - 50) / 200
    + (pr?.diretorioDoJogador ? 0.25 : 0) - c.prestigio / 400, 0.1, 0.9);
  if (rng.chance(chance)) {
    com.participando.push(comissaoId);
    state.log.unshift({ mes: state.tempo.mes, tipo: 'MANDATO', texto: `Você conquistou uma vaga na ${c.nome}.` });
    return { ok: true, msg: `Vaga garantida na ${c.nome}.` };
  }
  return { ok: false, msg: `A vaga na ${c.nome} ficou com outro vereador — o partido não te bancou desta vez.` };
}

export function disputarPresidenciaComissao(state, comissaoId, rng) {
  const c = comissaoPorId(comissaoId);
  if (!c) throw new Error('Comissão inválida.');
  const com = state.mandato.comissoes;
  if (!com.participando.includes(comissaoId)) return { ok: false, msg: `Primeiro consiga uma vaga na ${c.nome}.` };
  if (com.presidindo === comissaoId) return { ok: true, msg: `Você já preside a ${c.nome}.` };
  const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
  const chance = clamp(0.15 + (pr ? pr.apoioAoJogador / 260 : 0) + (state.personagem.atributos.influencia - 50) / 180
    + (pr?.diretorioDoJogador ? 0.3 : 0) + (state.mandato.posicao === 'BASE' ? 0.12 : 0) - c.prestigio / 300, 0.05, 0.85);
  if (rng.chance(chance)) {
    com.presidindo = comissaoId;
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.int(3, 8), 0, 100);
    state.mundo.noticias.unshift({ id: `nt_pres_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'POLITICA', destaque: true, atores: [], texto: `Vereador eleito presidente da ${c.nome}.` });
    state.log.unshift({ mes: state.tempo.mes, tipo: 'MANDATO', texto: `Você é o novo presidente da ${c.nome}. Poder de agenda sobre ${c.temas.join(', ')}.` });
    return { ok: true, msg: `Você preside a ${c.nome}.` };
  }
  return { ok: false, msg: `A presidência da ${c.nome} foi para um nome mais forte no colégio de líderes.` };
}

// --- tick mensal do mandato --- (recebe estado já clonado; muta e devolve)
export function mandateTick(s) {
  if (s.personagem.fase !== 'MANDATO' || !s.mandato) return { state: s, eventos: [] };
  const rng = streamRng(s.meta.seed, "mandate", s.tempo.mes);
  const eventos = [];
  const m = s.tempo.mes;

  // verba de gabinete: crédito e folha
  s.financas.gabinete += s.mandato.gabinete.verbaMensal;
  const folha = Object.values(s.mandato.gabinete.contratados).reduce((sum, a) => sum + a.salario, 0);
  s.financas.gabinete -= folha;
  if (s.financas.gabinete < 0) {
    eventos.push({ tipo: 'ALERTA', texto: 'A folha do gabinete passou da verba — corte pessoal.' });
    s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - 1, 0, 100);
    s.financas.gabinete = 0;
  }
  // sobra de verba não acumula indefinidamente
  s.financas.gabinete = Math.min(s.financas.gabinete, s.mandato.gabinete.verbaMensal * 2);

  // Fase 18 — efeito da posição em relação ao governo
  const pref = prefeitoDe(s);
  if (pref && s.mandato.posicao === 'BASE') {
    // efeito "vagão": sua aprovação é puxada em direção à do prefeito
    const alvo = pref.aprovacao ?? 52;
    s.reputacao.aprovacao = clamp(s.reputacao.aprovacao + (alvo - s.reputacao.aprovacao) * 0.06, 0, 100);
    s.mandato.relacaoPrefeitura = clamp(s.mandato.relacaoPrefeitura + 0.5, -100, 100);
    // obra do governo num bairro seu, de vez em quando
    if (rng.chance(0.08)) {
      const bid = Object.entries(s.territorio.porBairro).sort((a, b) => b[1].presenca - a[1].presenca)[0]?.[0];
      if (bid) {
        const t = s.territorio.porBairro[bid];
        t.penetracao = clamp(t.penetracao + rng.range([2, 5]), 0, 100);
        eventos.push({ tipo: 'MANDATO', texto: `A prefeitura entregou uma obra num bairro seu — e você estava lá.` });
      }
    }
  } else if (s.mandato.posicao === 'OPOSICAO') {
    s.mandato.relacaoPrefeitura = clamp(s.mandato.relacaoPrefeitura - 0.4, -100, 100);
    // prefeito impopular derrete e você colhe: eco de oposição
    if (pref && (pref.aprovacao ?? 52) < 42 && rng.chance(0.15)) {
      s.reputacao.aprovacao = clamp(s.reputacao.aprovacao + rng.range([0.5, 2]), 0, 100);
      s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([1, 3]), 0, 100);
    }
  }

  // Fase 19 — dividendos de presidir uma comissão
  if (s.mandato.comissoes?.presidindo) {
    s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([0.3, 1.2]), 0, 100);
    // um rival pode contestar a presidência
    if (rng.chance(0.02)) {
      const c = comissaoPorId(s.mandato.comissoes.presidindo);
      s.mandato.comissoes.presidindo = null;
      eventos.push({ tipo: 'POLITICA', texto: `Você perdeu a presidência da ${c?.nome || 'comissão'} numa recomposição de forças na Câmara.` });
    }
  }

  // sessão da Câmara
  resolverSessao(s, rng, eventos);

  // projetos parados perdem apoio; prazo estoura -> arquivado
  for (const pj of s.mandato.projetos) {
    if (pj.status === 'TRAMITANDO') {
      pj.apoio = clamp(pj.apoio - rng.range([0.5, 2]), 0, 100);
      if (m > pj.prazo + 2) { pj.status = 'ARQUIVADO'; eventos.push({ tipo: 'MANDATO', texto: `"${pj.titulo}" foi arquivado por falta de andamento.` }); }
    }
  }

  // Item 14 — o chefe de gabinete dá o tom da casa
  const chefe = s.mandato.gabinete.contratados.chefe_gabinete;
  const chefeLeal = chefe && chefe.lealdade >= 60;
  const chefeAmbicioso = chefe && chefe.risco === 'vira rival';

  // eventos de gabinete (lealdade baixa / traço problemático)
  for (const [chave, a] of Object.entries(s.mandato.gabinete.contratados)) {
    // experiência acumula devagar no cargo (teto ~2.5 pontos, ~+15 de competência)
    a.experiencia = Math.min(2.5, (a.experiencia || 0) + rng.range([0.03, 0.07]));
    const pedeDemissao = 0.03 * (chefeLeal ? 0.5 : 1) + (chefeAmbicioso && chave !== 'chefe_gabinete' ? 0.02 : 0);
    if (rng.chance(pedeDemissao) && a.lealdade < 45) {
      if (a.risco === 'gera crise') {
        s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([3, 9]), 0, 100);
        s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico - rng.range([2, 8]), -50, 100);
        eventos.push({ tipo: 'ALERTA', texto: `${a.nome} (gabinete) se envolveu numa polêmica que respingou em você.` });
      } else {
        delete s.mandato.gabinete.contratados[chave];
        eventos.push({ tipo: 'GABINETE', texto: `${a.nome} pediu demissão do gabinete.` });
      }
    }
    // chefe leal segura a lealdade da equipe; chefe ambicioso corrói
    const driftBase = rng.range([-1, 1.5]);
    const driftChefe = chave === 'chefe_gabinete' ? 0 : (chefeLeal ? 0.8 : chefeAmbicioso ? -0.8 : 0);
    if (a) a.lealdade = clamp(a.lealdade + driftBase + driftChefe, 0, 100);
  }
  // chefe ambicioso muito competente e pouco leal pode romper e virar rival de peso
  if (chefeAmbicioso && chefe.lealdade < 30 && (m - (s.mandato.mesInicio)) > 12 && rng.chance(0.04)) {
    delete s.mandato.gabinete.contratados.chefe_gabinete;
    s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + rng.range([4, 10]), -50, 100);
    eventos.push({ tipo: 'ALERTA', texto: `${chefe.nome} deixou a chefia de gabinete e vai disputar espaço político contra você.` });
  }

  // Item 15 — tarefas delegadas ao gabinete rendem um efeito passivo por mês
  const del = s.mandato.gabinete.delegacoes || {};
  if (del.comunicacao) {
    s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([0.2, 0.8]) * multGabinete(s, 'midia'), 0, 100);
  }
  if (del.territorio) {
    const bs = Object.keys(s.territorio.porBairro);
    if (bs.length) {
      const bid = bs[m % bs.length];
      const t = s.territorio.porBairro[bid];
      t.presenca = clamp(t.presenca + rng.range([0.3, 1.1]) * multGabinete(s, 'territorio'), 0, 100);
    }
  }
  if (del.projetos) {
    for (const pj of s.mandato.projetos) {
      if (pj.status === 'TRAMITANDO') pj.apoio = clamp(pj.apoio + rng.range([0.4, 1.6]) * multGabinete(s, 'projetos'), 0, 100);
    }
  }
  if (del.entrevistas && rng.chance(0.12 * multGabinete(s, 'midia'))) {
    s.mundo.convitesMidia = s.mundo.convitesMidia || [];
    if (s.mundo.convitesMidia.length < 3) {
      const j = pressJornalistas[rng.int(0, pressJornalistas.length - 1)];
      if (j && !s.mundo.convitesMidia.some((c) => c.refId === j.id)) {
        s.mundo.convitesMidia.push({ id: `cv_${j.id}_${m}`, tipo: 'entrevista', refId: j.id, criadoMes: m, expiraMes: m + 3 });
        eventos.push({ tipo: 'MIDIA', texto: `Seu gabinete conseguiu um convite de entrevista.` });
      }
    }
  }

  // aprovação: regressão à média + desgaste de mandato (cresce ao longo do termo)
  const mesAtual = m - s.mandato.mesInicio;
  const desgaste = 0.35 + (mesAtual / 48) * 0.7;
  s.reputacao.aprovacao = clamp(
    s.reputacao.aprovacao + (46 - s.reputacao.aprovacao) * 0.08 - desgaste,
    0, 100,
  );
  for (const pr of s.mandato.promessas) {
    if (!pr.cumprida && !pr.cobrada && m >= pr.prazo) {
      pr.cobrada = true;
      s.reputacao.confianca = clamp(s.reputacao.confianca - rng.range([3, 7]), 0, 100);
      s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([1, 4]), 0, 100);
      eventos.push({ tipo: 'ALERTA', texto: `Cobrança: a promessa sobre ${pr.tema} na ${BAIRROS.find((b) => b.id === pr.bairroId)?.nome || 'cidade'} não saiu do papel.` });
    }
  }

  // fim do mandato: abre quando a janela de candidatura da próxima eleição abre
  // (você ainda está no cargo, mas precisa decidir se disputa a reeleição)
  const jan = janelaCandidatura(s);
  if (jan.aberta && !s.mandato.encerrando) {
    eventos.push({ tipo: 'MARCO', texto: `A eleição de ${jan.ano} se aproxima. Decida na Agenda se disputa a reeleição — a janela fecha em ${Math.max(0, jan.fecha - m)} mês(es).` });
    s.mandato.encerrando = true;
  }

  for (const ev of eventos) s.log.unshift({ mes: m, tipo: ev.tipo, texto: ev.texto });
  s.log = s.log.slice(0, 220);
  s.meta.rngState = rng.state;
  return { state: s, eventos };
}

// --- wrappers usados direto pela aba Mandato (custo de tempo/energia embutido) ---
export function protocolarProjeto(state, { tema, tipo, bairroId }) {
  if (state.tempo.pontosRestantes < 3) throw new Error('Sem tempo suficiente este mês (custa 3).');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= 3;
  state.tempo.energia = clamp(state.tempo.energia - 12, 0, state.tempo.energiaMax);
  const proposta = gerarProposta(state, { tema, tipo, bairroId }, rng);
  proporProjeto(state, proposta, rng);
  state.meta.rngState = rng.state;
}

export function negociarVotosProjeto(state, projetoId) {
  if (state.tempo.pontosRestantes < 2) throw new Error('Sem tempo suficiente este mês (custa 2).');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= 2;
  state.tempo.energia = clamp(state.tempo.energia - 12, 0, state.tempo.energiaMax);
  const g = negociarVotos(state, projetoId, rng);
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MANDATO', texto: `Você negociou votos: apoio +${g}%.` });
}

// Fase 18/19 — ações institucionais (custo embutido)
export function declararPosicaoJogador(state, posicao) {
  const rng = createRng(state.meta.seed, state.meta.rngState);
  declararPosicao(state, posicao, rng);
  state.meta.rngState = rng.state;
}

export function acaoComissao(state, comissaoId, tipo) {
  if (state.tempo.pontosRestantes < 2) throw new Error('Sem tempo suficiente este mês (custa 2).');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= 2;
  state.tempo.energia = clamp(state.tempo.energia - 8, 0, state.tempo.energiaMax);
  const r = tipo === 'presidencia'
    ? disputarPresidenciaComissao(state, comissaoId, rng)
    : pedirVagaComissao(state, comissaoId, rng);
  state.meta.rngState = rng.state;
  if (!r.ok) state.log.unshift({ mes: state.tempo.mes, tipo: 'POLITICA', texto: r.msg });
  return r;
}

export { MANDATO_MESES };
