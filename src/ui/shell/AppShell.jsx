import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { abasVisiveis, abasDaSecao, secaoDaAba, SECOES } from './tabsConfig';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import SubNav from './SubNav';
import CriarPersonagem from '../tabs/CriarPersonagem';
import ModalHost from './ModalHost';
import DicaTutorial from '../components/DicaTutorial';
import { acontecendoAgora } from './feed';

export default function AppShell() {
  const estado = useGame((g) => g.estado);
  const hidratado = useGame((g) => g._hidratado);
  const [secao, setSecao] = useState('inicio');
  // aba escolhida por seção (lembra a última visitada em cada uma)
  const [abaPorSecao, setAbaPorSecao] = useState({});

  const abas = estado ? abasVisiveis(estado) : [];
  const daSecao = estado ? abasDaSecao(estado, secao) : [];
  const abaAtual = abaPorSecao[secao] && daSecao.some((t) => t.id === abaPorSecao[secao])
    ? abaPorSecao[secao]
    : daSecao[0]?.id;

  const feed = useMemo(() => (estado ? acontecendoAgora(estado) : []), [estado]);

  if (!hidratado) return <div className="carregando">Carregando…</div>;
  if (!estado) return <CriarPersonagem />;

  const Ativa = (abas.find((t) => t.id === abaAtual) || abas[0]).comp;

  function irParaAba(abaId) {
    const sec = secaoDaAba(abaId);
    setSecao(sec);
    setAbaPorSecao((m) => ({ ...m, [sec]: abaId }));
  }
  function trocarSecao(secId) {
    setSecao(secId);
  }

  const alertas = { inicio: feed.filter((f) => f.urgente).length };

  return (
    <div className="app">
      <TopBar feed={feed} irPara={irParaAba} />
      <main className="app-main">
        <DicaTutorial aba={abaAtual} />
        <SubNav abas={daSecao} ativa={abaAtual} onTrocar={(id) => setAbaPorSecao((m) => ({ ...m, [secao]: id }))} />
        <div key={abaAtual} className="page-fade">
          <Ativa irPara={irParaAba} feed={feed} />
        </div>
      </main>
      <BottomNav secao={secao} onTrocar={trocarSecao} alertas={alertas} />
      <ModalHost irPara={irParaAba} />
    </div>
  );
}

// (mantém SECOES exportado disponível para outros módulos que já importam daqui)
export { SECOES };
