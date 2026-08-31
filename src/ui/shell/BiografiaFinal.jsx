import { useGame } from '../../state/store';
import { nomeMes } from '../../engine/tick';

const TIPO_ROTULO = {
  ESCOLHA: 'Saída pela porta da frente',
  APOSENTADORIA: 'Aposentadoria',
  SAUDE: 'Afastamento por saúde',
  DERROTA: 'Fim de linha nas urnas',
  ESCANDALO: 'Queda em escândalo',
};

function Linha({ k, v }) {
  return (
    <div className="row" style={{ padding: '3px 0' }}>
      <span className="grow small dim">{k}</span>
      <span className="num small">{v}</span>
    </div>
  );
}

export default function BiografiaFinal() {
  const s = useGame((g) => g.estado);
  const apagar = useGame((g) => g.apagarPartida);
  const fim = s?.fimDeJogo;
  if (!fim) return null;
  const b = fim.biografia;
  const ano = s.tempo.anoInicial + Math.floor(fim.mes / 12);

  const notaTom = b.nota >= 70 ? 'var(--accent)' : b.nota >= 45 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>
        <p className="eyebrow">{TIPO_ROTULO[fim.tipo] || 'Fim da carreira'} · {nomeMes(fim.mes)}/{ano}</p>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: '1.7rem', margin: '2px 0 2px' }}>{b.titulo}</h2>
        <p className="small dim" style={{ marginBottom: 12 }}>
          {b.nome}, {b.idadeFinal} anos · {b.anosPublica} ano(s) de vida pública
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
          background: 'var(--surface-2)', borderRadius: 'var(--r-md)', marginBottom: 14,
        }}>
          <div style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--f-display)', color: notaTom, lineHeight: 1 }}>
            {b.nota}
          </div>
          <div className="small" style={{ lineHeight: 1.35 }}>
            <strong>O veredito da história</strong><br />
            <span className="dim">{b.veredito}</span>
          </div>
        </div>

        <p className="small dim" style={{ marginBottom: 14 }}>{fim.motivo}</p>

        <div className="grid cols-2" style={{ gap: 16 }}>
          <div>
            <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 4 }}>URNAS</div>
            <Linha k="Eleições vencidas" v={b.eleicoesVencidas} />
            <Linha k="Eleições perdidas" v={b.eleicoesPerdidas} />
            <Linha k="Melhor votação" v={b.melhorVotacao.toLocaleString('pt-BR')} />
            <Linha k="Cargos exercidos" v={b.cargos.length || '—'} />
            <Linha k="Meses em mandato" v={b.mesesEmMandato} />
          </div>
          <div>
            <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 4 }}>GESTÃO</div>
            <Linha k="Projetos aprovados" v={b.projetosAprovados} />
            <Linha k="Projetos rejeitados" v={b.projetosRejeitados} />
            <Linha k="Fiscalizações" v={b.fiscalizacoes} />
            <Linha k="Promessas cumpridas" v={b.taxaPromessas != null ? `${b.promessasCumpridas}/${b.promessasFeitas} (${b.taxaPromessas}%)` : '—'} />
          </div>
          <div>
            <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 4 }}>IMAGEM</div>
            <Linha k="Aprovação média" v={`${b.aprovMedia}%`} />
            <Linha k="Rejeição final" v={`${b.rejeicaoFinal}%`} />
            <Linha k="Notoriedade final" v={b.notoFinal} />
            <Linha k="Seguidores" v={b.seguidores.toLocaleString('pt-BR')} />
          </div>
          <div>
            <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 4 }}>CONQUISTAS</div>
            <Linha k="Desbloqueadas" v={`${b.conquistas.length}/${b.totalConquistas}`} />
            <div style={{ fontSize: '1.1rem', marginTop: 4, lineHeight: 1.6 }}>
              {b.conquistas.slice(0, 12).map((c, i) => <span key={i} title={c.nome}>{c.icone} </span>)}
            </div>
          </div>
        </div>

        {b.cargos.length > 0 && (
          <p className="small" style={{ marginTop: 14 }}>
            <strong>Trajetória:</strong> {b.cargos.join(' → ')}
          </p>
        )}
        {b.redutos.length > 0 && (
          <p className="small" style={{ marginTop: 6 }}>
            <strong>Redutos:</strong> {b.redutos.join(', ')}
          </p>
        )}
        {b.base.length > 0 && (
          <p className="small" style={{ marginTop: 6 }}>
            <strong>Base social:</strong> {b.base.map((x) => x.nome).join(', ')}
          </p>
        )}
        {b.inimigos.length > 0 && (
          <p className="small" style={{ marginTop: 6 }}>
            <strong>Desafetos:</strong> {b.inimigos.map((x) => x.nome).join(', ')}
          </p>
        )}

        {b.marcos.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 6 }}>MOMENTOS</div>
            {b.marcos.map((m, i) => (
              <p key={i} className="small" style={{ margin: '0 0 3px' }}>
                <span className="faint mono">{nomeMes(m.mes)}/{s.tempo.anoInicial + Math.floor(m.mes / 12)}</span> · {m.texto}
              </p>
            ))}
          </div>
        )}

        <button className="btn block" style={{ marginTop: 18 }} onClick={apagar}>
          Começar uma nova carreira
        </button>
      </div>
    </div>
  );
}
