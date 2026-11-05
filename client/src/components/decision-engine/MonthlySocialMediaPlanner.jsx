import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useParams } from 'react-router-dom';
import DayPlanView from './DayPlanView.jsx';
import MonthFolderGrid from './MonthFolderGrid.jsx';
import MonthlyCalendarView from './MonthlyCalendarView.jsx';
import {
  createSavedPlan,
  generateMonthlySocialCalendar,
  getBrandProfile,
  getSavedPlans,
  updateSavedPlan,
} from '../../lib/api.js';
import {
  SOCIAL_CONTENT_SKILL_URL,
  getNextMonthKey,
  monthLabel,
  normalizeMonthlyPlans,
  sortMonths,
} from './plannerUtils.js';
import { useApiToast } from '../../hooks/useApiToast.js';

const PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'Facebook'];

function MonthlySocialMediaPlanner() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const navigate = useNavigate();
  const { month: monthParam = '', date: dateParam = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [brandProfile, setBrandProfile] = useState(null);
  const [working, setWorking] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [dayModal, setDayModal] = useState(null);
  const [createForm, setCreateForm] = useState({
    month: '',
    brandName: '',
    audience: '',
    goals: '',
    platforms: ['TikTok', 'Instagram', 'Facebook'],
    offer: '',
    tone: '',
    contentPillars: '',
    weeklyHours: '',
    existingAssets: '',
  });
  const selectedMonth = monthParam;
  const selectedDate = dateParam;

  useEffect(() => {
    let cancelled = false;

    async function loadMonthlyPlans() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) throw new Error('Session token unavailable');

        const [plansData, profileResult] = await Promise.all([
          getSavedPlans(token),
          getBrandProfile(token).catch(() => null),
        ]);

        if (cancelled) return;

        const monthlyPlans = sortMonths(normalizeMonthlyPlans(plansData?.plans || []));
        setBrandProfile(profileResult);
        setMonths(monthlyPlans);
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load monthly planner.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMonthlyPlans();
    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

  const activeMonth = useMemo(
    () => months.find((item) => item.key === selectedMonth) || null,
    [months, selectedMonth]
  );

  const selectedDay = useMemo(
    () => activeMonth?.calendar?.find((item) => item.date === selectedDate) || null,
    [activeMonth, selectedDate]
  );

  const handleAddMonth = () => {
    if (working) return;
    const nextMonth = getNextMonthKey(months);
    setCreateForm((prev) => ({
      ...prev,
      month: nextMonth,
      brandName: prev.brandName || brandProfile?.brand_name || '',
      audience: prev.audience || brandProfile?.target_audience || '',
      goals: prev.goals || normalizeListInput(brandProfile?.goals),
      platforms: prev.platforms?.length ? prev.platforms : normalizePlatformInput(brandProfile?.channels),
      offer: prev.offer || normalizeListInput(brandProfile?.value_props),
      tone: prev.tone || brandProfile?.tone?.summary || brandProfile?.tone?.style || '',
      contentPillars: prev.contentPillars || normalizeListInput(brandProfile?.content_pillars),
    }));
    setCreateModalOpen(true);
  };

  const handleSelectMonth = (monthKey) => {
    navigate(`/app/monthly-social-media-plan/${monthKey}`);
  };

  const handleSelectDay = (date) => {
    const day = activeMonth?.calendar?.find((item) => item.date === date);
    if (day) setDayModal(day);
  };

  const handleCreateFormChange = (key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlatformToggle = (platform) => {
    setCreateForm((prev) => {
      const selected = new Set(prev.platforms || []);
      if (selected.has(platform)) selected.delete(platform);
      else selected.add(platform);
      return { ...prev, platforms: Array.from(selected) };
    });
  };

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    if (working) return;
    const nextMonth = createForm.month || getNextMonthKey(months);

    try {
      setWorking('create-plan');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');

      const data = await generateMonthlySocialCalendar(token, {
        month: nextMonth,
        source: 'questionnaire',
        questionnaire: {
          ...createForm,
          platforms: (createForm.platforms || []).join(', '),
        },
      });

      const payload = {
        title: `${monthLabel(nextMonth)} social media calendar`,
        plan_type: 'monthly_social_calendar',
        matrix: data?.calendar || [],
        brief: null,
        meta: {
          month: nextMonth,
          source: data?.source || 'questionnaire',
          source_label: data?.source_label || 'Questionnaire',
          summary: data?.summary || '',
          pillars: data?.pillars || [],
          skill: data?.skill || {
            name: 'social-content',
            source_url: SOCIAL_CONTENT_SKILL_URL,
            fetched: false,
          },
          generation_mode: data?.generation_mode || '',
          platforms: createForm.platforms || [],
        },
      };

      const saved = await createSavedPlan(token, payload);
      const planId = saved?.id || null;

      setMonths((prev) => sortMonths([
        ...prev.filter((item) => item.key !== nextMonth),
        {
          key: nextMonth,
          label: monthLabel(nextMonth),
          planId,
          calendar: payload.matrix,
          meta: payload.meta,
        },
      ]));
      setCreateModalOpen(false);
      navigate(`/app/monthly-social-media-plan/${nextMonth}`);
    } catch (err) {
      notifyApiError(err, 'Failed to create content calendar.');
    } finally {
      setWorking('');
    }
  };

  const handleRecalculateMonth = async () => {
    if (!activeMonth || working) return;

    try {
      setWorking('recalculate');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');

      const data = await generateMonthlySocialCalendar(token, {
        month: activeMonth.key,
        source: 'brand_profile',
      });

      const payload = {
        title: `${monthLabel(activeMonth.key)} social media calendar`,
        plan_type: 'monthly_social_calendar',
        matrix: data?.calendar || [],
        brief: null,
        meta: {
          ...activeMonth.meta,
          month: activeMonth.key,
          source: data?.source || 'brand_profile',
          source_label: data?.source_label || 'Saved brand profile',
          summary: data?.summary || '',
          pillars: data?.pillars || [],
          skill: data?.skill || activeMonth.meta?.skill || null,
          generation_mode: data?.generation_mode || '',
        },
      };

      let planId = activeMonth.planId;
      if (planId) {
        await updateSavedPlan(token, planId, payload);
      } else {
        const saved = await createSavedPlan(token, payload);
        planId = saved?.id || null;
      }

      setMonths((prev) => sortMonths(prev.map((item) => (
        item.key === activeMonth.key
          ? { ...item, planId, calendar: payload.matrix, meta: payload.meta }
          : item
      ))));
    } catch (err) {
      notifyApiError(err, 'Failed to recalculate calendar.');
    } finally {
      setWorking('');
    }
  };

  if (loading) {
    return (
      <MonthFolderGrid
        months={months}
        selectedMonth={selectedMonth}
        loading
        creating={working === 'create-plan'}
        onAddMonth={handleAddMonth}
        onSelectMonth={handleSelectMonth}
      />
    );
  }

  if (dateParam && selectedDay && activeMonth) {
    return (
      <DayPlanView
        day={selectedDay}
        monthLabel={activeMonth.label}
        onBack={() => navigate(`/app/monthly-social-media-plan/${activeMonth.key}`)}
      />
    );
  }

  if (dateParam && !selectedDay && activeMonth) {
    return (
      <div className="space-y-4">
        <BackLink onClick={() => navigate(`/app/monthly-social-media-plan/${activeMonth.key}`)} label="Back to calendar" />
        <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-300">
          No plan is saved for {dateParam}. Generate the month first, then open a planned date.
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      {!selectedMonth ? (
        <MonthFolderGrid
          months={months}
          selectedMonth={selectedMonth}
          loading={false}
          creating={working === 'create-plan'}
          onAddMonth={handleAddMonth}
          onSelectMonth={handleSelectMonth}
        />
      ) : activeMonth ? (
        <>
          <BackLink onClick={() => navigate('/app/monthly-social-media-plan')} label="All folders" />
          <div className="space-y-4">
            <MonthlyCalendarView
              month={activeMonth}
              highlightedDate={selectedDate}
              recalculating={working === 'recalculate'}
              onRecalculate={handleRecalculateMonth}
              onSelectDay={handleSelectDay}
            />
          </div>
        </>
      ) : (
        <>
          <BackLink onClick={() => navigate('/app/monthly-social-media-plan')} label="All folders" />
          <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-300">
            Month folder not found.
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {content}
      {createModalOpen ? (
        <CreatePlanModal
          values={createForm}
          working={working === 'create-plan'}
          onChange={handleCreateFormChange}
          onPlatformToggle={handlePlatformToggle}
          onClose={() => (working ? null : setCreateModalOpen(false))}
          onSubmit={handleCreatePlan}
        />
      ) : null}
      {dayModal ? (
        <DayPlanModal
          day={dayModal}
          monthLabel={activeMonth?.label || ''}
          onClose={() => setDayModal(null)}
        />
      ) : null}
    </>
  );
}

function BackLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
    >
      {label}
    </button>
  );
}

function CreatePlanModal({ values, working, onChange, onPlatformToggle, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Create content calendar</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose the month and platforms you want to plan for.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-500 text-2xl font-black leading-none text-white hover:bg-red-600 disabled:opacity-60"
          >
            ×
          </button>
        </div>

        <div className="mt-6">
          <Field label="Month">
            <input
              type="month"
              value={values.month}
              onChange={(event) => onChange('month', event.target.value)}
              className="w-full rounded-sm border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              required
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">Target platforms</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {PLATFORM_OPTIONS.map((platform) => {
              const selected = values.platforms?.includes(platform);
              const Icon = getPlatformIcon(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => onPlatformToggle(platform)}
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm font-semibold ${
                    selected
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {platform}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={working || !values.platforms?.length}
            className="rounded-sm bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {working ? 'Creating calendar...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DayPlanModal({ day, monthLabel, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">{monthLabel}</p>
            <h2 className="mt-1 text-xl font-bold">{day.date}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {day.weekday} • {day.platform} • {day.format}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Topic</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{day.topic || 'Not set'}</p>
          <p className="mt-2 text-sm text-slate-600">{day.pillar || 'No pillar set'}</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailBlock label="Task" value={day.task} wide />
          <DetailBlock label="Hook" value={day.hook} />
          <DetailBlock label="Caption prompt" value={day.caption_prompt} />
          <DetailBlock label="CTA" value={day.cta} />
          <DetailBlock label="Status" value={day.status} />
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, value, wide = false }) {
  return (
    <div className={`rounded-sm border border-slate-200 bg-white p-3 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{value || 'Not set'}</p>
    </div>
  );
}

function getPlatformIcon(platform) {
  if (platform === 'TikTok') return TikTokIcon;
  if (platform === 'Instagram') return InstagramIcon;
  return FacebookIcon;
}

function TikTokIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M14 4v10.6a4.4 4.4 0 1 1-4.4-4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4c.7 3.2 2.5 5 5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InstagramIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.3" />
      <path d="M17.5 6.8h.01" strokeLinecap="round" />
    </svg>
  );
}

function FacebookIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14 8.2V7c0-.8.3-1.2 1.3-1.2H17V3h-2.5C11.9 3 11 4.5 11 6.7v1.5H9v3h2V21h3v-9.8h2.5l.4-3H14Z" />
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function normalizeListInput(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '');
}

function normalizePlatformInput(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return list.length ? list : ['TikTok', 'Instagram', 'Facebook'];
}

export default MonthlySocialMediaPlanner;
