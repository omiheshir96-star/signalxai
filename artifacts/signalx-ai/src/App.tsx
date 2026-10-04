import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Check, CircleHelp, Clock3, Radar, RefreshCw, ShieldCheck, SlidersHorizontal, Wifi } from 'lucide-react';
import { getGetSignalxStateQueryKey, useGetSignalxState, useTriggerSignalxScan } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

function Home() {
  const queryClient = useQueryClient();
  const [scanMessage, setScanMessage] = useState('');
  const stateQuery = useGetSignalxState({
    query: { queryKey: getGetSignalxStateQueryKey(), refetchInterval: 15000 },
  });
  const scanMutation = useTriggerSignalxScan({
    mutation: {
      onSuccess: async (response) => {
        setScanMessage(response.message);
        await queryClient.invalidateQueries({ queryKey: getGetSignalxStateQueryKey() });
      },
      onError: () => setScanMessage('The scan request could not be completed. Please try again.'),
    },
  });
  const data = stateQuery.data;
  const refreshingWithError = Boolean(data && stateQuery.isError);
  const dateFormat = (value: string | null | undefined) => {
    if (!value) return 'No completed scan yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const priceFormat = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  const confidenceFormat = (value: number) => `${Math.round(value)}%`;

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand">
          <div className="brand-mark"><Activity size={19} strokeWidth={1.8} /></div>
          <div className="brand-name">signal<span>x</span> <span style={{ color: '#e1e5dd' }}>AI</span></div>
        </div>
        <div>
          <div className="rail-label">Workspace</div>
          <div className="nav-link" aria-current="page"><Radar size={16} /> Market scanner</div>
        </div>
        <div className="rail-note">
          <strong><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />Rules, not predictions</strong>
          Signals are recorded only when configured indicator rules pass. No fabricated examples or forward-looking claims.
        </div>
        <div className="rail-foot">SIGNALX / SCANNER 01</div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb"><span>Markets</span><span>/</span><strong>Signal scanner</strong></div>
          <div className="top-live"><span className="live-dot" /> Polling every 15 sec</div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">Rule-based market monitor</div>
              <h1>Signal scanner</h1>
              <p className="lede">A transparent record of short-term setups that meet the configured rules.</p>
            </div>
            <button className="action-button" data-testid="button-manual-scan" onClick={() => { setScanMessage(''); scanMutation.mutate(); }} disabled={scanMutation.isPending || Boolean(data?.state.scanInProgress)} aria-busy={scanMutation.isPending}>
              {scanMutation.isPending ? <RefreshCw size={15} className="spin-icon" /> : <Radar size={16} />}
              {scanMutation.isPending ? 'Requesting scan…' : data?.state.scanInProgress ? 'Scan in progress' : 'Run scan now'}
            </button>
          </section>

          {refreshingWithError && <div className="scan-error" role="status" data-testid="status-refresh-error">Unable to refresh scanner state. Showing the last successfully loaded snapshot. <button onClick={() => stateQuery.refetch()} className="inline-retry">Retry</button></div>}
          {!data && stateQuery.isError && <div className="panel error-state" role="alert" data-testid="status-load-error">
            <div className="empty-icon"><AlertCircle size={19} /></div>
            <h3>Scanner state is unavailable</h3>
            <p>{stateQuery.error instanceof Error ? stateQuery.error.message : 'We could not reach the scanner service. Try loading the current state again.'}</p>
            <button className="secondary-button" onClick={() => stateQuery.refetch()} data-testid="button-retry-state">Retry connection</button>
          </div>}
          {scanMessage && <div className="scan-message" role="status" data-testid="status-scan-response"><Check size={14} />{scanMessage}</div>}
          {data?.state.lastError && <div className="scan-error" role="status" data-testid="status-scanner-error"><AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />Scanner reported: {data.state.lastError}</div>}

          <section className="panel status-grid" aria-label="Scanner status">
            <div className="status-cell" data-testid="status-scanner-running">
              <div className="cell-label">Scanner service</div>
              {stateQuery.isLoading && !data ? <div className="skeleton" style={{ width: 130 }} /> : data ? <>
                <div className="status-value"><span className={`live-dot ${data.state.running ? '' : 'inactive-dot'}`} />{data.state.running ? 'Running' : 'Stopped'}<span className={`status-pill ${data.state.running ? '' : 'off'}`}>{data.state.running ? 'Active' : 'Paused'}</span></div>
                <div className="status-sub">{data.state.scanInProgress ? 'A market scan is currently underway' : 'No scan currently in progress'}</div>
              </> : <div className="status-sub">Waiting for scanner status</div>}
            </div>
            <div className="status-cell" data-testid="status-last-scan">
              <div className="cell-label">Last completed scan</div>
              {stateQuery.isLoading && !data ? <div className="skeleton" style={{ width: 190 }} /> : <>
                <div className="status-value"><Clock3 size={15} color="#71877b" />{data ? dateFormat(data.state.lastScan) : 'Unavailable'}</div>
                <div className="status-sub">{data ? `${data.config.scanSeconds}s scheduled interval · ${data.config.timeframe} timeframe` : 'Scanner state has not loaded'}</div>
              </>}
            </div>
            <div className="status-cell" data-testid="status-delivery">
              <div className="cell-label">Alert delivery</div>
              {stateQuery.isLoading && !data ? <div className="skeleton" style={{ width: 130 }} /> : <>
                <div className="status-value"><Wifi size={15} color="#71877b" />{data ? (data.config.telegramConfigured ? 'Telegram configured' : 'Not configured') : 'Unavailable'}</div>
                <div className="status-sub">{data?.config.telegramConfigured ? 'Configured channel status' : 'Signals remain available here'}</div>
              </>}
            </div>
          </section>

          <section className="panel config-panel" aria-label="Scanner configuration">
            {stateQuery.isLoading && !data ? Array.from({ length: 5 }, (_, i) => <div className="config-item" key={i}><div className="cell-label">Loading configuration</div><div className="skeleton" style={{ width: '80%' }} /></div>) : data ? <>
              <div className="config-item"><div className="cell-label"><SlidersHorizontal size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />Minimum score</div><div className="config-value">{data.config.minScore}</div></div>
              <div className="config-item"><div className="cell-label">Scan interval</div><div className="config-value">{data.config.scanSeconds} seconds</div></div>
              <div className="config-item"><div className="cell-label">Timeframe</div><div className="config-value">{data.config.timeframe}</div></div>
              <div className="config-item"><div className="cell-label">Configured markets</div><div className="config-value symbols">{data.config.symbols.length ? data.config.symbols.join(', ') : 'None configured'}</div></div>
              <div className="config-item"><div className="cell-label">Signal logic</div><div className="config-value">EMA · RSI · MACD · VOL</div></div>
            </> : <>
              <div className="config-item"><div className="cell-label">Configuration</div><div className="config-value">Unavailable</div></div>
              <div className="config-item"><div className="cell-label">Source</div><div className="config-value">Scanner service</div></div>
            </>}
          </section>

          <section aria-labelledby="signals-heading">
            <div className="section-head">
              <div>
                <h2 id="signals-heading" className="section-title">Latest persisted signals</h2>
                <div className="section-caption">Only signals saved by the scanner are shown. No sample or simulated entries.</div>
              </div>
              <div className="persist-note"><Check size={13} />Persisted records only</div>
            </div>
            <div className="panel signals-panel" data-testid="list-persisted-signals">
              <div className="table-head"><div>Market / time</div><div>Side</div><div>Price / RSI</div><div>Confidence</div><div>Result</div><div>Rule trace</div></div>
              {stateQuery.isLoading && !data ? <div className="loading-state" aria-label="Loading persisted signals" data-testid="status-loading-signals">{[0,1,2].map((item) => <div key={item} className="skeleton" style={{ width: `${92 - item * 10}%`, height: 42, marginBottom: 12 }} />)}</div> : !data ? null : data.signals.length === 0 ? <div className="empty-state" data-testid="status-empty-signals">
                <div className="empty-icon"><BarChart3 size={19} /></div>
                <h3>No persisted signals yet</h3>
                <p>When a market meets the configured EMA, RSI, MACD, volume and volatility rules, its saved signal will appear here. A scan can return no qualifying setups.</p>
              </div> : data.signals.map((signal) => <div className="signal-row" key={signal.id} data-testid={`row-signal-${signal.id}`}>
                <div><div className="pair">{signal.symbol}</div><div className="date">{dateFormat(signal.createdAt)}</div></div>
                <div><span className={`side-tag ${signal.side === 'SELL' ? 'sell' : ''}`}>{signal.side === 'BUY' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{signal.side}</span></div>
                <div><div className="metric">{priceFormat(signal.price)}</div><div className="metric-muted">RSI {signal.rsi.toFixed(1)} · Vol {signal.volatility.toFixed(2)}%</div></div>
                <div className="metric">{confidenceFormat(signal.confidence)}</div>
                <div><span className="result-tag">{signal.result || 'Pending'}</span></div>
                <div className="reason">{signal.reasons || 'No rule details recorded'}</div>
              </div>)}
            </div>
          </section>

          <div className="warning" role="note" data-testid="notice-financial-risk">
            <AlertTriangle size={15} className="warning-icon" />
            <div><strong>Educational information only — not financial advice.</strong> Signals are rule-based observations, not recommendations or guarantees of future performance. Digital assets are volatile and can result in substantial losses. Evaluate risk independently before making any financial decision.</div>
          </div>
          <div className="footnote"><CircleHelp size={12} /> Indicator names describe the configured scanner logic; they do not imply a prediction.</div>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
