import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { API_URL, generateContentVideo } from '../lib/api.js';

const DURATIONS = [5, 10, 15, 30];

function resolveVideoUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_URL}${value}`;
}

function CreateContent() {
  const { getToken } = useAuth();
  const { credits, refreshBilling } = useBilling();
  const creditBalance = Number(credits?.balance ?? 0);
  const [activeType, setActiveType] = useState('videos');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const creditCost = duration * 6;

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Describe the video you want to generate first.');
      return;
    }
    setIsGenerating(true);
    setError('');
    try {
      const token = await getToken();
      const result = await generateContentVideo(token, {
        prompt: trimmed,
        duration,
        aspectRatio,
        generateAudio: false,
        format: 'Short-form UGC ad',
      });
      setGeneratedVideo(result.video || null);
      await refreshBilling?.();
    } catch (err) {
      setError(err.message || 'Failed to generate video.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="relative flex min-h-full flex-col overflow-hidden bg-white text-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex rounded-md bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveType('images')}
              className={`rounded-sm px-6 py-2.5 text-sm font-semibold ${
                activeType === 'images' ? 'bg-[#052e16] text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => setActiveType('videos')}
              className={`rounded-sm px-6 py-2.5 text-sm font-semibold ${
                activeType === 'videos' ? 'bg-[#052e16] text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Videos
            </button>
          </div>
          <button
            type="button"
            aria-label="Help"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <HelpIcon />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
            <CreditsIcon />
            {creditBalance} credits
          </span>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Buy more
          </button>
        </div>
      </div>

      <div className="grid flex-1 place-items-center bg-[#f8faf9] px-5 pb-48 pt-12">
        {generatedVideo?.url ? (
          <div className="w-full max-w-sm overflow-hidden rounded-md border border-slate-200 bg-white">
            <video src={resolveVideoUrl(generatedVideo.url)} controls className="aspect-[9/16] w-full bg-black object-contain" />
            <div className="p-4">
              <p className="text-sm font-semibold text-slate-950">{generatedVideo.duration}s video generated</p>
              <p className="mt-1 text-xs text-slate-500">{generatedVideo.model}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center text-emerald-600">
              <ImageAddIcon />
            </div>
            <p className="text-sm text-slate-500">
              {isGenerating ? 'Generating your video with fal.ai...' : 'No generations yet. Start generating with a prompt below.'}
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-6">
        <div className="mx-auto max-w-5xl">
          <div className="pointer-events-auto relative rounded-md border border-slate-200 bg-white p-5">
            <button
              type="button"
              aria-label="Collapse prompt"
              className="absolute left-1/2 top-0 grid h-8 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-slate-200 bg-white text-slate-500"
            >
              <ChevronDownIcon />
            </button>

            <div className="flex gap-4">
              <button
                type="button"
                className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700"
                aria-label="Upload reference"
              >
                <div className="space-y-2">
                  <UploadIcon />
                  <FolderIcon />
                </div>
              </button>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[82px] flex-1 resize-none border-0 bg-transparent pt-3 text-base text-slate-900 outline-none placeholder:text-slate-500"
                placeholder="e.g. UGC product demo for a skincare serum, creator holds bottle, bright bathroom lighting"
              />
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              {error ? (
                <div className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ControlButton label="Higgsfield Kling 3.0 Pro" />
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 outline-none hover:border-emerald-200"
                  >
                    <option value="9:16">9:16</option>
                    <option value="16:9">16:9</option>
                    <option value="1:1">1:1</option>
                  </select>
                  <div className="inline-flex rounded-md bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                    <button type="button" className="rounded-sm px-3 py-1.5">720p 0.5×</button>
                    <button type="button" className="rounded-sm bg-white px-3 py-1.5 text-slate-900">1080p</button>
                  </div>
                  <div className="inline-flex rounded-md bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                    {DURATIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDuration(value)}
                        className={`rounded-sm px-3 py-1.5 ${duration === value ? 'bg-white text-slate-900' : ''}`}
                      >
                        {value}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <ControlButton label="Template" icon={<WandIcon />} />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-md bg-[#052e16] px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <SendIcon />
                    {isGenerating ? 'Generating...' : `Generate (${creditCost} credits - ${duration}s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlButton({ label, icon }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:border-emerald-200 hover:text-emerald-700"
    >
      {icon}
      {label}
      <ChevronDownIcon />
    </button>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 0 1 4.6 1c0 1.7-2.3 1.9-2.3 3.5" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function CreditsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="4" />
      <path d="M12 14a4 4 0 1 0 4-4" />
      <path d="M8 6v4M6 8h4" strokeLinecap="round" />
    </svg>
  );
}

function ImageAddIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="14" height="16" rx="2" />
      <path d="m6 16 3-3 2 2 2-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 3v6M16 6h6" strokeLinecap="round" />
      <circle cx="8" cy="10" r="1.4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 20 10-10" strokeLinecap="round" />
      <path d="m13 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
      <path d="M18 3v3M16.5 4.5h3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 12 16-8-7 16-2-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default CreateContent;

