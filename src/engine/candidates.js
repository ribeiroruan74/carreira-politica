import { streamRng, clamp } from './rng';
import gen from '../content/candidate-gen.json';
import reais from '../content/candidates-recife.json';
import partiesDef from '../content/parties.json';
import { cargoPorId, unidadesCircunscricao } from './offices';

const PARTIDO_IDS = partiesDef.partidos.map((p) => p.id);

// normaliza siglas do TSE para os ids do parties.json
function normPartido(sigla) {
  const s = (sigla || '').toUpperCase().replace(/\s+/g, '');
  const mapa = { PCDOB: 'PCdoB', PATRIOTA: 'PL', UP: 'PSOL', PMB: 'AVANTE', DC: 'REPUBLICANOS', PRTB: 'PL', AGIR: 'AVANTE', PSTU: 'PSOL', PCO: 'PSOL', MOBILIZA: 'PODEMOS' };
  if (PARTIDO_IDS.includes(sigla)) return sigla;
  if (mapa[s]) return mapa[s];
  const hit = PARTIDO_IDS.find((id) => id.replace(/\s+/g, '').toUpperCase() === s);
  return hit || 'PSD';
}

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}

function arquétipoPorNome(nome, rng) {
  const n = nome.toUpperCase();
  if (/PASTOR|BISPO|IRMÃO|IRMÃ|MISSION|APÓSTOL|EVANGELIST/.test(n)) return byId('religioso');
  if (/CABO|SARGENTO|SGT|DELEGAD|CAPITÃO|CAP |TENENTE|SOLDADO|PM |GUARDA/.test(n)) return byId('seguranca');
  if (/PROFESSOR|PROFA|PROF /.test(n)) return rng.chance(0.5) ? byId('tecnico') : byId('movimento');
  if (/DR\.|DRA\.|DOUTOR|DOUTORA/.test(n)) return byId('tecnico');
  return rng.weighted(gen.arquétipos.filter((a) => a.id !== 'desconhecido'), (a) => (a.id === 'cabo_eleitoral' ? 2 : a.id === 'digital' ? 1.5 : 1));
}
function byId(id) { return gen.arquétipos.find((a) => a.id === id); }

// sorteia N unidades distintas com probabilidade proporcional à população
function sortearUnidadesPop(rng, n, pool) {
  const escolhidos = [];
  const rest = [...pool];
  while (escolhidos.length < n && rest.length) {
    const b = rng.weighted(rest, (x) => x.populacao);
    escolhidos.push(b);
    rest.splice(rest.indexOf(b), 1);
  }
  return escolhidos;
}

function montarBairrosBase(arq, rng, unidades) {
  const base = {};
  const alvo = (n) => sortearUnidadesPop(rng, Math.min(n, unidades.length), unidades);
  if (arq.estilo === 'TERRITORIO') {
    alvo(rng.int(2, 4)).forEach((b, i) => { base[b.id] = i === 0 ? rng.range([0.45, 0.7]) : rng.range([0.18, 0.42]); });
  } else if (arq.estilo === 'GRUPO') {
    const doGrupo = unidades.filter((b) => (arq.grupoAlvo || []).some((g) => (b.mix[g] || 0) >= 3));
    sortearUnidadesPop(rng, Math.min(rng.int(3, 6), unidades.length), doGrupo.length ? doGrupo : unidades)
      .forEach((b) => { base[b.id] = rng.range([0.22, 0.5]); });
  } else if (arq.estilo === 'REDES') {
    rng.shuffle(unidades).slice(0, Math.min(rng.int(8, 14), unidades.length)).forEach((b) => { base[b.id] = rng.range([0.1, 0.3]); });
  } else { // MIDIA
    unidades.filter((b) => (b.renda ?? 3) >= 3 || b.eixo <= 0).forEach((b) => { base[b.id] = rng.range([0.12, 0.28]); });
  }
  return base;
}

function forcaPorSituacao(sit, forcaBase, rng) {
  const s = (sit || '').toUpperCase();
  if (s.includes('ELEITO')) return clamp(rng.int(66, 90) * 0.5 + forcaBase * 0.5, 40, 97);
  if (s.includes('SUPLENTE')) return clamp(rng.int(34, 58) * 0.6 + forcaBase * 0.4, 20, 68);
  return clamp(rng.int(16, 42) * 0.6 + forcaBase * 0.4, 8, 55);
}

function novoCandidato({
  id, nome, partidoId, real, situacao, forca, arq, rng, unidades, caixaUnidade, majoritario,
}) {
  const pa = partido(partidoId);
  const eixo = clamp(pa.eixo + rng.int(-18, 18), -100, 100);
  const eixoSocial = clamp((pa.eixoSocial ?? pa.eixo) + rng.int(-18, 18), -100, 100);
  const caixa = Math.round(
    (forca / 100) * rng.range([caixaUnidade * 4, caixaUnidade * 12]) * (pa.tamanho / 60),
  );
  const notoBase = majoritario
    ? clamp(forca * 0.7 + rng.int(8, 30), 5, 96)
    : clamp(forca * 0.5 + (arq.estilo === 'REDES' ? rng.int(15, 40) : rng.int(2, 18)), 1, 98);
  return {
    id,
    nome,
    partidoId,
    real: !!real,
    situacao2024: real ? situacao : null,
    arquétipoId: arq.id,
    arquétipoNome: arq.nome,
    estilo: arq.estilo,
    grupoAlvo: arq.grupoAlvo || null,
    ideologiaEixo: eixo,
    ideologiaSocial: eixoSocial,
    forca,
    caixaCampanha: caixa,
    caixaInicial: caixa,
    notoriedade: notoBase,
    rejeicao: rng.rangeInt(arq.rejeicaoBase),
    ecoMidiatico: 0,
    bairrosBase: montarBairrosBase(arq, rng, unidades),
    votosEstimados: 0,
    historicoVotos: [],
    eliminado: false,
  };
}

