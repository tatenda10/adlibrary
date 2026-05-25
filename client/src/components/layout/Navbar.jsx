import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import logo from '../../assets/logo.png';

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-emerald-400/20 bg-emerald-950/50 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-2 px-3 py-3 md:gap-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <img src={logo} alt="ViralAdLibrary logo" className="h-8 w-8 shrink-0 rounded-full object-cover md:h-9 md:w-9" />
          <span className="truncate text-base font-bold tracking-tight text-white md:text-xl">ViralAdLibrary</span>
        </div>

        <nav className="hidden items-center gap-7 text-base text-emerald-100/75 md:flex">
          <a href="#library" className="text-[#25d366]">Library</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#how-it-works" className="hover:text-white">How it works</a>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SignInButton mode="modal">
            <button className="inline-flex items-center gap-1 rounded-full border border-emerald-200/35 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900/35 sm:gap-2 sm:px-3 sm:text-sm">
              <LoginIcon />
              <span className="hidden sm:inline">Log in</span>
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(37,211,102,0.45)] hover:bg-emerald-300 sm:gap-2 sm:px-4 sm:text-sm">
              <CreateAccountIcon />
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create account</span>
            </button>
          </SignUpButton>
        </div>
      </div>
    </header>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.1 3.6-5 6.5-5s5.7 1.9 6.5 5" strokeLinecap="round" />
    </svg>
  );
}

function CreateAccountIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="16.5" cy="10" r="2" />
      <path d="M3.8 19c.7-2.7 3.1-4.3 5.2-4.3 2.2 0 4.5 1.6 5.2 4.3" strokeLinecap="round" />
      <path d="M15 18.7c.4-1.7 1.8-2.8 3.2-2.8 1.2 0 2.4.7 3 1.9" strokeLinecap="round" />
    </svg>
  );
}

export { Navbar };
