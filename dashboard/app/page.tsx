'use client';

import { useCallback, useEffect, useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8787';

interface ActivityItem {
  id: string;
  url: string | null;
  title: string | null;
  origin: string | null;
  app: string | null;
  task: string | null;
  category: string | null;
  entities: string[] | null;
  summary: string | null;
  status: string;
  occurred_at: string;
  imageUrl: string | null;
}

export default function Page() {
  const [token, setToken] = useState('');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vaa_dashboard_token');
    if (saved) setToken(saved);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { authorization: `Bearer ${token}` };
      const [aRes, sRes] = await Promise.all([
        fetch(`${BACKEND}/v1/activity?limit=100`, { headers }),
        fetch(`${BACKEND}/v1/activity/summary`, { headers }),
      ]);
      if (!aRes.ok) throw new Error(`activity ${aRes.status}`);
      const a = await aRes.json();
      const s = sRes.ok ? await sRes.json() : { totals: {} };
      setItems(a.items ?? []);
      setTotals(s.totals ?? {});
      localStorage.setItem('vaa_dashboard_token', token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="wrap">
      <h1>Visual AI Agent</h1>
      <p className="sub">Your browser activity, interpreted by Claude vision.</p>

      <div className="tokenbar">
        <input
          type="password"
          placeholder="Paste your auth token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={() => void load()} disabled={!token || loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {error && <p className="empty">Error: {error}</p>}

      {Object.keys(totals).length > 0 && (
        <div className="chips">
          {Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => (
              <span className="chip" key={cat}>
                {cat} <b>{n}</b>
              </span>
            ))}
        </div>
      )}

      {items.length === 0 && !loading && (
        <p className="empty">No activity yet. Enable the extension and start browsing.</p>
      )}

      {items.map((it) => (
        <article className="card" key={it.id}>
          {it.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.imageUrl} alt={it.summary ?? 'capture'} />
          ) : (
            <div className="img" style={{ width: 160, height: 100 }} />
          )}
          <div className="meta">
            <div className="app">{it.app ?? 'Pending…'}</div>
            <div className="task">{it.task ?? ''}</div>
            {it.summary && <div className="summary">{it.summary}</div>}
            <div className="row">
              {it.category && <span className="pill">{it.category}</span>}
              <span className="pill">{new Date(it.occurred_at).toLocaleString()}</span>
              {it.origin && <span className="pill">{new URL(it.origin).hostname}</span>}
              {it.status !== 'processed' && <span className="pill">{it.status}</span>}
            </div>
            {(it.entities?.length ?? 0) > 0 && (
              <div className="row">
                {it.entities!.map((e, i) => (
                  <span className="pill" key={i}>
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </main>
  );
}
