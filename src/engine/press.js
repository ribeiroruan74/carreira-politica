import { createRng, clamp } from './rng';
import pressDef from '../content/press.json';
import partiesDef from '../content/parties.json';

export const VEICULOS = pressDef.veiculos;
export const JORNALISTAS = pressDef.jornalistas;

export function veiculo(id) {
  return VEICULOS.find((v) => v.id === id);
}

// tom da cobertura de um veículo sobre o jogador: -100 (hostil) a +100 (favorável)
export function tomCobertura(state) {
  const p = partiesDef.partidos.find((x) => x.id === state.personagem.partidoId);
  const eixoJogador = p?.eixo ?? 0;
  return VEICULOS.map((v) => {
    const distIdeo = Math.abs(v.linha - eixoJogador) / 2; // 0..100
    const tom = clamp(
      40 - distIdeo * 0.9
      + (state.reputacao.aprovacao - 50) * 0.5
      - state.reputacao.rejeicao * 0.4
      + state.reputacao.ecoMidiatico * 0.3,
      -100, 100,
    );
    return { ...v, tom: Math.round(tom) };
  });
}

export function concederEntrevista(state, jornalistaId) {
  const j = JORNALISTAS.find((x) => x.id === jornalistaId);
  if (!j) throw new Error('Jornalista não encontrado.');
  if (state.tempo.pontosRestantes < 2) throw new Error('Sem tempo (custa 2).');

  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= 2;
  state.tempo.energia = clamp(state.tempo.energia - 10, 0, state.tempo.energiaMax);

  const a = state.personagem.atributos;
  const preparo = (a.comunicacao + a.inteligencia + a.oratoria) / 3;
  const improviso = a.improviso;
  const v = veiculo(j.veiculo);
  // quanto mais rigoroso o jornalista, mais o preparo importa
  const desempenho = rng.gauss(
    (preparo - 50) / 100 * (j.rigor / 60) + (improviso - 50) / 200 + 0.05,
    0.25,
  );

  const alcance = (v?.alcance ?? 50) / 100;
  const resumo = [];
  let manchete;

  if (desempenho > 0.35) {
    const noto = rng.range([3, 8]) * (0.6 + alcance);
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + noto, 0, 100);
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([1, 4]), 0, 100);
    state.reputacao.confianca = clamp(state.reputacao.confianca + rng.range([1, 4]), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 8]) * alcance, -50, 100);
    manchete = `Entrevista de ${state.personagem.nome} n${v?.tipo === 'tv' ? 'a' : 'o'} ${v?.nome} repercute bem`;
    resumo.push(`notoriedade +${noto.toFixed(1)}`, 'aprovação e confiança sobem');
  } else if (desempenho < -0.15) {
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([2, 7]) * (0.6 + alcance), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([2, 6]) * alcance, -50, 100);
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 3]), 0, 100);
    manchete = `${j.nome} pressiona e ${state.personagem.nome} tropeça em entrevista`;
    resumo.push('rejeição sobe', 'um corte ruim circula');
  } else {
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 4]), 0, 100);
    manchete = `${state.personagem.nome} concede entrevista ${v?.nome ? `à ${v.nome}` : ''}`;
    resumo.push('exposição sem grandes efeitos');
  }

  state.mundo.noticias.unshift({
    id: `nt_ent_${state.tempo.mes}_${jornalistaId}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [],
    texto: manchete + '.',
  });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'ACAO', texto: `Entrevista com ${j.nome} (${v?.nome}) — ${resumo.join(', ')}.` });
  state.meta.rngState = rng.state;
  return { manchete, resumo };
}
