// Item 1 — vida partidária: pedir filiação, negociar entrada, trocar de sigla, sair.
// Reaproveita mundo.partidosRuntime (apoioAoJogador, popularidade) e o calendário
// eleitoral (janela partidária). Não cria sistema novo de "força" — só movimenta
// o que já existe e registra o histórico.

import partiesDef from '../content/parties.json';
import { createRng, clamp } from './rng';
import { proximaEleicao } from './calendar';
import { relevanciaMidiatica } from './social';

const PARTIDOS = partiesDef.partidos;
export function partidoDef(id) {
  return PARTIDOS.find((p) => p.id === id) || null;
}

// A "janela partidária": trocar de sigla sem perder o mandato só vale fora dos
// ~6 meses que antecedem a eleição. Antes disso, a filiação já tem que estar firme.
export function janelaPartidaria(state) {
  const tipo = state.mandato?.tipoPleito || 'MUNICIPAL';
  const prox = proximaEleicao(state, tipo);
  const meses = prox.mes - state.tempo.mes;
  return { aberta: meses > 6, mesesAteEleicao: meses, mesEleicao: prox.mes };
}

// aliados/desafetos do jogador dentro de uma sigla
function aliadosNaSigla(state, pid) {
  return Object.values(state.mundo?.politicos || {})
    .filter((p) => p.ativo && p.partidoId === pid && p.relacaoJogador > 20).length;
}

// Quão disposta a sigla está a receber (ou segurar) você agora. 0-100.
// Partido grande é mais seletivo; afinidade ideológica, notoriedade, relevância
// de mídia e ter gente sua lá dentro pesam a favor. Chegar com rejeição alta pesa contra.
export function receptividade(state, pid) {
  const p = partidoDef(pid);
  if (!p) return 0;
  const atualId = state.personagem.partidoId;
  const eixoRef = atualId && atualId !== pid ? (partidoDef(atualId)?.eixo ?? 0)
    : (state.personagem.atributos?.ambicao ?? 50) - 50;
  const distIdeo = Math.abs(p.eixo - eixoRef); // 0..~160
  const rep = state.reputacao;
  const rel = relevanciaMidiatica(state);
  let r = 42
    + (rep.notoriedade - 35) * 0.55
    + (rel - 30) * 0.35
    + aliadosNaSigla(state, pid) * 5
    - distIdeo * 0.28
    - Math.max(0, rep.rejeicao - 30) * 0.6
    - Math.max(0, p.tamanho - 55) * 0.35 // sigla grande = porta mais estreita
    + (state.personagem.mandatosExercidos?.length ? 12 : 0)
    + (state.negociacaoPartido?.pid === pid ? state.negociacaoPartido.bonus : 0);
  return Math.round(clamp(r, 3, 97));
}

// custo político de sair da sigla atual: mais alto se você tem apoio interno alto
// (traição) ou preside o diretório; menor se o partido te deu as costas.
function custoSaida(state) {
  const pid = state.personagem.partidoId;
  const pr = state.mundo?.partidosRuntime?.[pid];
  if (!pr) return { rejeicao: 3, notoriedade: 0 };
  const apoio = pr.apoioAoJogador ?? 30;
  const rej = clamp(2 + (apoio - 30) * 0.09 + (pr.diretorioDoJogador ? 4 : 0), 1, 12);
  return { rejeicao: Math.round(rej), notoriedade: apoio > 55 ? 2 : 0 };
}

export function opcoesTroca(state) {
  const atual = state.personagem.partidoId;
  const jan = janelaPartidaria(state);
  return PARTIDOS
    .filter((p) => p.id !== atual)
    .map((p) => {
      const rec = receptividade(state, p.id);
      const pr = state.mundo?.partidosRuntime?.[p.id];
      return {
        id: p.id,
        nome: p.nome,
        eixo: p.eixo,
        federacao: p.federacao || null,
        popularidade: pr ? Math.round(pr.popularidade) : null,
        aliados: aliadosNaSigla(state, p.id),
        receptividade: rec,
        aceitaDireto: rec >= 55,
        podeNegociar: rec >= 30 && rec < 55,
        janelaAberta: jan.aberta,
      };
    })
    .sort((a, b) => b.receptividade - a.receptividade);
}

function fecharRegistro(state, motivo) {
  const hist = (state.personagem.partidoHistorico ||= []);
  const aberto = hist.find((h) => h.mesSaida == null);
  if (aberto) {
    aberto.mesSaida = state.tempo.mes;
    aberto.motivo = motivo;
  }
}

