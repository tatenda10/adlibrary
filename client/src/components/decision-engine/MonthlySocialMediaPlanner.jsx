import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useParams } from 'react-router-dom';
import DayPlanView from './DayPlanView.jsx';
import MonthFolderGrid from './MonthFolderGrid.jsx';
import MonthlyCalendarView from './MonthlyCalendarView.jsx';
import PlannerSetupPanel from './PlannerSetupPanel.jsx';
import {
  createSavedPlan,
  generateMonthlySocialCalendar,
  getBrandProfile,
  getSavedPlans,
  updateSavedPlan,
} from '../../lib/api.js';
import {
  EMPTY_QUESTIONNAIRE,
  SOCIAL_CONTENT_SKILL_URL,
  getNextMonthKey,
  monthLabel,
  normalizeMonthlyPlans,
  sortMonths,
} from './plannerUtils.js';
import { useApiToast } from '../../hooks/useApiToast.js';

function MonthlySocialMediaPlanner() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const navigate = useNavigate();
  const { month: monthParam = '', date: dateParam = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [source, setSource] = useState('brand_profile');
  const [questionnaire, setQuestionnaire] = useState(EMPTY_QUESTIONNAIRE);
  const [brandProfile, setBrandProfile] = useState(null);
  const [working, setWorking] = useState('');
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

  const brandSummary = useMemo(() => {
    if (!brandProfile) return '';
    return [
      brandProfile.brand_name,
      brandProfile.industry,
      brandProfile.target_audience,
    ].filter(Boolean).join(' - ');
  }, [brandProfile]);

  const handleAddMonth = async () => {
    if (working) return;
    const nextMonth = getNextMonthKey(months);

    try {
      setWorking('add-month');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');

      const payload = {
        title: `${monthLabel(nextMonth)} social media calendar`,
        plan_type: 'monthly_social_calendar',
        matrix: [],
        brief: null,
        meta: {
          month: nextMonth,
          source: '',
          source_label: '',
          summary: '',
          pillars: [],
          skill: {
            name: 'social-content',
            source_url: SOCIAL_CONTENT_SKILL_URL,
            fetched: false,
          },
        },
      };

      const saved = await createSavedPlan(token, payload);
      setMonths((prev) => sortMonths([
        ...prev,
        {
          key: nextMonth,
          label: monthLabel(nextMonth),
          planId: saved?.id || null,
          calendar: [],
          meta: payload.meta,
        },
      ]));
      navigate(`/app/monthly-social-media-plan/${nextMonth}`);
    } catch (err) {
      notifyApiError(err, 'Failed to create month folder.');
    } finally {
      setWorking('');
    }
  };

  const handleSelectMonth = (monthKey) => {
    navigate(`/app/monthly-social-media-plan/${monthKey}`);
  };

  const handleSelectDay = (date) => {
    navigate(`/app/monthly-social-media-plan/${selectedMonth}/${date}`);
  };

  const handleQuestionnaireChange = (key, value) => {
    setQuestionnaire((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerateMonth = async () => {
    if (!selectedMonth || working) return;

    try {
      setWorking('generate');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');

      const data = await generateMonthlySocialCalendar(token, {
        month: selectedMonth,
        source,
        questionnaire: source === 'questionnaire' ? questionnaire : undefined,
      });

      const payload = {
        title: `${monthLabel(selectedMonth)} social media calendar`,
        plan_type: 'monthly_social_calendar',
        matrix: data?.calendar || [],
        brief: null,
        meta: {
          month: selectedMonth,
          source: data?.source || source,
          source_label: data?.source_label || '',
          summary: data?.summary || '',
          pillars: data?.pillars || [],
          skill: data?.skill || null,
          generation_mode: data?.generation_mode || '',
        },
      };

      let planId = activeMonth?.planId || null;
      if (planId) {
        await updateSavedPlan(token, planId, payload);
      } else {
        const saved = await createSavedPlan(token, payload);
        planId = saved?.id || null;
      }

      setMonths((prev) => sortMonths(prev.map((item) => (
        item.key === selectedMonth
          ? { ...item, planId, calendar: payload.matrix, meta: payload.meta }
          : item
      ))));
    } catch (err) {
      notifyApiError(err, 'Failed to generate monthly calendar.');
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
        creating={working === 'add-month'}
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

  return (
    <div className="space-y-4">
      {!selectedMonth ? (
        <MonthFolderGrid
          months={months}
          selectedMonth={selectedMonth}
          loading={false}
          creating={working === 'add-month'}
          onAddMonth={handleAddMonth}
          onSelectMonth={handleSelectMonth}
        />
      ) : activeMonth ? (
        <>
          <BackLink onClick={() => navigate('/app/monthly-social-media-plan')} label="All folders" />
          <div className="space-y-4">
            <PlannerSetupPanel
              month={activeMonth}
              source={source}
              questionnaire={questionnaire}
              brandProfile={brandProfile}
              brandSummary={brandSummary}
              working={working}
              onSourceChange={setSource}
              onQuestionnaireChange={handleQuestionnaireChange}
              onGenerate={handleGenerateMonth}
            />

            <MonthlyCalendarView
              month={activeMonth}
              highlightedDate={selectedDate}
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
}

function BackLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:border-white/30"
    >
      {label}
    </button>
  );
}

export default MonthlySocialMediaPlanner;
