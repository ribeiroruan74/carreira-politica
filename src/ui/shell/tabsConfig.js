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

// `titulo` = rótulo no hub da seção; `resumo` = subtítulo do card
export const TABS = [
  { id: 'dashboard', nome: 'Início', titulo: 'Início', ico: '🏠', comp: Dashboard, secao: 'inicio' },

  { id: 'agenda', nome: 'Agenda', titulo: 'Agenda do mês', resumo: 'Escolha onde investir seu tempo e energia', ico: '📅', comp: Agenda, secao: 'agenda' },
  { id: 'eleicao', nome: 'Eleição', titulo: 'Campanha', resumo: 'Pesquisas, adversários e o relógio da eleição', ico: '🗳️', comp: Eleicao, secao: 'agenda', visivel: (s) => !!s.eleicao },

  { id: 'mapa', nome: 'Recife', titulo: 'Recife', resumo: 'Mapa territorial, bairros e militância', ico: '🗺️', comp: Mapa, secao: 'politica' },
  { id: 'mandato', nome: 'Câmara', titulo: 'Câmara & Projetos', resumo: 'Projetos de lei, comissões, base × oposição', ico: '🏛️', comp: Mandato, secao: 'politica', visivel: (s) => !!s.mandato },
  { id: 'politica', nome: 'Partido', titulo: 'Partido & Alianças', resumo: 'Legenda, diretório, coligações e seu grupo', ico: '⚖️', comp: Politica, secao: 'politica', visivel: (s) => !!s.personagem.partidoId || s.personagem.fase !== 'VIDA' },
  { id: 'pessoas', nome: 'Políticos', titulo: 'Políticos', resumo: 'Cenário político — converse, negocie, alie-se', ico: '👥', comp: Pessoas, secao: 'politica' },
  { id: 'gabinete', nome: 'Gabinete', titulo: 'Gabinete', resumo: 'Chefe, assessores, delegações e prioridade', ico: '👔', comp: Gabinete, secao: 'politica', visivel: (s) => !!s.mandato },

  { id: 'inteligencia', nome: 'Central', titulo: 'Central de Inteligência', resumo: 'Pesquisar bairro/grupo/rival, temas, "o que propor?"', ico: '🧠', comp: Inteligencia, secao: 'inteligencia', visivel: (s) => s.reputacao.notoriedade >= 8 || s.personagem.fase !== 'VIDA' },
  { id: 'pesquisas', nome: 'Pesquisas', titulo: 'Pesquisas & Opinião', resumo: 'Aprovação, notoriedade, intenção de voto, grupos', ico: '📊', comp: Pesquisas, secao: 'inteligencia' },
  { id: 'imprensa', nome: 'Imprensa', titulo: 'Imprensa', resumo: 'Veículos, cobertura, entrevistas e o jornal', ico: '📰', comp: Imprensa, secao: 'inteligencia', visivel: (s) => s.reputacao.notoriedade >= 10 || s.personagem.fase !== 'VIDA' },

  { id: 'personagem', nome: 'Perfil', titulo: 'Personagem', resumo: 'Atributos, trajetória e imagem pública', ico: '👤', comp: Personagem, secao: 'perfil' },
  { id: 'familia', nome: 'Família', titulo: 'Família', resumo: 'Cônjuge, filhos, pais e bem-estar', ico: '👪', comp: Familia, secao: 'perfil' },
  { id: 'redes', nome: 'Redes', titulo: 'Redes sociais', resumo: 'Publicar, lives, caixa de perguntas, imagem', ico: '📷', comp: Instagram, secao: 'perfil' },
  { id: 'telefone', nome: 'Contatos', titulo: 'Telefone', resumo: 'Ligar para mídia, famosos e políticos', ico: '📞', comp: Telefone, secao: 'perfil', visivel: (s) => s.reputacao.notoriedade >= 8 || s.personagem.fase !== 'VIDA' },
  { id: 'financas', nome: 'Finanças', titulo: 'Finanças', resumo: 'Caixa, renda, gastos e financiadores', ico: '💰', comp: Financas, secao: 'perfil' },
  { id: 'negocios', nome: 'Negócios', titulo: 'Patrimônio & Negócios', resumo: 'Empresas, instituições e investimentos', ico: '🏢', comp: Negocios, secao: 'perfil', visivel: (s) => s.personagem.fase !== 'VIDA' || s.personagem.patrimonio > 50000 },
  { id: 'conquistas', nome: 'Conquistas', titulo: 'Conquistas', resumo: 'Marcos desbloqueados da sua carreira', ico: '🏆', comp: Conquistas, secao: 'perfil' },
  { id: 'historico', nome: 'Carreira', titulo: 'Carreira & Histórico', resumo: 'Linha do tempo, mandatos e log', ico: '📜', comp: Historico, secao: 'perfil' },
  { id: 'config', nome: 'Ajustes', titulo: 'Ajustes', resumo: 'Tema, salvar/carregar, dicas', ico: '⚙️', comp: Config, secao: 'perfil' },
];

// barra inferior fixa
export const SECOES = [
  { id: 'inicio', nome: 'Início', ico: '🏠', hub: false },
  { id: 'agenda', nome: 'Agenda', ico: '📅', hub: false, titulo: 'Agenda' },
  { id: 'politica', nome: 'Política', ico: '🏛️', hub: true, titulo: 'Política' },
  { id: 'inteligencia', nome: 'Dados', ico: '📊', hub: true, titulo: 'Inteligência' },
  { id: 'perfil', nome: 'Perfil', ico: '👤', hub: true, titulo: 'Perfil' },
];
export const secaoInfo = (id) => SECOES.find((x) => x.id === id);

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