function abrirRegistro(state, pid) {
  (state.personagem.partidoHistorico ||= []).push({
    partidoId: pid,
    mesEntrada: state.tempo.mes,
    mesSaida: null,
    motivo: null,
    cargoNaEpoca: state.personagem.cargoAtual || 'NENHUM',
  });
}

// Uma rodada de negociação: gasta tempo (e um afago de campanha opcional) e sobe
// a receptividade daquela sigla por algumas rodadas. Não garante nada.
export function negociarEntrada(state, pid, rng) {
  const p = partidoDef(pid);
  if (!p) throw new Error('Partido inválido.');
  if (pid === state.personagem.partidoId) throw new Error('Você já é dessa sigla.');
  const atual = state.negociacaoPartido?.pid === pid ? state.negociacaoPartido : { pid, bonus: 0, rodadas: 0 };
  const ganho = rng.int(6, 14) + Math.round((state.personagem.atributos?.negociacao ?? 45) - 45) / 5;
  atual.bonus = clamp(atual.bonus + ganho, 0, 38);
  atual.rodadas += 1;
  atual.expira = state.tempo.mes + 3;
  state.negociacaoPartido = atual;
  const rec = receptividade(state, pid);
  return {
    ok: true,
    receptividade: rec,
    msg: rec >= 55
      ? `${p.nome} agora topa sua filiação. Falta confirmar.`
      : `Conversa avançou com o ${p.id} (receptividade ${rec}). Mais uma rodada pode destravar.`,
  };
}

// Efetiva a troca (ou a primeira filiação, se sem partido).
export function trocarPartido(state, pid, rng, { forcar = false } = {}) {
  const p = partidoDef(pid);
  if (!p) throw new Error('Partido inválido.');
  if (pid === state.personagem.partidoId) throw new Error('Você já é filiado a esse partido.');
  const jan = janelaPartidaria(state);
  if (state.mandato && !jan.aberta && !forcar) {
    throw new Error(`Fora da janela partidária: trocar de sigla agora custaria o mandato (eleição em ${jan.mesesAteEleicao} meses).`);
  }
  const rec = receptividade(state, pid);
  if (rec < 55 && !forcar) {
    throw new Error(`${p.nome} ainda não te recebe de portas abertas (receptividade ${rec}). Negocie a entrada.`);
  }

  const m = state.tempo.mes;
  const anterior = state.personagem.partidoId;
  const antDef = partidoDef(anterior);
  const custo = anterior ? custoSaida(state) : { rejeicao: 0, notoriedade: 0 };

  // fecha diretório/registro no partido antigo
  if (anterior) {
    const prAnt = state.mundo.partidosRuntime?.[anterior];
    if (prAnt) {
      if (prAnt.presidenteMunicipal === 'JOGADOR') prAnt.presidenteMunicipal = null;
      prAnt.diretorioDoJogador = false;
      prAnt.apoioAoJogador = clamp((prAnt.apoioAoJogador ?? 30) - rng.int(12, 22), 0, 100);
    }
    fecharRegistro(state, `Migrou para o ${p.id}`);
    // aliados do partido antigo esfriam; alguns rompem
    for (const pol of Object.values(state.mundo.politicos || {})) {
      if (pol.partidoId === anterior && pol.relacaoJogador > 20) {
        pol.relacaoJogador = clamp(pol.relacaoJogador - rng.int(8, 20), -100, 100);
      }
    }
  }

  state.personagem.partidoId = pid;
  if (state.personagem.fase === 'VIDA' || state.personagem.fase === 'VIDA_PUBLICA') {
    state.personagem.fase = 'PARTIDO';
  }
  abrirRegistro(state, pid);
  delete state.negociacaoPartido;

  const prNovo = state.mundo.partidosRuntime?.[pid];
  if (prNovo) {
    // chega por baixo: apoio inicial modesto, melhor se veio negociado / com afinidade
    const base = 18 + Math.round((rec - 40) * 0.35) + aliadosNaSigla(state, pid) * 3;
    prNovo.apoioAoJogador = clamp(base, 8, 62);
  }

  // custo de imagem do troca-troca (mais leve se foi a 1ª filiação)
  const desgaste = anterior ? custo.rejeicao + rng.int(0, 3) : 0;
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + desgaste, 0, 100);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + (anterior ? -custo.notoriedade + 2 : 3), 0, 100);
  if (anterior) state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.int(4, 10), -50, 100);

  const txt = anterior
    ? `${state.personagem.nome} deixou o ${anterior} e se filiou ao ${pid}.`
    : `${state.personagem.nome} filiou-se ao ${pid}.`;
  state.personagem.historicoPolitico.push({ mes: m, texto: anterior ? `Trocou o ${anterior} pelo ${pid}.` : `Filiou-se ao ${p.nome} (${pid}).` });
  state.mundo.noticias.unshift({ id: `nt_part_${m}_${pid}`, mes: m, tipo: 'POLITICA', destaque: !!anterior, atores: [], texto: txt });
  state.log.unshift({ mes: m, tipo: 'MARCO', texto: anterior ? `Filiação trocada: agora você é do ${pid}. Apoio interno recomeça do zero; parte da sua base antiga ficou para trás.` : `Filiação ao ${pid} confirmada.` });

  return { ok: true, msg: anterior ? `Você agora é do ${pid}.` : `Filiado ao ${pid}.`, desgaste, antDef };
}

