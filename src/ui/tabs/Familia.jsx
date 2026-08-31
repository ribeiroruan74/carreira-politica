import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Meter, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { estadoFamilia, acaoFamilia } from '../../engine/family';

const CIVIL = { solteiro: 'Solteiro(a)', namorando: 'Namorando', casado: 'Casado(a)' };

export default function Familia() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [msg, setMsg] = useState(null);
  const f = estadoFamilia(s);
  const semTempo = (n) => s.tempo.pontosRestantes < n;

  function agir(nome) {
    try { let r; aplicar((st) => { r = acaoFamilia(st, nome); }); setMsg(r?.msg || 'ok'); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Vida pessoal" title="Família">
        Política consome. Uma vida fora dela sustenta seu bem-estar, sua energia e — de leve — a imagem de quem
        você é. Não precisa ser perfeita; precisa existir.
      </PageHead>

      <div className="grid cols-3">
        <Card><Meter label="Bem-estar" value={f.bemEstar} tone={f.bemEstar >= 60 ? 'ok' : f.bemEstar <= 30 ? 'bad' : 'warn'} /></Card>
        <Card><Meter label="Saúde" value={Math.round(f.saude)} tone={f.saude >= 60 ? 'ok' : f.saude <= 30 ? 'bad' : 'warn'} /></Card>
        <Card><Meter label="Relação com os pais" value={f.paisVivos ? Math.round(f.paisRelacao) : 0} tone="info" /></Card>
      </div>

      {msg && <Card><p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>{msg}</p></Card>}

      <Card title="Origem" aside={f.paisVivos ? '' : 'in memoriam'}>
        <p className="small dim">
          {f.paisVivos
            ? 'Seus pais ainda estão por aí. Visitar mantém o vínculo e ajuda a cabeça.'
            : 'Seus pais já se foram. O que fica são as lembranças.'}
        </p>
        {f.paisVivos && (
          <button className="btn sm ghost" disabled={semTempo(1)} onClick={() => agir('visitarPais')}>
            Visitar os pais · 1t
          </button>
        )}
      </Card>

      <Card title="Relacionamento" aside={<Pill tone={f.estadoCivil === 'casado' ? 'accent' : f.estadoCivil === 'namorando' ? 'blue' : undefined}>{CIVIL[f.estadoCivil]}</Pill>}>
        {f.conjuge && (
          <>
            <div className="row"><span className="grow name">{f.conjuge.nome}</span></div>
            <Meter label="Relação" value={Math.round(f.conjuge.relacao)} tone={f.conjuge.relacao >= 55 ? 'ok' : f.conjuge.relacao <= 30 ? 'bad' : 'warn'} />
            <p className="small faint" style={{ marginTop: 6 }}>Sem atenção, esfria. Abaixo de 30 o relacionamento entra em risco.</p>
          </>
        )}
        <div className="chips" style={{ marginTop: 10 }}>
          {f.estadoCivil === 'solteiro' && (
            <button className="btn sm" disabled={semTempo(2) || s.financas.pessoal < 150} onClick={() => agir('conhecerAlguem')}>
              Conhecer alguém · 2t · {formatBRL(150)}
            </button>
          )}
          {f.conjuge && (
            <button className="btn sm ghost" disabled={semTempo(1)} onClick={() => agir('tempoComParceiro')}>
              Tempo a dois · 1t
            </button>
          )}
          {f.estadoCivil === 'namorando' && (
            <button className="btn sm" disabled={semTempo(2) || f.conjuge.relacao < 58 || s.financas.pessoal < 4000}
              title={f.conjuge.relacao < 58 ? 'relação precisa estar madura' : ''}
              onClick={() => agir('casar')}>
              Casar · 2t · {formatBRL(4000)}
            </button>
          )}
        </div>
      </Card>

      <Card title="Filhos" aside={`${f.filhos}`}>
        {f.filhosDetalhe.length > 0 && (
          <p className="small dim">
            {f.filhosDetalhe.map((c) => `${c.nome}${c.via === 'adoção' ? ' (adotado)' : ''}`).join(', ')}
          </p>
        )}
        {f.filhos === 0 && <p className="small dim">Você ainda não tem filhos.</p>}
        <p className="small faint">Filho dá um salto no bem-estar e reforça a imagem de vida estável — mas cansa e come tempo.</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {f.estadoCivil === 'casado' && f.filhos < 4 && (
            <button className="btn sm ghost" disabled={semTempo(1)} onClick={() => agir('tentarFilho')}>Tentar ter um filho · 1t</button>
          )}
          {f.estadoCivil !== 'solteiro' && f.filhos < 4 && (
            <button className="btn sm ghost" disabled={semTempo(2) || s.financas.pessoal < 2000} onClick={() => agir('adotar')}>
              Adotar · 2t · {formatBRL(2000)}
            </button>
          )}
        </div>
      </Card>

      {(f.conjuge || f.filhos > 0 || f.paisVivos) && (
        <Card title="Tempo em família">
          <p className="small dim">Um fim de semana longe da política. Recupera bem-estar, saúde e energia.</p>
          <button className="btn sm" disabled={semTempo(2)} onClick={() => agir('tempoEmFamilia')}>
            Passar um tempo com a família · 2t
          </button>
        </Card>
      )}
    </div>
  );
}
