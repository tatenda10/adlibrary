import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import SectionCard from '../components/decision-engine/SectionCard.jsx';
import {
  createSavedPlan,
  generateCreativeBrief,
  generateCreativeTestPlanner,
  getCompetitorAlerts,
  getLandingAdMatchScore,
  getPerformanceBenchmarks,
  getPersonaLens,
  getWeeklyRecommendations,
  getWinningPatterns,
} from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

function DecisionEngine() {
  const { getToken } = useAuth();
  const location = useLocation();
  const { notifyApiError } = useApiToast();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [brief, setBrief] = useState(null);
  const [match, setMatch] = useState(null);
  const [working, setWorking] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [matchForm, setMatchForm] = useState({
    landingHeadline: '',
    adHook: '',
    adCta: '',
  });

  const isCompetitorAnalysis = location.pathname.includes('/app/competitor-analysis');

  const pageTitle = isCompetitorAnalysis ? 'Competitor analysis' : 'Decision engine';
  const pageHeading = isCompetitorAnalysis ? 'What are competitors changing right now?' : 'What should we launch next?';
  const pageDescription = isCompetitorAnalysis
    ? 'Monitor competitor offer shifts, creative trends, persona pressure points, and benchmark movement from one workspace.'
    : 'Brand-aware weekly recommendations, test matrix generation, winning patterns, persona lens, and landing/ad fit scoring.';

  const selectedRecommendation = recommendations[0] || null;

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) throw new Error('Session token unavailable');

        const [recData, patternData, alertData, personaData, benchmarkData] = await Promise.all([
          getWeeklyRecommendations(token),
          getWinningPatterns(token),
          getCompetitorAlerts(token),
          getPersonaLens(token),
          getPerformanceBenchmarks(token),
        ]);

        if (cancelled) return;
        setRecommendations(recData?.recommendations || []);
        setPatterns(patternData?.patterns || []);
        setAlerts(alertData?.alerts || []);
        setPersonas(personaData?.personas || []);
        setBenchmarks(benchmarkData?.benchmarks || []);
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load decision engine.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

  const plannerPayload = useMemo(() => {
    if (!selectedRecommendation) return null;
    return {
      hooks: [selectedRecommendation.hook, `${selectedRecommendation.hook} (proof variant)`],
      angles: [selectedRecommendation.angle, 'Social proof + urgency'],
      ctas: [selectedRecommendation.cta, 'Start now'],
      formats: ['UGC testimonial', 'Product demo'],
    };
  }, [selectedRecommendation]);

  const handleGeneratePlanner = async () => {
    if (!plannerPayload) return;
    try {
      setWorking('planner');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await generateCreativeTestPlanner(token, plannerPayload);
      setMatrix(data?.matrix || []);
    } catch (err) {
      notifyApiError(err, 'Failed to generate test planner.');
    } finally {
      setWorking('');
    }
  };

  const handleGenerateBrief = async () => {
    try {
      if (!matrix.length) return;
      setWorking('brief');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const firstCell = matrix[0];
      const data = await generateCreativeBrief(token, {
        objective: 'Drive qualified conversions this week',
        audience: personas[0]?.name || 'High intent buyer',
        hook: firstCell.hook,
        angle: firstCell.angle,
        cta: firstCell.cta,
        format: firstCell.format,
      });
      setBrief(data?.brief || null);
    } catch (err) {
      notifyApiError(err, 'Failed to generate creative brief.');
    } finally {
      setWorking('');
    }
  };

  const handleRunMatchScore = async () => {
    try {
      setWorking('match');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await getLandingAdMatchScore(token, matchForm);
      setMatch(data || null);
    } catch (err) {
      notifyApiError(err, 'Failed to calculate match score.');
    } finally {
      setWorking('');
    }
  };

  const handleSavePlan = async () => {
    try {
      if (!matrix.length && !brief) return;
      setWorking('save');
      setSaveMessage('');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const title = `Plan ${new Date().toLocaleString()}`;
      await createSavedPlan(token, {
        title,
        plan_type: 'matrix_brief',
        matrix,
        brief,
        meta: {
          recommendation_seed: selectedRecommendation?.title || '',
          match_score: match?.score || null,
        },
      });
      setSaveMessage('Plan saved to Saved Plans.');
    } catch (err) {
      notifyApiError(err, 'Failed to save plan.');
    } finally {
      setWorking('');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay label="Loading decision engine…" minHeight="52vh" />;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">{pageTitle}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{pageHeading}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">{pageDescription}</p>
      </header>

      {working ? (
        <CubeLoaderOverlay
          label={
            working === 'planner'
              ? 'Generating test matrix…'
              : working === 'brief'
                ? 'Generating creative brief…'
                : working === 'match'
                  ? 'Calculating match score…'
                  : 'Saving plan…'
          }
          fullscreen
        />
      ) : null}

      {!isCompetitorAnalysis ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Weekly recommendations"
            subtitle="Top creatives to launch this week."
            actions={(
              <button
                type="button"
                onClick={handleGeneratePlanner}
                disabled={!plannerPayload || working === 'planner'}
                className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
              >
                {working === 'planner' ? 'Generating...' : 'Generate test matrix'}
              </button>
            )}
          >
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <article key={rec.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-sm font-semibold text-white">{rec.title}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {rec.channel} - {rec.funnel_stage} - Budget ${rec.recommended_budget_usd}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">Hook: {rec.hook}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Angle: {rec.angle} | CTA: {rec.cta}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{rec.why}</p>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Creative test planner"
            subtitle="Priority-ranked matrix generated from your top recommendation."
            actions={(
              <button
                type="button"
                onClick={handleGenerateBrief}
                disabled={!matrix.length || working === 'brief'}
                className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {working === 'brief' ? 'Generating...' : 'Generate creative brief'}
              </button>
            )}
          >
            {matrix.length ? (
              <div className="space-y-2">
                {matrix.map((cell) => (
                  <div key={cell.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">
                    <p className="font-medium text-white">
                      {cell.priority_label} ({cell.priority_score})
                    </p>
                    <p className="text-xs text-slate-300">
                      Hook: {cell.hook} | Angle: {cell.angle} | CTA: {cell.cta} | Format: {cell.format}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Generate a planner from your recommendations.</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Winning pattern detection" subtitle="Top rising hooks and creative patterns.">
          <div className="space-y-2">
            {patterns.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-sm font-semibold text-white">{item.pattern}</p>
                <p className="text-xs text-slate-300">Rising score {item.rising_score} - Frequency {item.frequency}</p>
                <p className="mt-1 text-xs text-slate-400">{item.recommendation}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Competitor change alerts" subtitle="Recent shifts in offers and hook styles.">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-white/10 px-3 py-2">
                <p className="text-sm font-semibold text-white">{alert.competitor}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{alert.type.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Audience/persona lens" subtitle="Recommended angles by persona.">
          <div className="space-y-2">
            {personas.map((persona) => (
              <div key={persona.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-sm font-semibold text-white">{persona.name}</p>
                <p className="text-xs text-slate-300">{persona.summary}</p>
                <p className="mt-1 text-xs text-slate-400">Best angles: {(persona.best_angles || []).join(', ')}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Performance benchmarks" subtitle="Directional benchmark targets by niche.">
          <div className="space-y-2">
            {benchmarks.map((metric) => (
              <div key={metric.metric} className="rounded-lg border border-white/10 px-3 py-2">
                <p className="text-sm font-semibold text-white">{metric.metric}</p>
                <p className="text-xs text-slate-300">
                  {metric.value} - {metric.note}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {!isCompetitorAnalysis ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Landing-to-ad match score" subtitle="Check messaging alignment before launch.">
            <div className="space-y-2">
              <input
                value={matchForm.landingHeadline}
                onChange={(e) => setMatchForm((prev) => ({ ...prev, landingHeadline: e.target.value }))}
                placeholder="Landing headline"
                className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                value={matchForm.adHook}
                onChange={(e) => setMatchForm((prev) => ({ ...prev, adHook: e.target.value }))}
                placeholder="Ad hook"
                className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                value={matchForm.adCta}
                onChange={(e) => setMatchForm((prev) => ({ ...prev, adCta: e.target.value }))}
                placeholder="Ad CTA"
                className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={handleRunMatchScore}
                disabled={working === 'match'}
                className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {working === 'match' ? 'Scoring...' : 'Calculate match'}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Creative brief output"
            subtitle="Execution-ready handoff for designers and editors."
            actions={(
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={(!matrix.length && !brief) || working === 'save'}
                className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {working === 'save' ? 'Saving...' : 'Save plan'}
              </button>
            )}
          >
            {brief ? (
              <div className="space-y-2 text-sm text-slate-200">
                <p><span className="font-semibold text-white">Objective:</span> {brief.objective}</p>
                <p><span className="font-semibold text-white">Audience:</span> {brief.audience}</p>
                <p><span className="font-semibold text-white">Key message:</span> {brief.key_message}</p>
                <p><span className="font-semibold text-white">Opening hook:</span> {brief.opening_hook}</p>
                <p><span className="font-semibold text-white">Format:</span> {brief.format}</p>
                <p><span className="font-semibold text-white">CTA:</span> {brief.cta}</p>
                <div>
                  <p className="font-semibold text-white">Shot list:</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-300">
                    {(brief.shot_list || []).map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Generate a creative brief from your test planner matrix.
              </p>
            )}

            {match ? (
              <div className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] p-3">
                <p className="text-sm font-semibold text-white">
                  Match score: {match.score}/100 ({match.grade})
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-200">
                  {(match.recommendations || []).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {saveMessage ? <p className="mt-3 text-xs text-emerald-300">{saveMessage}</p> : null}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

export default DecisionEngine;
