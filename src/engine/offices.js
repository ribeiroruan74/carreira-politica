// Fase 25/26 — resolução de cargos e circunscrições.
// Centraliza tudo que antes estava hardcoded em voteModel/candidates/election:
// qual cidade, quais unidades territoriais, quantas cadeiras, qual eleitorado.

import cargosDef from '../content/cargos.json';
import recife from '../content/neighborhoods/recife.json';
import olinda from '../content/neighborhoods/olinda.json';
import estadoPE from '../content/estado-pe.json';

const CIDADES = {
  RECIFE: recife,
  OLINDA: olinda,
};
export const CIDADE_PADRAO = 'RECIFE';

export function cidadesDisponiveis() {
  return Object.entries(CIDADES).map(([id, c]) => ({
    id,
    nome: c.cidade || id,
    bairros: c.bairros.length,
    populacao: c.bairros.reduce((s, b) => s + b.populacao, 0),
    uf: c.uf || 'PE',
  }));
}

export function cargoPorId(id) {
  return cargosDef.cargos.find((c) => c.id === id) || cargosDef.cargos[0];
}
export function todosOsCargos() {
  return cargosDef.cargos;
}

export function cidadeDef(cidadeId) {
  return CIDADES[cidadeId] || CIDADES[CIDADE_PADRAO];
}
export function bairrosDaCidade(cidadeId) {
  return cidadeDef(cidadeId).bairros;
}
export function nomeCidade(cidadeId) {
  return cidadeDef(cidadeId).cidade || cidadeId;
}

// Região do estado que contém a cidade (para mapear a base municipal do jogador
// numa disputa estadual).
export function regiaoDaCidade(cidadeId) {
  const nome = nomeCidade(cidadeId);
  const hit = estadoPE.regioes.find((r) => (r.cidades || []).includes(nome));
  if (hit) return hit.id;
  // capital e RMR caem na região metropolitana por padrão
  return estadoPE.regioes[0].id;
}

// Unidades territoriais de uma eleição: bairros (MUNICIPIO) ou regiões (ESTADO).
// Cada unidade tem { id, nome, populacao, mix, eixo }.
export function unidadesCircunscricao(state, cargoId) {
  const c = cargoPorId(cargoId);
  if (c.circunscricao === 'ESTADO') return estadoPE.regioes;
  return bairrosDaCidade(state.personagem.cidade);
}

export function cadeirasDoCargo(state, cargoId) {
  const c = cargoPorId(cargoId);
  if (c.cadeiras) return c.cadeiras;
  const cidade = state.personagem.cidade;
  return c.cadeirasPorCidade?.[cidade] ?? c.cadeirasPorCidade?.DEFAULT ?? 13;
}

export function eleitoradoApto(state, cargoId) {
  return unidadesCircunscricao(state, cargoId).reduce((s, u) => s + u.populacao, 0);
}

export function usaSegundoTurno(state, cargoId) {
  const c = cargoPorId(cargoId);
  if (c.sistema !== 'MAJORITARIO') return false;
  if (c.circunscricao === 'ESTADO') return true;
  const pop = bairrosDaCidade(state.personagem.cidade).reduce((s, b) => s + b.populacao, 0);
  return pop > (c.segundoTurnoSePopulacaoMaiorQue ?? 200000);
}
