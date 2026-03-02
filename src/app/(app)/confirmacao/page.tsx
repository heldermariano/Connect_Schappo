'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAgenda } from '@/hooks/useAgenda';
import { AgendamentoPaciente } from '@/lib/types';
import CalendarioMedico from '@/components/agenda/CalendarioMedico';

const MENSAGEM_PADRAO = `Clinica Schappo - Confirmacao de Agendamento

Ola, {nome_paciente}!

Gostavamos de confirmar seu agendamento:
- Data: {data}
- Horario: {hora}
- Medico(a): {nome_medico}
- Procedimento: {procedimento}

Por favor, responda:
1 - Confirmo meu agendamento
2 - Preciso remarcar

Em caso de duvidas, entre em contato.
Clinica Schappo - (61) 3345-5701`;

function getAmanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '--';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

function StatusBadge({ status, indStatus }: { status: string | null; indStatus: string | null }) {
  // Status do ERP (ind_status)
  if (indStatus === 'C') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Confirmado (ERP)</span>;
  }
  if (indStatus === 'F') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Faltou</span>;
  }
  if (indStatus === 'M') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Marcado</span>;
  }

  // Status de confirmacao local (WhatsApp)
  if (!status) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Pendente</span>;
  }
  if (status === 'enviado') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Enviado</span>;
  }
  if (status === 'confirmado') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Confirmado</span>;
  }
  if (status === 'desmarcou') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Desmarcou</span>;
  }
  if (status === 'sem_resposta') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Sem resposta</span>;
  }
  if (status === 'reagendar') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Quer reagendar</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
}

