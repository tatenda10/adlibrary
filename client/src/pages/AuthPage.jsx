import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const AUTH_FEATURES = [
  {
    title: 'Generate Trending Content',
    description: 'Create slideshows, hooks, demos, and green screen videos.',
    icon: (
      <path d="M6 8.5h12M8 5.5l1.4 3M14 5.5l1.4 3M5.5 8.5h13v10h-13z" />
    ),
  },
  {
    title: '25k+ Trending Videos',
    description: 'Remix proven viral videos directly with your business context.',
    icon: (
      <>
        <path d="M7 5h10v14H7z" />
        <path d="M10 5v14M14 5v14M7 9h10M7 15h10" />
      </>
    ),
  },
  {
    title: 'Most Realistic UGC Avatars',
    description: 'Lifelike AI avatars that deliver your message like a real creator would.',
    icon: (
      <>
        <circle cx="12" cy="9" r="3" />
        <path d="M6.5 19c.7-3.1 2.9-5 5.5-5s4.8 1.9 5.5 5" />
      </>
    ),
  },
  {
    title: 'Multi-Platform Posting',
    description: 'Publish directly to TikTok, Instagram, and YouTube from one place.',
    icon: (
      <>
        <circle cx="7" cy="12" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="m8.8 11 6.4-3M8.8 13l6.4 3" />
      </>
    ),
  },
  {
    title: 'Track Performance',
    description: 'Monitor your views and engagement across every channel.',
    icon: (
      <>
        <path d="M6 19V8M12 19V5M18 19v-7" />
        <path d="M4 19h16" />
      </>
    ),
  },
];

// Same dark palette as before — only the shapes/layout changed to match the reference.
const clerkAppearance = {
  variables: {
    colorPrimary: '#34d399',
    colorBackground: '#030303',
    colorInputBackground: 'rgba(255,255,255,0.06)',
    colorInputText: '#f8fafc',
    colorText: '#f8fafc',
    colorTextSecondary: '#94a3b8',
    borderRadius: '1rem',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full border-0 bg-transparent p-0 shadow-none',
    header: 'flex flex-col items-center mb-1',
    headerTitle: 'text-center text-2xl font-black tracking-[-0.03em] text-white',
    headerSubtitle: 'mt-1 text-center text-sm text-slate-400',
    socialButtonsBlockButton:
      '!flex !h-12 !w-full !items-center !justify-center !gap-3 !rounded-xl !border !border-white/15 !bg-white !text-base !font-semibold !text-slate-950 !shadow-none hover:!bg-slate-100',
    socialButtonsBlockButtonText: '!text-slate-950 !opacity-100',
    dividerRow: 'my-4',
    dividerLine: 'bg-white/10',
    dividerText: 'px-4 text-xs text-slate-400',
    formFieldLabel: 'mb-1.5 text-sm font-semibold text-white',
    formFieldInput:
      'h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-sm text-white shadow-none placeholder:text-slate-400 focus:border-emerald-400/70 focus:bg-white/[0.08] focus:ring-0',
    formFieldInputShowPasswordButton: 'text-slate-400 hover:text-white',
    formButtonPrimary:
      "flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#111111] text-sm font-bold text-white shadow-[0_4px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 transition hover:bg-[#181818] after:content-['→']",
    formFieldAction: 'text-xs text-slate-400 hover:text-white',
    identityPreviewEditButton: 'text-emerald-300',
    otpCodeFieldInput: 'rounded-xl border-white/10 bg-white/[0.06] text-white',
    alert: 'rounded-xl bg-white/[0.06] text-sm text-white',
    form: 'space-y-3.5',
    formFieldRow: 'gap-3',
    footer: 'mt-6 flex items-center justify-center gap-1.5 bg-transparent',
    footerAction: 'flex items-center gap-1.5',
    footerActionText: 'text-sm text-slate-400',
    footerActionLink: 'text-sm font-bold text-white transition hover:text-emerald-300',
    footerPages: 'hidden',
    footerPageLink: 'hidden',
  },
};

function AuthPage({ mode = 'sign-up' }) {
  const { isLoaded, isSignedIn } = useAuth();
  const isSignIn = mode === 'sign-in';

  if (isLoaded && isSignedIn) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <main className="min-h-screen overflow-y-auto border-t-4 border-emerald-400 bg-[#030303] text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden min-h-screen items-start justify-center overflow-hidden border-r border-white/10 px-8 py-10 pt-[100px] lg:flex xl:px-16">
          <div className="absolute inset-0 bg-[#030303]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(52,211,153,0.16),transparent)]" />
          <div className="relative mx-auto w-full max-w-[520px]">
            <h1 className="max-w-[430px] text-4xl font-black leading-[1.12] tracking-[-0.05em] text-white xl:text-[44px]">
              10x your organic marketing with AI
            </h1>

            <div className="mt-8 grid max-w-[430px] gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
              <Metric value="150M+" label="organic views generated on platform" />
              <div className="hidden h-10 w-px bg-white/10 sm:block" />
              <Metric value="50k+" label="businesses in the fast lane" icon={<EyeIcon />} />
            </div>

            <div className="mt-8 space-y-4">
              {AUTH_FEATURES.map((feature) => (
                <FeatureRow key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-start justify-center overflow-hidden bg-[#030303] px-5 py-10 sm:px-8 lg:px-16 lg:pt-[36px]">
          <div className="relative mx-auto w-full max-w-[560px] px-6 py-8 sm:px-8 sm:py-10">
            {isSignIn ? (
              <SignIn
                path="/sign-in"
                routing="path"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/onboarding"
                appearance={clerkAppearance}
              />
            ) : (
              <SignUp
                path="/sign-up"
                routing="path"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/onboarding"
                appearance={clerkAppearance}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ value, label, icon = null }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-2xl font-black tracking-[-0.03em] text-white">
        {icon}
        {value}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{label}</p>
    </div>
  );
}

function FeatureRow({ feature }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          {feature.icon}
        </svg>
      </div>
      <div>
        <h3 className="text-base font-black text-white">{feature.title}</h3>
        <p className="mt-0.5 text-sm leading-6 text-slate-400">{feature.description}</p>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export default AuthPage;
