import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead, Pill, Meter, Stat } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import {
  TIPOS_EMPRESA, TIPOS_INSTITUICAO, TIPOS_BEM, empresaDef, instituicaoDef, bemDef, resumoPatrimonio,
  criarEmpresa, investirEmpresa, venderEmpresa, fundarInstituicao, ampliarInstituicao, fecharInstituicao,
  comprarBem, venderBem,
  PERFIS_INVESTIMENTO, aportarInvestimento, resgatarInvestimento, definirPerfilInvestimento,
} from '../../engine/assets';

export default function Negocios() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [erro, setErro] = useState(null);
  const [novoTipo, setNovoTipo] = useState(TIPOS_EMPRESA[0].id);
  const [instTipo, setInstTipo] = useState(TIPOS_INSTITUICAO[0].id);
  const [instNome, setInstNome] = useState('');
  const [bemTipo, setBemTipo] = useState(TIPOS_BEM[0].id);

  const p = s.personagem;
  const emp = p.empresas || [];
  const inst = p.instituicoes || [];
  const inv = p.investimentos || { valor: 0, perfil: 'conservador' };
  const r = resumoPatrimonio(s);
  const disp = s.financas.pessoal + p.patrimonio;
  const [aporte, setAporte] = useState(1000);

  function agir(fn) {
    try { aplicar(fn); setErro(null); } catch (e) { setErro(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Negócios" title="Patrimônio e legado">
        Empresas dão renda passiva mas oscilam e podem quebrar — e setor sensível vira conflito de interesse no mandato.
        Instituições não dão voto: dão impacto social, reputação e legado, e custam manutenção todo mês.
      </PageHead>

      <div className="grid cols-3">
        <Card><Stat k="Patrimônio" v={formatBRL(p.patrimonio)} /></Card>
        <Card><Stat k="Renda passiva est." v={`${formatBRL(r.rendaPassivaEst)}/mês`} /></Card>
        <Card><Stat k="Manutenção de instituições" v={`${formatBRL(r.manutencaoInst)}/mês`} sub={`impacto social ${r.impactoSocial}`} /></Card>
      </div>

      {erro && <Card><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erro}</p></Card>}

      <Card title="🏡 Bens pessoais" aside={r.nBens ? `${r.nBens} bem(ns) · ${formatBRL(r.valorBens)}` : null}>
        <p className="small dim" style={{ marginBottom: 8 }}>
          Imóveis valorizam devagar; veículos depreciam. Todos custam manutenção todo mês e entram no patrimônio declarado.
        </p>
        {(p.bens || []).map((b) => {
          const d = bemDef(b.tipo);
          return (
            <div key={b.id} className="row" style={{ alignItems: 'baseline' }}>
              <span className="grow"><span className="name">{b.nome}</span> <span className="small faint">· {d?.tipo} · manut. {formatBRL(d?.manutencaoMes || 0)}/mês</span></span>
              <span className="num small">{formatBRL(b.valor)}</span>
              <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => agir((st) => venderBem(st, b.id))}>Vender</button>
            </div>
          );
        })}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <select value={bemTipo} onChange={(e) => setBemTipo(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            {TIPOS_BEM.map((t) => <option key={t.id} value={t.id}>{t.nome} — {formatBRL(t.preco)}</option>)}
          </select>
          <button className="btn sm" disabled={s.financas.pessoal < (bemDef(bemTipo)?.preco || 0)}
            onClick={() => agir((st) => comprarBem(st, bemTipo))}>Comprar</button>
        </div>
      </Card>

      <Card title="📈 Investimentos financeiros" aside={`saldo ${formatBRL(inv.valor)}`}>
        <p className="small dim" style={{ marginBottom: 8 }}>
          Dinheiro parado rendendo sozinho — sem precisar administrar. Perfil mais arriscado rende mais, mas também pode perder em mês ruim.
        </p>
        <div className="chips" style={{ marginBottom: 10 }}>
          {PERFIS_INVESTIMENTO.map((pf) => (
            <button key={pf.id} className={`btn sm ${inv.perfil === pf.id ? '' : 'ghost'}`}
              onClick={() => agir((st) => definirPerfilInvestimento(st, pf.id))}>
              {pf.nome} <span className="faint">~{(pf.retorno * 100).toFixed(1)}%/mês</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input type="number" min="0" step="500" value={aporte} onChange={(e) => setAporte(Number(e.target.value))} style={{ width: 120 }} />
          <button className="btn sm" disabled={s.financas.pessoal < aporte || aporte <= 0} onClick={() => agir((st) => aportarInvestimento(st, aporte))}>Aportar</button>
          <button className="btn sm ghost" disabled={inv.valor < aporte || aporte <= 0} onClick={() => agir((st) => resgatarInvestimento(st, aporte))}>Resgatar</button>
        </div>
      </Card>

      <Card title="🏢 Empresas">
        {emp.length === 0 && <p className="small dim">Você não tem empresas.</p>}
        {emp.map((e) => {
          const d = empresaDef(e.tipo);
          return (
            <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row">
                <span className="grow name">{e.nome} {d?.conflito && <Pill tone={s.mandato ? 'red' : 'amber'}>setor sensível</Pill>}</span>
                <span className="num">{formatBRL(e.valor)}</span>
              </div>
              <div style={{ maxWidth: 200, margin: '4px 0' }}><Meter label={`Saúde ${Math.round(e.saude)}`} value={e.saude} tone={e.saude >= 50 ? 'ok' : e.saude >= 25 ? 'warn' : 'bad'} /></div>
              <div className="chips">
                <button className="btn sm ghost" onClick={() => agir((st) => investirEmpresa(st, e.id, Math.round(empresaDef(e.tipo).custo * 0.2)))}>
                  Investir {formatBRL(Math.round((d?.custo || 100000) * 0.2))}
                </button>
                <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => agir((st) => venderEmpresa(st, e.id))}>Vender</button>
              </div>
            </div>
          );
        })}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <select value={novoTipo} onChange={(ev) => setNovoTipo(ev.target.value)}>
            {TIPOS_EMPRESA.map((t) => <option key={t.id} value={t.id}>{t.nome} — {formatBRL(t.custo)}{t.conflito ? ' (sensível)' : ''}</option>)}
          </select>
          <button className="btn sm" disabled={disp < empresaDef(novoTipo).custo} onClick={() => agir((st) => criarEmpresa(st, novoTipo, { comprar: true }))}>Comprar</button>
          <button className="btn sm ghost" disabled={disp < empresaDef(novoTipo).custo * 0.45} onClick={() => agir((st) => criarEmpresa(st, novoTipo, { comprar: false }))}>Abrir (45%)</button>
        </div>
      </Card>

      <Card title="🏫 Projetos de legado">
        {inst.length === 0 && <p className="small dim">Você ainda não fundou nenhuma instituição.</p>}
        {inst.map((i) => (
          <div key={i.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <span className="grow name">{i.nome} <Pill>nível {i.nivel}</Pill></span>
              <span className="num small">{formatBRL((instituicaoDef(i.tipo)?.manutencao || 0) * i.nivel)}/mês</span>
            </div>
            <div style={{ maxWidth: 200, margin: '4px 0' }}><Meter label={`Saúde ${Math.round(i.saude)} · reconhec. ${Math.round(i.reconhecimento)}`} value={i.saude} tone={i.saude >= 50 ? 'ok' : 'warn'} /></div>
            <div className="chips">
              <button className="btn sm ghost" onClick={() => agir((st) => ampliarInstituicao(st, i.id))}>Ampliar</button>
              <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => agir((st) => fecharInstituicao(st, i.id))}>Encerrar</button>
            </div>
          </div>
        ))}
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <select value={instTipo} onChange={(e) => setInstTipo(e.target.value)}>
            {TIPOS_INSTITUICAO.map((t) => <option key={t.id} value={t.id}>{t.nome} — funda {formatBRL(t.custo)} · {formatBRL(t.manutencao)}/mês</option>)}
          </select>
          <input type="text" value={instNome} placeholder={`Nome (padrão: ${instituicaoDef(instTipo).nome} ${p.nome})`} onChange={(e) => setInstNome(e.target.value)} />
          <button className="btn sm" disabled={disp < instituicaoDef(instTipo).custo}
            onClick={() => { agir((st) => fundarInstituicao(st, instTipo, instNome)); setInstNome(''); }}>
            Fundar {formatBRL(instituicaoDef(instTipo).custo)}
          </button>
        </div>
      </Card>
    </div>
  );
}
