import { createRng, hashSeed, clamp } from './rng';
import partiesDef from '../content/parties.json';
import electorateDef from '../content/electorate.json';
import {
  cargoPorId, unidadesCircunscricao, cadeirasDoCargo, regiaoDaCidade,
} from './offices';
import { bonusImagemGrupo } from './image';

const GRUPOS = Object.fromEntries(electorateDef.grupos.map((g) => [g.id, g]));

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}

// Contexto de uma eleição: cargo + unidades territoriais + cadeiras + escalas.
export function contextoEleicao(state, cargoId = 'VEREADOR') {
  const cargo = cargoPorId(cargoId);
  return {
    cargo,
    cargoId,
    sistema: cargo.sistema,
    circunscricao: cargo.circunscricao,
    unidades: unidadesCircunscricao(state, cargoId),
    cadeiras: cadeirasDoCargo(state, cargoId),
    escala: cargo.escalaEleitorado ?? 1,
    comparecimentoBase: cargo.comparecimentoBase ?? 0.8,
  };
}

// Converte o estado do jogador num "candidato" comparável aos demais.
export function jogadorComoCandidato(state, cargoId = 'VEREADOR') {
  const p = state.personagem;
  const a = p.atributos;
  const cargo = cargoPorId(cargoId);
  const forca = clamp(
    30
    + (a.carisma + a.comunicacao + a.lideranca + a.oratoria + a.influencia) / 20
    + state.reputacao.notoriedade / 5,
    5, 98,
  );

  let bairrosBase = {};
  if (cargo.circunscricao === 'ESTADO') {
    // a base municipal do jogador vira presença concentrada na sua região;
    // o resto do estado depende de notoriedade, partido e mídia.
    const ts = Object.values(state.territorio.porBairro).filter((t) => t.presenca > 0);
    if (ts.length) {
      const mediaEfetiva = ts.reduce((s, t) => s + Math.min(t.presenca, 25 + t.penetracao * 1.6), 0) / ts.length;
      const mediaPen = ts.reduce((s, t) => s + t.penetracao, 0) / ts.length;
      const jaTeveMandato = /VEREADOR|PREFEITO|DEPUTADO/.test(p.cargoAtual || '') ? 1.35 : 1;
      bairrosBase[regiaoDaCidade(p.cidade)] = clamp(
        (mediaEfetiva / 260 + mediaPen / 320) * jaTeveMandato, 0, 0.4,
      );
    }
  } else {
    for (const [bid, t] of Object.entries(state.territorio.porBairro)) {
      if (t.presenca <= 0) continue;
      // presença sem penetração (voto firme) rende pouco — aparecer não é ser votado.
      // Fase 33 — teto e divisores mais duros: mesmo um reduto forte não "entrega"
      // o bairro sozinho; penetração (voto firme) é o que realmente conta.
      const efetiva = Math.min(t.presenca, 22 + t.penetracao * 1.45);
      bairrosBase[bid] = clamp(efetiva / 185 + t.penetracao / 270, 0, 0.52);
    }
  }

  const pa = partido(p.partidoId);
  return {
    id: 'JOGADOR',
    nome: `${p.nome} (você)`,
    partidoId: p.partidoId,
    jogador: true,
    real: false,
    ideologiaEixo: pa.eixo,
    ideologiaSocial: pa.eixoSocial ?? pa.eixo,
    forca,
    notoriedade: state.reputacao.notoriedade,
    rejeicao: state.reputacao.rejeicao,
    ecoMidiatico: state.reputacao.ecoMidiatico,
    caixaCampanha: state.financas.campanha,
    bairrosBase,
    grupoAlvo: null,
    satisfacaoGrupos: state.mundo?.satisfacaoGrupos || null, // Fase 8
    imagem: state.personagem.imagem || null, // Fase 14
    arquétipoNome: 'Sua candidatura',
  };
}

