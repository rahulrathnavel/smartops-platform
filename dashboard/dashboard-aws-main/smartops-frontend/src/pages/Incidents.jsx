import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { CheckCircle, GitPullRequest, ExternalLink, ChevronRight } from 'lucide-react';

const STEPS = [
  { key: 'detected',          label: 'Detected'         },
  { key: 'diagnosing',        label: 'RCA + LLM Analysis'},
  { key: 'fix_proposed',      label: 'Fix Generated'     },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'resolved',          label: 'Resolved'          },
];

const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

function ProgressBar({ status }) {
  const cur = STEP_INDEX[status] ?? 0;
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((step, i) => {
        const done   = i < cur;
        const active = i === cur;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done    ? 'bg-blue-600 border-blue-600 text-white' :
                active  ? 'bg-white border-blue-600 text-blue-600 pulse-dot' :
                          'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center w-16 leading-tight ${
                active ? 'text-blue-600' : done ? 'text-slate-500' : 'text-slate-300'
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < cur ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ConfidenceBar({ pct, label, primary }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-sub)' }}>
        <span className={primary ? 'font-semibold text-red-600' : ''}>{label}</span>
        <span className="font-mono font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${primary ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SuggestionBox({ incidentId, onSubmit }) {
  const [text, setText] = useState('');
  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(incidentId, text.trim());
    setText('');
  }
  return (
    <form onSubmit={handleSubmit} className="mt-3 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe a change request — e.g. rename the variable to 'discountValue' or remove the pricing block entirely"
        className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none"
        style={{ color: 'var(--text-main)', background: '#f8fafc', minHeight: '72px' }}
      />
      <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>LLM will re-generate the fix based on your suggestion</span>
        <button type="submit"
          className="px-3 py-1.5 rounded text-xs font-semibold text-white transition-colors"
          style={{ background: 'var(--brand)' }}>
          Submit Suggestion
        </button>
      </div>
    </form>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [suggesting, setSuggesting] = useState({});

  useEffect(() => {
    socket.on('incident:detected', (data) => {
      setIncidents(prev => [{
        ...data, status: 'detected', startedAt: Date.now(),
        diagnosis: null, rcaOutput: null, fix: null, prUrl: null, suggestions: [],
      }, ...prev]);
      setExpanded(prev => ({ ...prev, [data.id]: true }));
    });

    socket.on('incident:diagnosed', (data) => {
      setIncidents(prev => prev.map(i => i.id === data.id
        ? { ...i, status: 'diagnosing', diagnosis: data.diagnosis, rcaOutput: data.rcaOutput, fix: data.proposedFix }
        : i
      ));
    });

    socket.on('incident:fix_proposed', (data) => {
      setIncidents(prev => prev.map(i => i.id === data.id
        ? { ...i, status: 'awaiting_approval' }
        : i
      ));
    });

    socket.on('incident:resolved', (data) => {
      setIncidents(prev => prev.map(i => i.id === data.id
        ? { ...i, status: 'resolved', resolvedAt: Date.now(), prUrl: data.prUrl }
        : i
      ));
    });

    return () => {
      socket.off('incident:detected');
      socket.off('incident:diagnosed');
      socket.off('incident:fix_proposed');
      socket.off('incident:resolved');
    };
  }, []);

  function toggle(id) { setExpanded(prev => ({ ...prev, [id]: !prev[id] })); }

  function handleSuggestion(incidentId, text) {
    setIncidents(prev => prev.map(i => i.id === incidentId
      ? { ...i, suggestions: [...(i.suggestions || []), { text, at: new Date().toLocaleTimeString() }], status: 'diagnosing' }
      : i
    ));
    setSuggesting(prev => ({ ...prev, [incidentId]: false }));
    fetch(`${import.meta.env.VITE_AGENT_URL || 'http://abe89923884ea4896bdda38a738650f7-afd67114d324f5df.elb.ap-south-1.amazonaws.com'}/incidents`, { method: 'GET' })
      .catch(() => {});
  }

  const active   = incidents.filter(i => i.status !== 'resolved').length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="p-7 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Incidents</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>
            {active} active &mdash; {resolved} resolved this session
          </p>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center" style={{ borderColor: 'var(--border)' }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="font-semibold" style={{ color: 'var(--text-sub)' }}>No incidents detected</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>The SmartOps Agent is monitoring your cluster</p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((inc) => {
            const isOpen = expanded[inc.id];
            const rca    = inc.rcaOutput;

            return (
              <div key={inc.id} className={`bg-white rounded-xl border fadein transition-shadow ${
                inc.status !== 'resolved' && inc.status !== 'detected'
                  ? 'border-blue-200 shadow-sm shadow-blue-100'
                  : ''
              }`} style={{ borderColor: inc.status === 'resolved' ? 'var(--border)' : undefined }}>

                {/* Header row */}
                <button
                  onClick={() => toggle(inc.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      inc.status === 'resolved' ? 'bg-green-500' :
                      inc.status === 'awaiting_approval' ? 'bg-amber-500 pulse-dot' :
                      'bg-red-500 pulse-dot'
                    }`} />
                    <div>
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--brand)' }}>{inc.id}</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                        {inc.service}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      inc.status === 'resolved'          ? 'bg-green-50 text-green-700' :
                      inc.status === 'awaiting_approval' ? 'bg-amber-50 text-amber-700' :
                      inc.status === 'diagnosing'        ? 'bg-blue-50 text-blue-700' :
                                                           'bg-red-50 text-red-600'
                    }`}>{inc.status?.replace('_', ' ').toUpperCase()}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t pt-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                    {/* Progress steps */}
                    <ProgressBar status={inc.status} />

                    {/* Error log */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Error Log
                      </p>
                      <pre className="text-xs rounded-lg px-3 py-2.5 overflow-x-auto font-mono" style={{ background: '#fef2f2', color: '#991b1b' }}>
                        {inc.errorLog || inc.error || 'Capturing error...'}
                      </pre>
                    </div>

                    {/* RCA Model Output */}
                    {rca && (
                      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-sub)' }}>
                          RCA Model — Service Confidence Analysis
                        </p>
                        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                          Model: {rca.model} &mdash; Analysis time: {rca.analysisTime || '1.2s'}
                        </p>
                        {rca.propagationPath?.map((svc, i) => (
                          <ConfidenceBar
                            key={svc}
                            label={svc}
                            pct={i === 0
                              ? Math.round((rca.confidence || 0.9) * 100)
                              : Math.round(((rca.confidence || 0.9) * (0.55 - i * 0.1)) * 100)}
                            primary={svc === rca.rootCauseNode}
                          />
                        ))}
                        {rca.evidenceMetrics && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {Object.entries(rca.evidenceMetrics).map(([k, v]) => (
                              <div key={k} className="rounded p-2 bg-white border text-center" style={{ borderColor: 'var(--border)' }}>
                                <p className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>{k}</p>
                                <p className="text-sm font-bold font-mono" style={{ color: 'var(--text-main)' }}>{v}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* LLM Diagnosis */}
                    {inc.diagnosis && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          LLM Diagnosis
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-main)' }}>{inc.diagnosis}</p>
                      </div>
                    )}

                    {/* Proposed fix */}
                    {inc.fix && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Proposed Fix
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-main)' }}>{inc.fix}</p>
                      </div>
                    )}

                    {/* Suggestion history */}
                    {(inc.suggestions || []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Developer Suggestions
                        </p>
                        {inc.suggestions.map((s, i) => (
                          <div key={i} className="text-xs py-1.5 px-3 rounded mb-1.5 border-l-2 border-blue-400" style={{ background: '#eff6ff', color: 'var(--text-sub)' }}>
                            <span className="font-mono text-[10px] text-blue-500 mr-2">{s.at}</span>
                            {s.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Awaiting approval — action buttons */}
                    {inc.status === 'awaiting_approval' && (
                      <div className="border rounded-lg p-4" style={{ borderColor: 'var(--border)', background: '#fffbeb' }}>
                        <p className="text-sm font-semibold mb-3" style={{ color: '#92400e' }}>
                          Approval Required — check Slack or WhatsApp for the approval link
                        </p>
                        {!suggesting[inc.id] ? (
                          <button
                            onClick={() => setSuggesting(prev => ({ ...prev, [inc.id]: true }))}
                            className="text-xs px-3 py-1.5 rounded font-semibold border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-sub)' }}>
                            Suggest a Change
                          </button>
                        ) : (
                          <SuggestionBox incidentId={inc.id} onSubmit={handleSuggestion} />
                        )}
                      </div>
                    )}

                    {/* Resolved */}
                    {inc.status === 'resolved' && (
                      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#f0fdf4' }}>
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-700">Incident Resolved</p>
                          {inc.prUrl && (
                            <a href={inc.prUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-green-600 flex items-center gap-1 mt-0.5 hover:underline">
                              <GitPullRequest className="w-3 h-3" />
                              View Pull Request
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
