// Navegação em 2 níveis (rebuild visual):
//  - 5 seções na barra inferior fixa (SECOES)
//  - dentro de cada seção, sub-páginas (as abas de sempre) num seletor no topo da página
// Uma aba só aparece quando `visivel` (se definido) retorna true.

import Dashboard from './Dashboard';
import Personagem from '../tabs/Personagem';
import Familia from '../tabs/Familia';
import Agenda from '../tabs/Agenda';
import Pessoas from '../tabs/Pessoas';
import Mapa from '../tabs/Mapa';
import Politica from '../tabs/Politica';
import Eleicao from '../tabs/Eleicao';
import Gabinete from '../tabs/Gabinete';
import Mandato from '../tabs/Mandato';
import Instagram from '../tabs/Instagram';
import Imprensa from '../tabs/Imprensa';
import Inteligencia from '../tabs/Inteligencia';
import Pesquisas from '../tabs/Pesquisas';
import Financas from '../tabs/Financas';
import Negocios from '../tabs/Negocios';
import Conquistas from '../tabs/Conquistas';
import Historico from '../tabs/Historico';
import Telefone from '../tabs/Telefone';
import Config from '../tabs/Config';

// `titulo` = rótulo curto usado no seletor de sub-páginas (SubNav)
export const TABS = [
  { id: 'dashboard', nome: 'Início', titulo: 'Início', ico: '🏠', comp: Dashboard, secao: 'inicio' },

  { id: 'agenda', nome: 'Agenda', titulo: 'Agenda', ico: '📅', comp: Agenda, secao: 'agenda' },
  { id: 'eleicao', nome: 'Eleição', titulo: 'Eleição', ico: '🗳', comp: Eleicao, secao: 'agenda', visivel: (s) => !!s.eleicao },

  { id: 'mapa', nome: 'Recife', titulo: 'Recife', ico: '🗺️', comp: Mapa, secao: 'politica' },
  { id: 'mandato', nome: 'Câmara', titulo: 'Câmara', ico: '🏛️', comp: Mandato, secao: 'politica', visivel: (s) => !!s.mandato },
  { id: 'politica', nome: 'Partido', titulo: 'Partido', ico: '⚖️', comp: Politica, secao: 'politica', visivel: (s) => !!s.personagem.partidoId || s.personagem.fase !== 'VIDA' },
  { id: 'pessoas', nome: 'Políticos', titulo: 'Políticos', ico: '👥', comp: Pessoas, secao: 'politica' },
  { id: 'gabinete', nome: 'Gabinete', titulo: 'Gabinete', ico: '👔', comp: Gabinete, secao: 'politica', visivel: (s) => !!s.mandato },

  { id: 'inteligencia', nome: 'Central', titulo: 'Central', ico: '🧠', comp: Inteligencia, secao: 'inteligencia', visivel: (s) => s.reputacao.notoriedade >= 8 || s.personagem.fase !== 'VIDA' },
  { id: 'pesquisas', nome: 'Pesquisas', titulo: 'Pesquisas', ico: '📊', comp: Pesquisas, secao: 'inteligencia' },
  { id: 'imprensa', nome: 'Imprensa', titulo: 'Imprensa', ico: '📰', comp: Imprensa, secao: 'inteligencia', visivel: (s) => s.reputacao.notoriedade >= 10 || s.personagem.fase !== 'VIDA' },

  { id: 'personagem', nome: 'Perfil', titulo: 'Personagem', ico: '👤', comp: Personagem, secao: 'perfil' },
  { id: 'familia', nome: 'Família', titulo: 'Família', ico: '👪', comp: Familia, secao: 'perfil' },
  { id: 'redes', nome: 'Redes', titulo: 'Redes', ico: '📷', comp: Instagram, secao: 'perfil' },
  { id: 'telefone', nome: 'Contatos', titulo: 'Contatos', ico: '📞', comp: Telefone, secao: 'perfil', visivel: (s) => s.reputacao.notoriedade >= 8 || s.personagem.fase !== 'VIDA' },
  { id: 'financas', nome: 'Finanças', titulo: 'Finanças', ico: '💰', comp: Financas, secao: 'perfil' },
  { id: 'negocios', nome: 'Negócios', titulo: 'Negócios', ico: '🏢', comp: Negocios, secao: 'perfil', visivel: (s) => s.personagem.fase !== 'VIDA' || s.personagem.patrimonio > 50000 },
  { id: 'conquistas', nome: 'Conquistas', titulo: 'Conquistas', ico: '🏆', comp: Conquistas, secao: 'perfil' },
  { id: 'historico', nome: 'Carreira', titulo: 'Carreira', ico: '📜', comp: Historico, secao: 'perfil' },
  { id: 'config', nome: 'Ajustes', titulo: 'Ajustes', ico: '⚙️', comp: Config, secao: 'perfil' },
];

// barra inferior fixa
export const SECOES = [
  { id: 'inicio', nome: 'Início', ico: '🏠' },
  { id: 'agenda', nome: 'Agenda', ico: '📅' },
  { id: 'politica', nome: 'Política', ico: '🏛️' },
  { id: 'inteligencia', nome: 'Dados', ico: '📊' },
  { id: 'perfil', nome: 'Perfil', ico: '👤' },
];

export function abasVisiveis(state) {
  return TABS.filter((t) => !t.visivel || t.visivel(state));
}

// sub-páginas visíveis de uma seção
export function abasDaSecao(state, secaoId) {
  return abasVisiveis(state).filter((t) => t.secao === secaoId);
}

export function secaoDaAba(abaId) {
  return TABS.find((t) => t.id === abaId)?.secao || 'inicio';
}