export default function ConfirmacaoPage() {
  const {
    medicos,
    agendamentos,
    medicoInfo,
    loading,
    loadingMedicos,
    error,
    fetchMedicos,
    fetchAgendamentos,
    enviarConfirmacao,
    atualizarStatus,
  } = useAgenda();

  const [medicoId, setMedicoId] = useState<number | null>(null);
  const [data, setData] = useState(getAmanha());
  const [buscaMedico, setBuscaMedico] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number; sem_telefone: number } | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

  // Templates
  interface TemplateConfirmacao { id: number; nome: string; conteudo: string; padrao: boolean; atendente_id: number | null }
  const [templates, setTemplates] = useState<TemplateConfirmacao[]>([]);
  const [templateSelecionado, setTemplateSelecionado] = useState<number | null>(null);
  const [showSalvarTemplate, setShowSalvarTemplate] = useState(false);
  const [nomeNovoTemplate, setNomeNovoTemplate] = useState('');
  const [salvandoTemplate, setSalvandoTemplate] = useState(false);
  const [showCalendario, setShowCalendario] = useState(false);

  // Carregar medicos ao montar
  useEffect(() => {
    fetchMedicos();
  }, [fetchMedicos]);

  // Auto-refresh: recarregar agendamentos a cada 15s para detectar respostas
  useEffect(() => {
    if (!medicoId || !data) return;
    const interval = setInterval(() => {
      fetchAgendamentos(medicoId, data);
    }, 15000);
    return () => clearInterval(interval);
  }, [medicoId, data, fetchAgendamentos]);

  // Buscar agendamentos quando medico ou data mudam
  const handleBuscar = useCallback(() => {
    if (medicoId && data) {
      fetchAgendamentos(medicoId, data);
      setSelecionados(new Set());
      setResultado(null);
    }
  }, [medicoId, data, fetchAgendamentos]);

  // Filtrar medicos pelo texto de busca
  const medicosFiltrados = useMemo(() => {
    if (!buscaMedico.trim()) return medicos;
    const termo = buscaMedico.toLowerCase();
    return medicos.filter(m =>
      (m.nom_guerra || '').toLowerCase().includes(termo) ||
      m.nom_medico.toLowerCase().includes(termo) ||
      (m.num_crm || '').includes(termo)
    );
  }, [medicos, buscaMedico]);

  // Medico selecionado
  const medicoSelecionado = useMemo(() =>
    medicos.find(m => m.id_medico === medicoId),
    [medicos, medicoId]
  );

  // Resumo
  const resumo = useMemo(() => {
    const total = agendamentos.length;
    const confirmados = agendamentos.filter(a => a.confirmacao?.status === 'confirmado' || a.ind_status === 'C').length;
    const enviados = agendamentos.filter(a => a.confirmacao?.status === 'enviado').length;
    const pendentes = agendamentos.filter(a => !a.confirmacao && a.ind_status !== 'C').length;
    const desmarcou = agendamentos.filter(a => a.confirmacao?.status === 'desmarcou').length;
    const reagendar = agendamentos.filter(a => a.confirmacao?.status === 'reagendar').length;
    const semTel = agendamentos.filter(a => !a.telefone_whatsapp).length;
    return { total, confirmados, enviados, pendentes, desmarcou, reagendar, semTel };
  }, [agendamentos]);

  // Toggle selecao
  const toggleSelecao = (chave: number) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  // Selecionar todos pendentes com telefone
  const selecionarPendentes = () => {
    const pendentes = agendamentos.filter(a =>
      a.telefone_whatsapp &&
      !a.confirmacao &&
      a.ind_status !== 'C'
    );
    setSelecionados(new Set(pendentes.map(a => a.chave)));
  };

  // Enviar confirmacao
  const handleEnviar = async () => {
    if (!medicoId || !data || selecionados.size === 0) return;
    setEnviando(true);
    setResultado(null);
    try {
      const result = await enviarConfirmacao(Array.from(selecionados), mensagem, medicoId, data);
      setResultado({ enviados: result.enviados, falhas: result.falhas, sem_telefone: result.sem_telefone });
      setShowModal(false);
      setSelecionados(new Set());
      // Recarregar agendamentos para atualizar status
      fetchAgendamentos(medicoId, data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setEnviando(false);
    }
  };

  // Atualizar status individual
  const handleStatus = async (chave: number, status: string) => {
    setStatusUpdating(chave);
    try {
      await atualizarStatus(chave, status);
      if (medicoId && data) {
        fetchAgendamentos(medicoId, data);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setStatusUpdating(null);
    }
  };

  // Usar template do medico se disponivel
  useEffect(() => {
    if (medicoInfo?.template_whatsapp) {
      setMensagem(medicoInfo.template_whatsapp);
    } else {
      setMensagem(MENSAGEM_PADRAO);
    }
  }, [medicoInfo]);

  // Carregar templates quando modal abre
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/agenda/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch { /* silenciar */ }
  }, []);

  useEffect(() => {
    if (showModal) {
      fetchTemplates();
    }
  }, [showModal, fetchTemplates]);

  const handleSelectTemplate = (id: number) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setMensagem(tpl.conteudo);
      setTemplateSelecionado(id);
    }
  };

  const handleSalvarTemplate = async () => {
    if (!nomeNovoTemplate.trim() || !mensagem.trim()) return;
    setSalvandoTemplate(true);
    try {
      const res = await fetch('/api/agenda/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovoTemplate, conteudo: mensagem }),
      });
      if (res.ok) {
        setShowSalvarTemplate(false);
        setNomeNovoTemplate('');
        fetchTemplates();
      }
    } catch { /* silenciar */ }
    finally { setSalvandoTemplate(false); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Excluir este template?')) return;
    try {
      await fetch(`/api/agenda/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
      if (templateSelecionado === id) setTemplateSelecionado(null);
    } catch { /* silenciar */ }
  };

  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Confirmacao de Agendamento</h1>
        <p className="text-sm text-gray-500 mt-1">Confirme agendamentos via WhatsApp</p>
      </div>

      {/* Filtros */}
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 items-end">
        {/* Seletor de medico com busca */}
        <div className="relative flex-1 min-w-[250px] max-w-[400px]">
          <label className="block text-xs text-gray-500 mb-1">Medico</label>
          <input
            type="text"
            placeholder={loadingMedicos ? 'Carregando...' : 'Buscar medico...'}
            value={medicoSelecionado && !showDropdown ? (medicoSelecionado.nom_guerra || medicoSelecionado.nom_medico) : buscaMedico}
            onChange={(e) => {
              setBuscaMedico(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) setMedicoId(null);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-schappo-500"
          />
          {showDropdown && medicosFiltrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {medicosFiltrados.map(m => (
                <button
                  key={m.id_medico}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex justify-between"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMedicoId(m.id_medico);
                    setBuscaMedico('');
                    setShowDropdown(false);
                  }}
                >
                  <span>{m.nom_guerra || m.nom_medico}</span>
                  {m.num_crm && <span className="text-gray-500 text-xs">CRM {m.num_crm}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Data — botao com popover de calendario */}
        <div className="relative">
          <label className="block text-xs text-gray-500 mb-1">Data</label>
          <button
            onClick={() => setShowCalendario(!showCalendario)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 hover:border-schappo-500 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(data)}</span>
          </button>
          {showCalendario && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCalendario(false)} />
              <div className="absolute z-50 mt-1 right-0">
                <CalendarioMedico
                  medicoId={medicoId}
                  dataSelecionada={data}
                  onSelectDate={(d) => { setData(d); setShowCalendario(false); }}
                />
              </div>
            </>
          )}
        </div>

        {/* Buscar */}
        <button
          onClick={handleBuscar}
          disabled={!medicoId || !data || loading}
          className="px-4 py-2 bg-schappo-500 text-white rounded-lg text-sm font-medium hover:bg-schappo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Resultado do disparo */}
      {resultado && (
        <div className="mx-6 mt-3 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex gap-4">
          <span>{resultado.enviados} enviado(s)</span>
          {resultado.falhas > 0 && <span className="text-red-700">{resultado.falhas} falha(s)</span>}
          {resultado.sem_telefone > 0 && <span className="text-yellow-700">{resultado.sem_telefone} sem telefone</span>}
        </div>
      )}

      {/* Resumo */}
      {agendamentos.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">{resumo.total} agendado(s)</span>
          <span className="text-green-600">{resumo.confirmados} confirmado(s)</span>
          <span className="text-yellow-600">{resumo.enviados} enviado(s)</span>
          <span className="text-gray-500">{resumo.pendentes} pendente(s)</span>
          {resumo.desmarcou > 0 && <span className="text-red-600">{resumo.desmarcou} desmarcou</span>}
          {resumo.reagendar > 0 && <span className="text-purple-600">{resumo.reagendar} reagendar</span>}
          {resumo.semTel > 0 && <span className="text-orange-600">{resumo.semTel} sem telefone</span>}
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Carregando...
          </div>
        ) : agendamentos.length === 0 && medicoId ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Nenhum agendamento encontrado para {formatDate(data)}
          </div>
        ) : agendamentos.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selecionados.size > 0 && selecionados.size === agendamentos.filter(a => a.telefone_whatsapp && !a.confirmacao && a.ind_status !== 'C').length}
                    onChange={() => {
                      if (selecionados.size > 0) setSelecionados(new Set());
                      else selecionarPendentes();
                    }}
                    className="rounded border-gray-300 bg-white text-schappo-500 focus:ring-schappo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Convenio</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Procedimento</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agendamentos.map((ag: AgendamentoPaciente) => {
                const isConfirmadoERP = ag.ind_status === 'C';
                const hasConfirmacao = !!ag.confirmacao;
                const canSelect = !!ag.telefone_whatsapp && !hasConfirmacao && !isConfirmadoERP;
                const isSelected = selecionados.has(ag.chave);
                const isUpdating = statusUpdating === ag.chave;

                return (
                  <tr
                    key={ag.chave}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-schappo-500/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {canSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelecao(ag.chave)}
                          className="rounded border-gray-300 bg-white text-schappo-500 focus:ring-schappo-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{ag.des_hora || '--'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{ag.nom_paciente_completo || 'Sem nome'}</div>
                      {ag.nom_resp && <div className="text-xs text-gray-500">Resp: {ag.nom_resp}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{ag.convenio || '--'}</td>
                    <td className="px-4 py-3">
                      {ag.telefone_whatsapp ? (
                        <span className="text-green-600">{formatPhone(ag.telefone_whatsapp)}</span>
                      ) : (
                        <span className="text-red-600 text-xs">Sem telefone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={ag.des_procedimento || ''}>
                      {ag.des_procedimento || '--'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ag.confirmacao?.status || null} indStatus={ag.ind_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {hasConfirmacao && ag.confirmacao?.status === 'enviado' && (
                          <>
                            <button
                              onClick={() => handleStatus(ag.chave, 'confirmado')}
                              disabled={isUpdating}
                              className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                              title="Marcar como confirmado"
                            >
                              {isUpdating ? '...' : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => handleStatus(ag.chave, 'desmarcou')}
                              disabled={isUpdating}
                              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                              title="Marcar como desmarcou"
                            >
                              Desm.
                            </button>
                            <button
                              onClick={() => handleStatus(ag.chave, 'sem_resposta')}
                              disabled={isUpdating}
                              className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                              title="Marcar como sem resposta"
                            >
                              S/R
                            </button>
                          </>
                        )}
                        {hasConfirmacao && (ag.confirmacao?.status === 'desmarcou' || ag.confirmacao?.status === 'sem_resposta' || ag.confirmacao?.status === 'reagendar') && (
                          <button
                            onClick={() => handleStatus(ag.chave, 'confirmado')}
                            disabled={isUpdating}
                            className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            {isUpdating ? '...' : 'Confirmar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Selecione um medico e data para ver agendamentos
          </div>
        )}
      </div>

      {/* Barra inferior — botao de disparo */}
      {selecionados.size > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">{selecionados.size} paciente(s) selecionado(s)</span>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar Confirmacao ({selecionados.size})
          </button>
        </div>
      )}

      {/* Modal de disparo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">Enviar Confirmacao via WhatsApp</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">
                  Sera enviada para <strong className="text-gray-900">{selecionados.size} paciente(s)</strong> pelo WhatsApp Recepcao.
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Variaveis disponiveis: {'{nome_paciente}'}, {'{nome_paciente_completo}'}, {'{data}'}, {'{hora}'}, {'{nome_medico}'}, {'{procedimento}'}
                </p>
              </div>

              {/* Seletor de template */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Template</label>
                <div className="flex gap-2">
                  <select
                    value={templateSelecionado || ''}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      if (id) handleSelectTemplate(id);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-schappo-500"
                  >
                    <option value="">Selecionar template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}{t.padrao ? ' (padrao)' : ''}</option>
                    ))}
                  </select>
                  {templateSelecionado && !templates.find(t => t.id === templateSelecionado)?.padrao && (
                    <button
                      onClick={() => handleDeleteTemplate(templateSelecionado)}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-lg"
                      title="Excluir template"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              <label className="block text-xs text-gray-500 mb-1">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={(e) => { setMensagem(e.target.value); setTemplateSelecionado(null); }}
                rows={12}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-schappo-500 resize-none font-mono"
              />

              {/* Salvar como template */}
              {!showSalvarTemplate ? (
                <button
                  onClick={() => setShowSalvarTemplate(true)}
                  className="mt-2 text-xs text-schappo-500 hover:text-schappo-400"
                >
                  Salvar como template
                </button>
              ) : (
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nome do template"
                    value={nomeNovoTemplate}
                    onChange={(e) => setNomeNovoTemplate(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-schappo-500"
                  />
                  <button
                    onClick={handleSalvarTemplate}
                    disabled={salvandoTemplate || !nomeNovoTemplate.trim()}
                    className="px-3 py-1 text-xs bg-schappo-500 text-white rounded hover:bg-schappo-600 disabled:opacity-50"
                  >
                    {salvandoTemplate ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setShowSalvarTemplate(false); setNomeNovoTemplate(''); }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-900"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Preview */}
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1">Preview (primeiro paciente)</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {(() => {
                    const primeiro = agendamentos.find(a => selecionados.has(a.chave));
                    if (!primeiro) return mensagem;
                    return mensagem
                      .replace(/\{nome_paciente\}/g, (primeiro.nom_paciente_completo || 'Paciente').split(' ')[0])
                      .replace(/\{nome_paciente_completo\}/g, primeiro.nom_paciente_completo || 'Paciente')
                      .replace(/\{data\}/g, formatDate(data))
                      .replace(/\{hora\}/g, primeiro.des_hora || '')
                      .replace(/\{nome_medico\}/g, medicoInfo?.nom_guerra || medicoInfo?.nom_medico || '')
                      .replace(/\{procedimento\}/g, primeiro.des_procedimento || '');
                  })()}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviar}
                disabled={enviando || !mensagem.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enviando ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  `Enviar para ${selecionados.size} paciente(s)`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
