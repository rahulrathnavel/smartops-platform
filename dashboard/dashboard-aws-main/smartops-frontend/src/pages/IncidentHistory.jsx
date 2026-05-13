import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, MessageSquare, RefreshCw } from 'lucide-react';

const BACKEND = 'http://a838f4250b43e4d0489cd64ba2e22216-d3b0776ea4ad5d48.elb.ap-south-1.amazonaws.com';

const EVENT_CONFIG = {
  DETECTED:   { label: 'Detected',   color: '#dc2626', bg: '#fef2f2' },
  APPROVED:   { label: 'Approved',   color: '#16a34a', bg: '#f0fdf4' },
  REJECTED:   { label: 'Rejected',   color: '#d97706', bg: '#fffbeb' },
  SUGGESTION: { label: 'Suggestion', color: '#2563eb', bg: '#eff6ff' },
};

function Badge({ type }) {
  const c = EVENT_CONFIG[type] || EVENT_CONFIG.DETECTED;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function EventIcon({ type }) {
  if (type === 'APPROVED')   return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (type === 'REJECTED')   return <XCircle className="w-4 h-4 text-amber-500" />;
  if (type === 'SUGGESTION') return <MessageSquare className="w-4 h-4 text-blue-500" />;
  return <div className="w-2 h-2 rounded-full bg-red-500 mt-1" />;
}

export default function IncidentHistory() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/incidents/history`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setEvents(data.events || []);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Group events by incidentId
  const grouped = events.reduce((acc, ev) => {
    if (!acc[ev.incidentId]) acc[ev.incidentId] = [];
    acc[ev.incidentId].push(ev);
    return acc;
  }, {});

  const incidentIds = Object.keys(grouped).sort((a, b) => {
    const la = grouped[a][0]?.createdAt || '';
    const lb = grouped[b][0]?.createdAt || '';
    return lb.localeCompare(la);
  });

  return (
    <div className="p-7 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Incident History</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>
            Full audit ledger stored in DynamoDB
            {lastFetch && ` — fetched ${lastFetch.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-slate-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-sub)' }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>
          Failed to load history: {error}. The dashboard backend needs to expose <code>/api/incidents/history</code>.
        </div>
      )}

      {loading && !events.length ? (
        <div className="bg-white rounded-xl border py-16 text-center" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading incident ledger from DynamoDB...</p>
        </div>
      ) : incidentIds.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center" style={{ borderColor: 'var(--border)' }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="font-semibold" style={{ color: 'var(--text-sub)' }}>No incident history yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Incidents will appear here once they are detected and processed
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidentIds.map((id) => {
            const evs = grouped[id];
            const detected   = evs.find(e => e.eventType === 'DETECTED');
            const resolution = evs.find(e => ['APPROVED','REJECTED'].includes(e.eventType));
            const suggestions = evs.filter(e => e.eventType === 'SUGGESTION');

            return (
              <div key={id} className="bg-white rounded-xl border fadein" style={{ borderColor: 'var(--border)' }}>
                {/* Incident header */}
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono" style={{ color: 'var(--brand)' }}>{id}</span>
                      {resolution && <Badge type={resolution.eventType} />}
                      {!resolution && <Badge type="DETECTED" />}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {detected?.createdAt ? new Date(detected.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  {detected?.service && (
                    <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-sub)' }}>
                      Service: {detected.service}
                    </p>
                  )}
                  {detected?.errorLog && (
                    <p className="text-xs mt-1.5 font-mono px-2 py-1.5 rounded" style={{ background: '#fef2f2', color: '#991b1b' }}>
                      {detected.errorLog}
                    </p>
                  )}
                </div>

                {/* Event timeline */}
                <div className="px-5 py-4 space-y-3">
                  {evs.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <EventIcon type={ev.eventType} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge type={ev.eventType} />
                          {ev.approvedBy && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {ev.approvedBy}</span>
                          )}
                          {ev.rejectedBy && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {ev.rejectedBy}</span>
                          )}
                          {ev.suggestionBy && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {ev.suggestionBy}</span>
                          )}
                          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        {ev.suggestionText && (
                          <p className="text-xs mt-1 px-2 py-1.5 rounded border-l-2 border-blue-400 italic"
                            style={{ background: '#eff6ff', color: 'var(--text-sub)' }}>
                            "{ev.suggestionText}"
                          </p>
                        )}
                        {ev.fixSummary && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>
                            Fix: {ev.fixSummary}
                          </p>
                        )}
                        {ev.action && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>
                            Action: {ev.action}
                          </p>
                        )}
                        {ev.diagnosis && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>
                            Diagnosis: {ev.diagnosis}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Summary stats */}
                  <div className="flex items-center gap-4 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <span>{evs.length} event{evs.length !== 1 ? 's' : ''}</span>
                    {suggestions.length > 0 && (
                      <span>{suggestions.length} developer suggestion{suggestions.length !== 1 ? 's' : ''}</span>
                    )}
                    {resolution?.resolvedAt && (
                      <span>Resolved: {new Date(resolution.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
