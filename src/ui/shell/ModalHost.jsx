import { useGame } from '../../state/store';
import TickEventos from './TickEventos';
import CriseModal from './CriseModal';
import EntrevistaModal from './EntrevistaModal';
import ResultadoEleicao from '../tabs/ResultadoEleicao';

// P2 — um único ponto que decide QUAL modal aparece, por prioridade.
// 1. apuração de eleição (terminal para a campanha)
// 2. entrevista em andamento (iniciada pelo jogador)
// 3. crise pendente (trava o avanço do mês)
// 4. resumo do mês (informativo)
export default function ModalHost({ irPara }) {
  const apurando = useGame((g) => g.estado?.eleicao?.status === 'APURADO');
  const naEntrevista = useGame((g) => !!g.estado?.entrevistaAtiva);
  const temCrise = useGame((g) => !!g.estado?.eventoPendente);
  const temResumo = useGame((g) => (g.ultimoTick || []).some((e) => e.tipo !== 'INFO' && e.tipo !== 'MES'));

  if (apurando) return <ResultadoEleicao irPara={irPara} />;
  if (naEntrevista) return <EntrevistaModal />;
  if (temCrise) return <CriseModal />;
  if (temResumo) return <TickEventos />;
  return null;
}