// Pontuação (em "logit") de um candidato para um grupo numa unidade territorial.
function propensao(cand, grupo, unidade, ruido) {
  const pa = partido(cand.partidoId);

  // 1) alinhamento ideológico
  const dEixo = Math.abs(cand.ideologiaEixo - (grupo.eixo + (unidade.eixo || 0) * 0.4)) / 100;
  const dSocial = Math.abs((cand.ideologiaSocial ?? cand.ideologiaEixo) - grupo.eixoSocial) / 100;
  const ideo = -(dEixo * 2.6 + dSocial * 1.4);

  // 2) presença territorial — forte retorno até ~0.5, saturando depois
  const w = cand.bairrosBase[unidade.id] || 0;
  const terr = w <= 0 ? 0 : Math.min(w, 0.5) * 2.15 + Math.max(0, w - 0.5) * 0.6;

  // 3) notoriedade — não se vota em quem não se conhece.
  // Etapa 13 — curva menos generosa: ser conhecido ajuda, não substitui base.
  const nf = cand.notoriedade / 100;
  const noto = (nf ** 1.5) * 1.85 - 0.35;

  // 4) rejeição, amplificada em grupos menos voláteis
  const rej = -(cand.rejeicao / 100) * (1.4 + (1 - grupo.volatilidade));

  // 5) força do partido no território
  const forcaPart = (pa.forcaRecife / 100) * 0.9;

  // 6) eco midiático recente
  const eco = clamp(cand.ecoMidiatico / 100, -0.6, 1.2) * 0.9;

  // 7) afinidade de arquétipo com o grupo
  const alvo = cand.grupoAlvo?.includes(grupo.id) ? 1.6 : 0;

  // 7b) bônus de mandato/reconhecimento
  const incumbente = /ELEITO/.test(cand.situacao2024 || '') ? 1.05 : 0;

  // 8) caixa de campanha (retornos decrescentes)
  const caixa = Math.log10(1 + Math.max(0, cand.caixaCampanha) / 20000) * 0.4;

  // 9) satisfação acumulada do grupo com o jogador (Fase 8) — só o jogador tem
  const sat = cand.satisfacaoGrupos
    ? clamp((cand.satisfacaoGrupos[grupo.id] || 0) / 100, -1, 1) * 1.15
    : 0;

  // 10) casamento da imagem pública com o que o grupo valoriza (Fase 14) — só jogador
  const img = cand.imagem ? bonusImagemGrupo(cand.imagem, grupo) : 0;

  return ideo + terr + noto + rej + forcaPart + eco + alvo + incumbente + caixa + sat + img + ruido;
}

// Estima votos de todos os candidatos. Determinístico via seed + electionId.
export function estimarVotos(candidatos, state, cargoId = 'VEREADOR') {
  const ctx = contextoEleicao(state, cargoId);
  const eleicaoId = state.eleicao?.id || `sim_${cargoId}`;
  const validosPorCand = Object.fromEntries(candidatos.map((c) => [c.id, 0]));
  const T = 2.2; // temperatura do softmax (maior = disputa menos concentrada — Etapa 13)

  for (const unidade of ctx.unidades) {
    const somaMix = Object.values(unidade.mix).reduce((s, w) => s + w, 0) || 1;

    const ruidoUnidade = candidatos.map((c) => {
      if (c.eliminado) return 0;
      const rr = createRng(hashSeed(`${state.meta.seed}|${eleicaoId}|${c.id}|${unidade.id}`));
      return rr.gauss(0, 0.5);
    });

    for (const [gid, peso] of Object.entries(unidade.mix)) {
      const grupo = GRUPOS[gid];
      if (!grupo) continue;
      const eleitores = unidade.populacao * (peso / somaMix)
        * 0.74 * grupo.comparecimento * ctx.comparecimentoBase;

      const scores = candidatos.map((c, i) => (
        c.eliminado ? -99 : propensao(c, grupo, unidade, ruidoUnidade[i])
      ));
      const max = Math.max(...scores);
      const exps = scores.map((sc) => Math.exp((sc - max) / T));
      const soma = exps.reduce((a, b) => a + b, 0) || 1;
      for (let i = 0; i < candidatos.length; i++) {
        validosPorCand[candidatos[i].id] += (exps[i] / soma) * eleitores;
      }
    }
  }

  const total = Object.values(validosPorCand).reduce((a, b) => a + b, 0);
  const escala = 0.86 * (ctx.escala || 1);
  const out = {};
  for (const c of candidatos) out[c.id] = Math.round(validosPorCand[c.id] * escala);
  return { votos: out, totalNominal: Math.round(total * escala) };
}

