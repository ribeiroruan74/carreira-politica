import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead } from '../components/primitives';

export default function Config() {
  const s = useGame((g) => g.estado);
  const exportar = useGame((g) => g.exportar);
  const importar = useGame((g) => g.importar);
  const apagar = useGame((g) => g.apagarPartida);
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || 'system');
  const [confirmApagar, setConfirmApagar] = useState(false);

  function aplicarTema(t) {
    setTema(t);
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  function baixarSave() {
    const blob = new Blob([exportar()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carreira-politica-${s.personagem.nome.replace(/\s+/g, '-').toLowerCase()}-mes${s.tempo.mes}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function carregar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => importar(r.result);
    r.readAsText(file);
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Configurações" title="Save e preferências" />

      <Card title="Save">
        <p className="small dim">O jogo salva automaticamente no seu navegador (IndexedDB). Exporte um arquivo para backup ou para levar a outro dispositivo.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="btn" onClick={baixarSave}>Exportar save</button>
          <label className="btn ghost" style={{ margin: 0, cursor: 'pointer' }}>
            Importar save
            <input type="file" accept="application/json" onChange={carregar} style={{ display: 'none' }} />
          </label>
        </div>
        <p className="small faint mono" style={{ marginTop: 12 }}>
          semente {s.meta.seed} · versão do save {s.meta.version} · dificuldade {s.meta.dificuldade} · mês {s.tempo.mes}
        </p>
      </Card>

      <Card title="Dicas do tutorial">
        <p className="small dim">
          {s.flags.tutorialDesligado ? 'As dicas estão desligadas.' : `${(s.flags.dicasVistas || []).length} dica(s) já vista(s).`}
        </p>
        <button className="btn ghost sm" onClick={() => useGame.setState((st) => ({
          estado: { ...st.estado, flags: { ...st.estado.flags, tutorialDesligado: false, dicasVistas: [] } },
        }))}>Reativar e rever todas as dicas</button>
      </Card>

      <Card title="Tema">
        <div className="chips">
          {['system', 'light', 'dark'].map((t) => (
            <button key={t} className={`btn sm ${tema === t ? '' : 'ghost'}`} onClick={() => aplicarTema(t)}>
              {t === 'system' ? 'Sistema' : t === 'light' ? 'Claro' : 'Escuro'}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Zona de perigo">
        <p className="small dim">Apagar a partida atual é irreversível (a menos que você tenha exportado um save).</p>
        {!confirmApagar ? (
          <button className="btn ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setConfirmApagar(true)}>
            Apagar partida
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ background: 'var(--red)' }} onClick={apagar}>Confirmar exclusão</button>
            <button className="btn ghost" onClick={() => setConfirmApagar(false)}>Cancelar</button>
          </div>
        )}
      </Card>
    </div>
  );
}
