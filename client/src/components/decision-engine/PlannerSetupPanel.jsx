import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import SectionCard from './SectionCard.jsx';
import { SparklesIcon } from './PlannerIcons.jsx';
import { SOCIAL_CONTENT_SKILL_URL } from './plannerUtils.js';

function PlannerSetupPanel({
  month,
  source,
  questionnaire,
  brandProfile,
  brandSummary,
  working,
  onSourceChange,
  onQuestionnaireChange,
  onGenerate,
}) {
  return (
    <SectionCard
      title={month.label}
      actions={(
        <button
          type="button"
          onClick={onGenerate}
          disabled={working === 'generate' || (source === 'brand_profile' && !brandProfile)}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
        >
          <SparklesIcon className="h-4 w-4" />
          {working === 'generate' ? 'Generating...' : 'Generate'}
        </button>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
          <button
            type="button"
            onClick={() => onSourceChange('brand_profile')}
            className={source === 'brand_profile' ? activeSegmentClass() : inactiveSegmentClass()}
          >
            Saved brand
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('questionnaire')}
            className={source === 'questionnaire' ? activeSegmentClass() : inactiveSegmentClass()}
          >
            Questionnaire
          </button>
        </div>

        {source === 'brand_profile' ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-sm font-semibold text-white">{brandProfile?.brand_name || 'No saved brand found'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {brandSummary || 'Switch to questionnaire if onboarding has not saved a brand profile yet.'}
            </p>
          </div>
        ) : (
          <QuestionnaireForm values={questionnaire} onChange={onQuestionnaireChange} />
        )}

        <SkillBadge skill={month.meta?.skill} />

        {working === 'generate' ? (
          <CubeLoaderOverlay label="Generating monthly calendar…" minHeight="14rem" />
        ) : null}
      </div>
    </SectionCard>
  );
}

function QuestionnaireForm({ values, onChange }) {
  const fields = [
    ['brandName', 'Brand name'],
    ['audience', 'Target audience'],
    ['goals', 'Monthly goal'],
    ['platforms', 'Platforms'],
    ['offer', 'Offer or value props'],
    ['tone', 'Brand voice'],
    ['contentPillars', 'Content pillars'],
    ['weeklyHours', 'Weekly time available'],
    ['existingAssets', 'Existing assets to repurpose'],
  ];

  return (
    <div className="space-y-2">
      {fields.map(([key, label]) => (
        <label key={key} className="block">
          <span className="text-xs font-medium text-slate-400">{label}</span>
          <textarea
            value={values[key]}
            onChange={(event) => onChange(key, event.target.value)}
            rows={key === 'existingAssets' || key === 'contentPillars' ? 3 : 2}
            className="mt-1 w-full resize-none rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
          />
        </label>
      ))}
    </div>
  );
}

function SkillBadge({ skill }) {
  const skillName = skill?.name || 'social-content';
  const sourceUrl = skill?.source_url || SOCIAL_CONTENT_SKILL_URL;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Marketing skill</p>
      <p className="mt-2 text-sm font-semibold text-white">{skillName}</p>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block break-words text-xs text-slate-400 hover:text-emerald-300"
      >
        coreyhaines31/marketingskills
      </a>
    </div>
  );
}

function activeSegmentClass() {
  return 'rounded-md bg-emerald-400 px-2 py-2 text-xs font-semibold text-black';
}

function inactiveSegmentClass() {
  return 'rounded-md px-2 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.04]';
}

export default PlannerSetupPanel;
