// Navegação em 2 níveis:
//  - barra inferior fixa só de ícones (SECOES) — uma seção some se não tiver nenhuma sub-aba visível
//  - dentro da seção, um hub de cards (as sub-abas). Seção com 1 sub-aba abre direto.
// Uma sub-aba só aparece quando `visivel` (se definido) retorna true.

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
import Estilo from '../tabs/Estilo';
import Negocios from '../tabs/Negocios';
import Conquistas from '../tabs/Conquistas';
import Historico from '../tabs/Historico';
import Telefone from '../tabs/Telefone';
import Config from '../tabs/Config';

const temMandato = (s) => !!s.mandato;
const naoVida = (s) => s.personagem.fase !== 'VIDA';
const comFama = (s) => s.reputacao.notoriedade >= 8 || naoVida(s);

// `titulo` = título da sub-tela / rótulo no hub; `resumo` = subtítulo do card
export const TABS = [
  { id: 'dashboard', titulo: 'Início', ico: '🏠', comp: Dashboard, secao: 'inicio' },

  { id: 'agenda', titulo: 'Agenda do mês', resumo: 'Suas ações e compromissos', ico: '📅', comp: Agenda, secao: 'agenda' },
  { id: 'eleicao', titulo: 'Campanha', resumo: 'Pesquisas, adversários e o relógio', ico: '🗳️', comp: Eleicao, secao: 'agenda', visivel: (s) => !!s.eleicao },

  { id: 'personagem', titulo: 'Perfil', resumo: 'Atributos, personalidade, trajetória', ico: '🧬', comp: Personagem, secao: 'personagem' },
  { id: 'familia', titulo: 'Família & relações', resumo: 'Cônjuge, filhos, pais, bem-estar', ico: '👪', comp: Familia, secao: 'personagem' },
  { id: 'estilo', titulo: 'Estilo de vida', resumo: 'Serviços mensais e energia', ico: '🛎️', comp: Estilo, secao: 'personagem' },
  { id: 'conquistas', titulo: 'Conquistas', resumo: 'Marcos da carreira', ico: '🏆', comp: Conquistas, secao: 'personagem' },
  { id: 'historico', titulo: 'Carreira & histórico', resumo: 'Linha do tempo e log', ico: '📜', comp: Historico, secao: 'personagem' },
  { id: 'config', titulo: 'Ajustes', resumo: 'Tema, salvar/carregar, dicas', ico: '⚙️', comp: Config, secao: 'personagem' },

  { id: 'pessoas', titulo: 'Políticos & rede', resumo: 'Cenário político — converse, negocie, alie-se', ico: '👥', comp: Pessoas, secao: 'politica' },
  { id: 'politica', titulo: 'Partido & alianças', resumo: 'Legenda, diretório, coligações, seu grupo', ico: '⚖️', comp: Politica, secao: 'politica', visivel: (s) => !!s.personagem.partidoId || naoVida(s) },

  { id: 'mandato', titulo: 'Câmara & projetos', resumo: 'Projetos, comissões, CPI, base × oposição', ico: '🏛️', comp: Mandato, secao: 'mandato', visivel: temMandato },
  { id: 'gabinete', titulo: 'Gabinete', resumo: 'Chefe, assessores, delegações, prioridade', ico: '👔', comp: Gabinete, secao: 'mandato', visivel: temMandato },

  { id: 'inteligencia', titulo: 'Central de inteligência', resumo: 'Pesquisar bairro/grupo/rival, "o que propor?"', ico: '🧠', comp: Inteligencia, secao: 'inteligencia', visivel: comFama },
  { id: 'pesquisas', titulo: 'Pesquisas & opinião', resumo: 'Aprovação, fama, intenção de voto, grupos', ico: '📊', comp: Pesquisas, secao: 'inteligencia' },

  { id: 'redes', titulo: 'Redes sociais', resumo: 'Publicar, lives, caixa de perguntas', ico: '📷', comp: Instagram, secao: 'midia' },
  { id: 'imprensa', titulo: 'Imprensa', resumo: 'Veículos, cobertura, entrevistas, jornal', ico: '📰', comp: Imprensa, secao: 'midia', visivel: (s) => s.reputacao.notoriedade >= 10 || naoVida(s) },
  { id: 'telefone', titulo: 'Contatos', resumo: 'Ligar para mídia, famosos, influenciadores e políticos', ico: '📞', comp: Telefone, secao: 'midia', visivel: comFama },

  { id: 'financas', titulo: 'Finanças', resumo: 'Caixa, campanha, gastos, financiadores', ico: '💰', comp: Financas, secao: 'financas' },
  { id: 'negocios', titulo: 'Patrimônio & negócios', resumo: 'Empresas, imóveis, carros, investimentos', ico: '🏢', comp: Negocios, secao: 'financas', visivel: (s) => naoVida(s) || s.personagem.patrimonio > 50000 },

  { id: 'mapa', titulo: 'Recife', resumo: 'Mapa, bairros, problemas e militância', ico: '🗺️', comp: Mapa, secao: 'mundo' },
];

// barra inferior fixa — só ícones. `atalho` = sub-aba de destaque no hub.
export const SECOES = [
  { id: 'inicio', ico: '🏠', titulo: 'Início' },
  { id: 'agenda', ico: '📅', titulo: 'Agenda' },
  { id: 'personagem', ico: '👤', titulo: 'Personagem', atalho: { id: 'conquistas', rotulo: 'Conquistas', tone: 'gold' } },
  { id: 'politica', ico: '🏛️', titulo: 'Política', atalho: { id: 'pessoas', rotulo: 'Cenário' } },
  { id: 'mandato', ico: '📜', titulo: 'Mandato' },
  { id: 'inteligencia', ico: '📊', titulo: 'Inteligência', atalho: { id: 'pesquisas', rotulo: 'Pesquisas' } },
  { id: 'midia', ico: '📱', titulo: 'Mídia', atalho: { id: 'redes', rotulo: 'Redes' } },
  { id: 'financas', ico: '💰', titulo: 'Finanças' },
  { id: 'mundo', ico: '🌎', titulo: 'Mundo' },
];
export const secaoInfo = (id) => SECOES.find((x) => x.id === id);

export function abasVisiveis(state) {
  return TABS.filter((t) => !t.visivel || t.visivel(state));
}

// sub-páginas visíveis de uma seção
export function abasDaSecao(state, secaoId) {
  return abasVisiveis(state).filter((t) => t.secao === secaoId);
}

// seções que têm ao menos uma sub-aba visível agora
export function secoesVisiveis(state) {
  return SECOES.filter((sec) => abasDaSecao(state, sec.id).length > 0);
}

export function secaoDaAba(abaId) {
  return TABS.find((t) => t.id === abaId)?.secao || 'inicio';
}
