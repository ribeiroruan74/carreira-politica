import { nomeMes } from './tick';

// ============================================================
// FASE 9 — Jornal periódico "RECIFE AGORA"
// Uma edição montada a partir de mundo.noticias das últimas ~8 semanas,
// organizada em editorias, com uma manchete de capa.
// ============================================================

const EDITORIAS = [
  { id: 'capa', nome: 'CAPA' },
  { id: 'politica', nome: 'Política', tipos: ['POLITICA', 'ALIANCA', 'PARTIDO', 'MUNDO'] },
  { id: 'pais', nome: 'Brasil', tipos: ['NACIONAL'] },
  { id: 'bastidores', nome: 'Bastidores', tipos: ['BASTIDORES'] },
  { id: 'camara', nome: 'Câmara', tipos: ['MANDATO', 'GABINETE'] },
  { id: 'cidade', nome: 'Cidade', tipos: ['CIDADE'] },
  { id: 'redes', nome: 'Redes & Mídia', tipos: ['MIDIA', 'REDES', 'CASCATA'] },
  { id: 'embate', nome: 'O Embate', tipos: ['ATAQUE'] },
];

const PESO_TIPO = {
  ATAQUE: 3, MARCO: 4, CIDADE: 2.5, MIDIA: 2, POLITICA: 2, CASCATA: 2.5,
  ALIANCA: 1.5, PARTIDO: 2, MANDATO: 1.6, GABINETE: 1, MUNDO: 1.4, REDES: 1.8,
};

export function montarEdicao(state) {
  const mesAtual = state.tempo.mes;
  const recentes = (state.mundo.noticias || []).filter((n) => mesAtual - n.mes <= 2);
  if (recentes.length === 0) return null;

  const ano = state.tempo.anoInicial + Math.floor(mesAtual / 12);
  const edicaoNum = mesAtual + 1;

  // capa: a notícia mais "pesada" (destaque + tipo)
  const capa = [...recentes].sort((a, b) => {
    const pa = (a.destaque ? 4 : 0) + (PESO_TIPO[a.tipo] || 1) + (mesAtual - a.mes) * -0.3;
    const pb = (b.destaque ? 4 : 0) + (PESO_TIPO[b.tipo] || 1) + (mesAtual - b.mes) * -0.3;
    return pb - pa;
  })[0];

  const secoes = EDITORIAS.filter((e) => e.tipos).map((e) => ({
    nome: e.nome,
    itens: recentes
      .filter((n) => e.tipos.includes(n.tipo) && n.id !== capa.id)
      .sort((a, b) => b.mes - a.mes)
      .slice(0, 4)
      .map((n) => n.texto),
  })).filter((s) => s.itens.length);

  return {
    nome: 'RECIFE AGORA',
    edicaoNum,
    data: `${nomeMes(mesAtual)}/${ano}`,
    capa: capa.texto,
    capaTipo: capa.tipo,
    secoes,
    total: recentes.length,
  };
}
