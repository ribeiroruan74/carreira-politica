import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { abasVisiveis, abasDaSecao, secaoDaAba, secaoInfo, SECOES } from './tabsConfig';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import SectionHub from './SectionHub';
import CriarPersonagem from '../tabs/CriarPersonagem';
import ModalHost from './ModalHost';
import DicaTutorial from '../components/DicaTutorial';
import { acontecendoAgora } from './feed';

export default function AppShell() {
  const estado = useGame((g) => g.estado);
  const hidratado = useGame((g) => g._hidratado);
  const [secao, setSecao] = useState('inicio');
  const [aba, setAba] = useState(null); // sub-página aberta dentro da seção (null = hub)

  const feed = useMemo(() => (estado ? acontecendoAgora(estado) : []), [estado]);

  if (!hidratado) return <div className="carregando">Carregando…</div>;
  if (!estado) return <CriarPersonagem />;

  const abas = abasVisiveis(estado);
  const daSecao = abasDaSecao(estado, secao);
  const info = secaoInfo(secao);

  // Início → dashboard direto. Seção com 1 sub-página → ela direto. Senão → hub/sub-página.
  let conteudoAba = aba && daSecao.some((t) => t.id === aba) ? aba : null;
  const mostraHub = secao !== 'inicio' && daSecao.length > 1 && !conteudoAba;
  if (secao === 'inicio') conteudoAba = 'dashboard';
  else if (daSecao.length === 1) conteudoAba = daSecao[0].id;

  const abaMeta = abas.find((t) => t.id === conteudoAba);
  const Ativa = abaMeta?.comp;

  function irParaAba(abaId) {
    const sec = secaoDaAba(abaId);
    setSecao(sec);
    setAba(abaId);
  }
  function trocarSecao(secId) {
    setSecao(secId);
    setAba(null); // volta pro hub da seção
  }

  const alertas = { inicio: feed.filter((f) => f.urgente).length };

  const ATALHOS = {
    inteligencia: { id: 'pesquisas', rotulo: 'Pesquisas' },
    perfil: { id: 'conquistas', rotulo: 'Conquistas', tone: 'gold' },
    politica: { id: 'pessoas', rotulo: 'Cenário' },
  };
  const atalho = ATALHOS[secao] && daSecao.some((t) => t.id === ATALHOS[secao].id) ? ATALHOS[secao] : null;

  return (
    <div className="app">
      <TopBar />
      <main className="app-main">
        {mostraHub ? (
          <div key={`hub-${secao}`} className="page-fade">
            <SectionHub titulo={info?.titulo || ''} abas={daSecao} onAbrir={setAba} atalho={atalho} />
          </div>
        ) : (
          <div key={conteudoAba} className="page-fade">
            {conteudoAba !== 'dashboard' && daSecao.length > 1 && (
              <button className="backbar" onClick={() => setAba(null)}>
                <span aria-hidden="true">‹</span> {info?.titulo || 'voltar'}
              </button>
            )}
            <DicaTutorial aba={conteudoAba} />
            {Ativa && <Ativa irPara={irParaAba} feed={feed} />}
          </div>
        )}
      </main>
      <BottomNav secao={secao} onTrocar={trocarSecao} alertas={alertas} />
      <ModalHost irPara={irParaAba} />
    </div>
  );
}

export { SECOES };
