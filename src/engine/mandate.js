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

const BAIRROS = neighborhoods.bairros;
const MANDATO_MESES = 48;
export const COMISSOES = committeesDef.comissoes;

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
  const mesFim = Math.max(state.tempo.mes + 36, fimDoMandato(state, tipoPleito));
  // verba de gabinete escala com o porte do cargo
  const verba = Math.round(staffDef.verbaMensalBase
    * (cargo.circunscricao === 'ESTADO' ? 2.4 : executivo ? 4 : 1));
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

// competência efetiva do gabinete numa área
export function forcaGabinete(state, area) {
  const g = state.mandato?.gabinete;
  if (!g) return 0.5;
  let soma = 0; let n = 0;
  for (const cargo of staffDef.cargos) {
    const a = g.contratados[cargo.chave];
    if (a && cargo.afeta.includes(area)) {
      soma += a.competencia * (0.6 + a.lealdade / 250);
      n++;
    }
  }
  return n ? 0.5 + (soma / n / 100) : 0.45;
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
  // cumpre promessa relacionada
  for (const pr of state.mandato.promessas) {
    if (!pr.cumprida && pr.tema === pj.tema && pr.bairroId === pj.bairroFoco) {
      pr.cumprida = true;
      state.reputacao.confianca = clamp(state.reputacao.confianca + 4, 0, 100);
      state.mundo.noticias.unshift({ id: `nt_pr_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'CIDADE', destaque: true, atores: [], texto: `Você cumpriu a promessa sobre ${pr.tema} na ${BAIRROS.find((b) => b.id === pr.bairroId)?.nome || 'cidade'}.` });
    }
  }
}

export function registrarPromessa(state, { tema, bairroId }) {
  state.mandato.promessas.push({
    id: `prom_${state.tempo.mes}_${bairroId}_${tema}`,
    tema, bairroId, mesFeita: state.tempo.mes, prazo: state.tempo.mes + 18, cumprida: false,
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

  // eventos de gabinete (lealdade baixa / traço problemático)
  for (const [chave, a] of Object.entries(s.mandato.gabinete.contratados)) {
    if (rng.chance(0.03) && a.lealdade < 45) {
      if (a.risco === 'gera crise') {
        s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([3, 9]), 0, 100);
        s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico - rng.range([2, 8]), -50, 100);
        eventos.push({ tipo: 'ALERTA', texto: `${a.nome} (gabinete) se envolveu numa polêmica que respingou em você.` });
      } else {
        delete s.mandato.gabinete.contratados[chave];
        eventos.push({ tipo: 'GABINETE', texto: `${a.nome} pediu demissão do gabinete.` });
      }
    }
    if (a) a.lealdade = clamp(a.lealdade + rng.range([-1, 1.5]), 0, 100);
  }

  // aprovação: regressão à média + desgaste de mandato (cresce ao longo do termo)
  const mesAtual = m - s.mandato.mesInicio;
  const desgaste = 0.2 + (mesAtual / 48) * 0.5;
  s.reputacao.aprovacao = clamp(
    s.reputacao.aprovacao + (50 - s.reputacao.aprovacao) * 0.05 - desgaste,
    0, 100,
  );
  for (const pr of s.mandato.promessas) {
    if (!pr.cumprida && m === pr.prazo) {
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