// Gera a chapa inteira para uma eleição. Determinístico via seed + mês.
export function gerarChapa(state, cargoId = 'VEREADOR') {
  const cargo = cargoPorId(cargoId);
  const rng = streamRng(state.meta.seed, 'chapa', cargoId, state.tempo.mes);
  const unidades = unidadesCircunscricao(state, cargoId);
  const majoritario = cargo.sistema === 'MAJORITARIO';
  const total = rng.rangeInt([cargo.totalCandidatos.min, cargo.totalCandidatos.max]);
  const competitivos = rng.rangeInt([cargo.competitivos.min, cargo.competitivos.max]);
  // unidade de dinheiro: proporcional ao tamanho da circunscrição
  const caixaUnidade = cargo.circunscricao === 'ESTADO' ? 9000 : (majoritario ? 14000 : 4500);

  const chapa = [];
  const partidosUsados = {};
  const usaReais = cargo.usaCandidatosReais && state.personagem.cidade === 'RECIFE';

  if (usaReais) {
    for (const r of reais.candidatos) {
      const pid = normPartido(r.partido);
      const arq = arquétipoPorNome(r.nome, rng);
      const forca = forcaPorSituacao(r.situacao, r.forcaBase ?? 40, rng);
      chapa.push(novoCandidato({
        id: `real_${r.id}`, nome: tituloNome(r.nome), partidoId: pid, real: true,
        situacao: r.situacao, forca, arq, rng, unidades, caixaUnidade, majoritario,
      }));
      partidosUsados[pid] = (partidosUsados[pid] || 0) + 1;
    }
  }

  if (majoritario) {
    // um forte por partido, priorizando os partidos maiores/mais alinhados à cidade.
    // o partido do jogador não lança concorrente contra ele.
    partidosUsados[state.personagem.partidoId] = 1;
    const ordem = [...PARTIDO_IDS].sort((a, b) => partido(b).tamanho - partido(a).tamanho);
    for (const pid of ordem) {
      if (chapa.length >= total) break;
      if (partidosUsados[pid]) continue;
      const arq = rng.weighted(
        gen.arquétipos.filter((a) => !['desconhecido', 'celebridade'].includes(a.id)),
        (a) => (a.id === 'cabo_eleitoral' || a.id === 'tecnico' ? 2 : 1),
      );
      const forca = clamp(rng.rangeInt(arq.forca) + partido(pid).tamanho * 0.4, 30, 95);
      chapa.push(novoCandidato({
        id: `gen_${cargoId}_${chapa.length}_${rng.int(1000, 9999)}`,
        nome: gerarNome(arq, rng), partidoId: pid, real: false, forca, arq, rng,
        unidades, caixaUnidade, majoritario,
      }));
      partidosUsados[pid] = 1;
    }
    return chapa;
  }

  // proporcional: completa com competitivos + nanicos (como na urna real)
  const capPartido = Math.max(6, Math.ceil(total / 10));
  while (chapa.length < total) {
    const faltamCompetitivos = chapa.length < competitivos;
    const arq = rng.weighted(gen.arquétipos, (a) => {
      if (a.id === 'desconhecido') return faltamCompetitivos ? 0.15 : 6;
      if (a.id === 'celebridade') return faltamCompetitivos ? 0.4 : 0.05;
      return faltamCompetitivos ? 1.2 : 0.25;
    });
    const pid = rng.pick(PARTIDO_IDS);
    const forca = rng.rangeInt(arq.forca);
    const respeitaCap = (partidosUsados[pid] || 0) < capPartido;
    const alvoPid = respeitaCap ? pid : PARTIDO_IDS.find((x) => (partidosUsados[x] || 0) < capPartido) || pid;
    chapa.push(novoCandidato({
      id: `gen_${cargoId}_${chapa.length}_${rng.int(1000, 9999)}`,
      nome: gerarNome(arq, rng), partidoId: alvoPid, real: false, forca, arq, rng,
      unidades, caixaUnidade, majoritario,
    }));
    partidosUsados[alvoPid] = (partidosUsados[alvoPid] || 0) + 1;
  }

  return chapa;
}

function tituloNome(s) {
  return s.toLowerCase().replace(/(^|\s|-)([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());
}

function gerarNome(arq, rng) {
  let pref = '';
  if (arq.id === 'religioso') pref = rng.pick(['Pastor', 'Pastora', 'Bispo', 'Irmão', 'Irmã']);
  else if (arq.id === 'seguranca') pref = rng.pick(['Cabo', 'Sargento', 'Delegado', 'Capitão', 'Tenente']);
  else if (arq.id === 'tecnico') pref = rng.pick(['Dr.', 'Dra.', 'Professor', 'Professora', '']);
  else pref = rng.chance(0.55) ? '' : rng.pick(gen.prefixos);
  const primeiro = rng.pick(gen.primeiros);
  const cauda = rng.chance(0.5) ? rng.pick(gen.apelidos) : rng.pick(gen.sobrenomes);
  return [pref, primeiro, cauda].filter(Boolean).join(' ');
}