// Sair sem destino: fica sem legenda. Se estiver com mandato, ele continua, mas
// sem partido não há candidatura nem aporte — e a imprensa nota.
export function sairDoPartido(state, rng) {
  const anterior = state.personagem.partidoId;
  if (!anterior) throw new Error('Você não é filiado a nenhum partido.');
  const m = state.tempo.mes;
  const prAnt = state.mundo.partidosRuntime?.[anterior];
  if (prAnt) {
    if (prAnt.presidenteMunicipal === 'JOGADOR') prAnt.presidenteMunicipal = null;
    prAnt.diretorioDoJogador = false;
    prAnt.apoioAoJogador = clamp((prAnt.apoioAoJogador ?? 30) - rng.int(15, 28), 0, 100);
  }
  fecharRegistro(state, 'Desfiliou-se');
  state.personagem.partidoId = null;
  delete state.negociacaoPartido;
  for (const pol of Object.values(state.mundo.politicos || {})) {
    if (pol.partidoId === anterior && pol.relacaoJogador > 15) {
      pol.relacaoJogador = clamp(pol.relacaoJogador - rng.int(6, 16), -100, 100);
    }
  }
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.int(3, 8), 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.int(6, 14), -50, 100);
  state.personagem.historicoPolitico.push({ mes: m, texto: `Desfiliou-se do ${anterior}.` });
  state.mundo.noticias.unshift({ id: `nt_desfil_${m}`, mes: m, tipo: 'POLITICA', destaque: true, atores: [], texto: `${state.personagem.nome} rompeu com o ${anterior} e está sem partido.` });
  state.log.unshift({ mes: m, tipo: 'MARCO', texto: `Você saiu do ${anterior}. Sem legenda não há candidatura — encontre uma nova sigla antes da próxima janela.` });
  return { ok: true };
}

// limpeza da negociação expirada — chamada barata, pode rodar no tick
export function tickPartido(s) {
  const n = s.negociacaoPartido;
  if (n && (s.tempo.mes > (n.expira ?? 0) || n.pid === s.personagem.partidoId)) delete s.negociacaoPartido;
}

// --- wrappers para a UI (gerenciam rng + custo de tempo, como world.js) ---
function comRng(state, custoTempo, fn) {
  if ((state.tempo.pontosRestantes ?? 0) < custoTempo) {
    throw new Error(`Sem tempo suficiente este mês (custa ${custoTempo}).`);
  }
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= custoTempo;
  const r = fn(rng);
  state.meta.rngState = rng.state;
  return r;
}

export function acaoNegociarPartido(state, pid) {
  return comRng(state, 2, (rng) => negociarEntrada(state, pid, rng));
}
export function acaoTrocarPartido(state, pid, opts = {}) {
  return comRng(state, 1, (rng) => trocarPartido(state, pid, rng, opts));
}
export function acaoSairPartido(state) {
  return comRng(state, 1, (rng) => sairDoPartido(state, rng));
}

export function resumoPartidario(state) {
  const hist = state.personagem.partidoHistorico || [];
  return hist.map((h) => ({
    ...h,
    nome: partidoDef(h.partidoId)?.nome || h.partidoId,
    meses: (h.mesSaida ?? state.tempo.mes) - h.mesEntrada,
    atual: h.mesSaida == null,
  }));
}
