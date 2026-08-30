import { useState } from 'react';
import { useGame } from '../../state/store';
import { abasVisiveis } from './tabsConfig';
import TopBar from './TopBar';
import TabBar from './TabBar';
import CriarPersonagem from '../tabs/CriarPersonagem';
import ModalHost from './ModalHost';
import DicaTutorial from '../components/DicaTutorial';

export default function AppShell() {
  const estado = useGame((g) => g.estado);
  const hidratado = useGame((g) => g._hidratado);
  const [aba, setAba] = useState('dashboard');

  if (!hidratado) return <div className="app-main dim">Carregando save…</div>;
  if (!estado) return <CriarPersonagem />;

  const abas = abasVisiveis(estado);
  const Ativa = (abas.find((t) => t.id === aba) || abas[0]).comp;

  return (
    <div className="app">
      <TopBar />
      <TabBar abas={abas} ativa={aba} onTrocar={setAba} />
      <main className="app-main">
        <DicaTutorial aba={aba} />
        <Ativa irPara={setAba} />
      </main>
      <ModalHost irPara={setAba} />
    </div>
  );
}
