// Abas ativas. Uma aba só aparece quando tem funcionalidade real E `visivel`
// (se definido) retorna true para o estado atual.

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
import Conquistas from '../tabs/Conquistas';
import Historico from '../tabs/Historico';
import Config from '../tabs/Config';

export const TABS = [
  { id: 'dashboard', nome: 'Dashboard', ico: '▤', comp: Dashboard },
  { id: 'personagem', nome: 'Personagem', ico: '☺', comp: Personagem },
  { id: 'familia', nome: 'Família', ico: '👪', comp: Familia },
  { id: 'agenda', nome: 'Agenda', ico: '❒', comp: Agenda },
  { id: 'eleicao', nome: 'Eleição', ico: '🗳', comp: Eleicao, visivel: (s) => !!s.eleicao },
  { id: 'mandato', nome: 'Mandato', ico: '🏛', comp: Mandato, visivel: (s) => !!s.mandato },
  { id: 'gabinete', nome: 'Gabinete', ico: '👔', comp: Gabinete, visivel: (s) => !!s.mandato },
  { id: 'pessoas', nome: 'Pessoas', ico: '⚇', comp: Pessoas },
  { id: 'mapa', nome: 'Mapa', ico: '◈', comp: Mapa },
  { id: 'politica', nome: 'Política', ico: '⚖', comp: Politica, visivel: (s) => !!s.personagem.partidoId || s.personagem.fase !== 'VIDA' },
  { id: 'redes', nome: 'Instagram', ico: '📷', comp: Instagram },
  { id: 'imprensa', nome: 'Imprensa', ico: '📰', comp: Imprensa, visivel: (s) => s.reputacao.notoriedade >= 10 || s.personagem.fase !== 'VIDA' },
  { id: 'inteligencia', nome: 'Inteligência', ico: '🧠', comp: Inteligencia, visivel: (s) => s.reputacao.notoriedade >= 8 || s.personagem.fase !== 'VIDA' },
  { id: 'pesquisas', nome: 'Pesquisas', ico: '📊', comp: Pesquisas },
  { id: 'financas', nome: 'Finanças', ico: '$', comp: Financas },
  { id: 'conquistas', nome: 'Conquistas', ico: '🏆', comp: Conquistas },
  { id: 'historico', nome: 'Histórico', ico: '≡', comp: Historico },
  { id: 'config', nome: 'Configurações', ico: '⚙', comp: Config },
];

export function abasVisiveis(state) {
  return TABS.filter((t) => !t.visivel || t.visivel(state));
}
