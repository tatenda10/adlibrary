export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EMPTY_QUESTIONNAIRE = {
  brandName: '',
  audience: '',
  goals: '',
  platforms: 'TikTok, Instagram, LinkedIn',
  offer: '',
  tone: '',
  contentPillars: '',
  weeklyHours: '',
  existingAssets: '',
};

export const SOCIAL_CONTENT_SKILL_URL = 'https://github.com/coreyhaines31/marketingskills/tree/main/skills/social-content';

export function normalizeMonthlyPlans(plans = []) {
  const byMonth = new Map();

  plans
    .filter((plan) => plan.plan_type === 'monthly_social_calendar' && plan.meta?.month)
    .forEach((plan) => {
      const month = plan.meta.month;
      const existing = byMonth.get(month);
      const currentTime = new Date(plan.updated_at || plan.created_at || 0).getTime();
      const existingTime = existing ? new Date(existing.updated_at || existing.created_at || 0).getTime() : 0;
      if (!existing || currentTime >= existingTime) {
        byMonth.set(month, {
          key: month,
          label: monthLabel(month),
          planId: plan.id,
          calendar: Array.isArray(plan.matrix) ? plan.matrix : [],
          meta: plan.meta || {},
          updated_at: plan.updated_at,
        });
      }
    });

  return Array.from(byMonth.values());
}

export function sortMonths(items = []) {
  return [...items].sort((a, b) => a.key.localeCompare(b.key));
}

export function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function getNextMonthKey(months = []) {
  const latest = months.length
    ? months.map((item) => item.key).sort().at(-1)
    : toMonthKey(new Date());
  const [year, month] = latest.split('-').map(Number);
  const next = new Date(year, month, 1);
  return toMonthKey(next);
}

export function buildCalendarCells(monthKey, calendar = []) {
  if (!monthKey) return [];
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const byDate = new Map(calendar.map((item) => [item.date, item]));
  const cells = Array.from({ length: firstDay }, () => null);

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const item = byDate.get(date);
    cells.push({
      id: date,
      date,
      day,
      hasPlan: Boolean(item),
      ...(item || {}),
    });
  }

  return cells;
}

export function isTodayDate(date) {
  const today = new Date();
  return date === `${toMonthKey(today)}-${String(today.getDate()).padStart(2, '0')}`;
}
