// "Acontecendo agora" — agrega, só para leitura, o que já existe no estado.
// Nenhuma mecânica nova: apenas junta notícias, convites, crises, riscos,
// objetivo de fase e janela de candidatura num feed de cards tocáveis.

import { nomeMes } from '../../engine/tick';
import { convitesMidiaAtivos } from '../../engine/press';
import { cascatasAtivas } from '../../engine/cascade';
import { riscosAbertos } from '../../engine/worldMemory';
import { janelaCandidatura } from '../../engine/calendar';
import { objetivoDaFase } from '../../engine/career';
import { eventoNacionalAtual } from '../../engine/national';

export function acontecendoAgora(s) {
  const itens = [];
  const ano = (m) => s.tempo.anoInicial + Math.floor(m / 12);

  // crise / decisão pendente
  if (s.eventoPendente) {
    itens.push({
      id: 'crise', tipo: 'decisão', urgente: true, ico: '⚠️',
      titulo: s.eventoPendente.titulo || 'Uma decisão te espera',
      texto: s.eventoPendente.desc || s.eventoPendente.texto || 'Resolva antes de avançar o mês.',
      aba: null,
    });
  }

  // objetivo de fase disponível (oportunidade)
  const obj = objetivoDaFase(s);
  if (obj?.disponivel) {
    itens.push({
      id: 'objetivo', tipo: 'oportunidade', urgente: obj.id === 'lancar_candidatura', ico: '🎯',
      titulo: obj.titulo, texto: obj.desc, aba: 'agenda',
    });
  }

  // janela de candidatura aberta
  const jan = (s.personagem.fase === 'PARTIDO' || s.personagem.fase === 'MANDATO') ? janelaCandidatura(s) : null;
  if (jan?.aberta && !obj?.disponivel) {
    itens.push({
      id: 'janela', tipo: 'oportunidade', urgente: true, ico: '🗳️',
      titulo: `Janela de candidatura aberta (${jan.ano})`,
      texto: 'Dá para lançar candidatura agora, na Agenda.', aba: 'agenda',
    });
  }

  // convites de mídia
  for (const c of convitesMidiaAtivos(s).slice(0, 3)) {
    itens.push({
      id: `conv_${c.id}`, tipo: 'convite', urgente: false, ico: c.tipo === 'podcast' ? '🎙️' : '📺',
      titulo: c.tipo === 'podcast' ? `Podcast ${c.veiculoNome || ''}` : `Entrevista — ${c.veiculoNome || c.jornalista || 'imprensa'}`,
      texto: 'Aceite na Imprensa antes de expirar.', aba: 'imprensa',
    });
  }

  // repercussão em curso (cascatas)
  for (const c of cascatasAtivas(s)) {
    itens.push({
      id: `casc_${c.id}`, tipo: 'problema', urgente: true, ico: '🔥',
      titulo: c.rótulo || 'Repercussão em curso',
      texto: `Estágio ${c.estagio + 1}/${c.total} — avança sozinha todo mês.`, aba: 'inteligencia',
    });
  }

  // riscos antigos que podem voltar
  for (const r of riscosAbertos(s).slice(0, 2)) {
    itens.push({
      id: `risco_${r.id}`, tipo: 'problema', urgente: false, ico: '👁️',
      titulo: 'Assunto que pode voltar', texto: r.texto, aba: 'inteligencia',
    });
  }

  // notícias recentes (contexto)
  for (const n of (s.mundo.noticias || []).slice(0, 4)) {
    itens.push({
      id: `not_${n.id}`, tipo: 'notícia', urgente: false,
      ico: n.tipo === 'ATAQUE' ? '💥' : n.tipo === 'ALIANCA' ? '🤝' : n.tipo === 'MIDIA' ? '📰' : '📰',
      titulo: n.texto, texto: `${nomeMes(n.mes)}/${ano(n.mes)}`, aba: 'inteligencia',
    });
  }

  // cenário nacional
  const evNac = eventoNacionalAtual(s);
  if (evNac) {
    itens.push({ id: 'nacional', tipo: 'notícia', urgente: false, ico: '🇧🇷', titulo: evNac.texto, texto: 'Cenário nacional', aba: 'inteligencia' });
  }

  return itens;
}