// Apuração PROPORCIONAL: quociente por COLIGAÇÃO + cadeiras (D'Hondt),
// distribuição interna coligação → partido → candidato.
export function apurar(candidatos, votosPorCand, coligacoes = null, cadeiras = 39) {
  const validos = Object.values(votosPorCand).reduce((a, b) => a + b, 0);
  const quociente = validos / cadeiras;

  const colDe = (pid) => (coligacoes?.deColigacao?.[pid]) || pid;

  const partidos = {};
  const cols = {};
  for (const c of candidatos) {
    (partidos[c.partidoId] ||= { id: c.partidoId, votos: 0, cands: [] });
    partidos[c.partidoId].votos += votosPorCand[c.id] || 0;
    partidos[c.partidoId].cands.push(c);
    const cid = colDe(c.partidoId);
    (cols[cid] ||= { id: cid, votos: 0, partidos: new Set() });
    cols[cid].votos += votosPorCand[c.id] || 0;
    cols[cid].partidos.add(c.partidoId);
  }
  const listaCol = Object.values(cols);

  const aptas = listaCol.filter((c) => c.votos >= quociente);
  const semCadeiraCol = listaCol.filter((c) => c.votos < quociente).map((c) => c.id);

  for (const c of aptas) c.cadeiras = Math.floor(c.votos / quociente);
  let usadas = aptas.reduce((s, c) => s + c.cadeiras, 0);
  while (usadas < cadeiras && aptas.length) {
    let melhor = null; let melhorMedia = -1;
    for (const c of aptas) {
      const media = c.votos / (c.cadeiras + 1);
      if (media > melhorMedia) { melhorMedia = media; melhor = c; }
    }
    melhor.cadeiras += 1;
    usadas += 1;
  }

  const eleitos = new Set();
  const cadeirasPorPartido = {};
  for (const col of aptas) {
    const membros = [...col.partidos].map((pid) => partidos[pid]).filter(Boolean);
    for (const p of membros) p._cad = 0;
    for (let k = 0; k < col.cadeiras; k++) {
      let melhor = null; let melhorMedia = -1;
      for (const p of membros) {
        const media = p.votos / (p._cad + 1);
        if (media > melhorMedia) { melhorMedia = media; melhor = p; }
      }
      if (melhor) melhor._cad += 1;
    }
    for (const p of membros) {
      cadeirasPorPartido[p.id] = p._cad;
      const ordenados = [...p.cands].sort((a, b) => (votosPorCand[b.id] || 0) - (votosPorCand[a.id] || 0));
      let n = 0;
      for (const c of ordenados) {
        if (n >= p._cad) break;
        if ((votosPorCand[c.id] || 0) >= quociente * 0.1) { eleitos.add(c.id); n++; }
      }
    }
  }
  const semCadeira = new Set([
    ...semCadeiraCol,
    ...Object.keys(partidos).filter((pid) => !cadeirasPorPartido[pid]),
  ]);
  if (eleitos.size < cadeiras) {
    const resto = candidatos
      .filter((c) => !eleitos.has(c.id))
      .sort((a, b) => (votosPorCand[b.id] || 0) - (votosPorCand[a.id] || 0));
    for (const c of resto) {
      if (eleitos.size >= cadeiras) break;
      eleitos.add(c.id);
    }
  }

  const ranking = [...candidatos]
    .map((c) => ({
      id: c.id, nome: c.nome, partidoId: c.partidoId, jogador: !!c.jogador,
      real: c.real, votos: votosPorCand[c.id] || 0, eleito: eleitos.has(c.id),
      arquétipoNome: c.arquétipoNome,
    }))
    .sort((a, b) => b.votos - a.votos);

  return {
    sistema: 'PROPORCIONAL',
    ranking,
    quociente: Math.round(quociente),
    validos,
    cadeiras,
    partidosSemCadeira: [...semCadeira],
    cadeirasPorPartido,
    coligacoesSemCadeira: semCadeiraCol,
  };
}

// Apuração MAJORITÁRIA: mais votado leva. Se ninguém passa de 50% dos válidos
// e a disputa tem 2º turno, devolve os dois primeiros em `segundoTurno`.
export function apurarMajoritario(candidatos, votosPorCand, { comSegundoTurno = true } = {}) {
  const validos = Object.values(votosPorCand).reduce((a, b) => a + b, 0) || 1;
  const ranking = [...candidatos]
    .map((c) => ({
      id: c.id, nome: c.nome, partidoId: c.partidoId, jogador: !!c.jogador,
      real: c.real, votos: votosPorCand[c.id] || 0,
      pct: +(((votosPorCand[c.id] || 0) / validos) * 100).toFixed(1),
      eleito: false, arquétipoNome: c.arquétipoNome,
    }))
    .sort((a, b) => b.votos - a.votos);

  const lider = ranking[0];
  const maioriaAbsoluta = lider && lider.votos / validos > 0.5;
  let segundoTurno = null;
  if (comSegundoTurno && !maioriaAbsoluta && ranking.length > 1) {
    segundoTurno = [ranking[0].id, ranking[1].id];
  } else if (lider) {
    lider.eleito = true;
  }

  return {
    sistema: 'MAJORITARIO',
    ranking,
    validos,
    cadeiras: 1,
    vencedor: segundoTurno ? null : lider?.id,
    pctVencedor: lider ? lider.pct : 0,
    segundoTurno,
  };
}

export function nomePartido(id) {
  return partido(id).nome;
}
export function corPartido(id) {
  return partido(id).cor;
}
