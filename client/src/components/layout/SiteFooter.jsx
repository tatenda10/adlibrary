import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_48%),#050505] py-14">
      <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ViralAdLibrary logo" className="h-14 w-14 rounded-full object-cover" />
              <h2 className="text-2xl font-semibold text-white">ViralAdLibrary</h2>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              Ad research, AI scoring, and exportable reporting for modern growth teams that need better creative
              decisions faster.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="/#pricing"
                className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20"
              >
                Start a plan
              </a>
              <Link
                to="/blog"
                className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]"
              >
                Read the blog
              </Link>
              <a
                href="mailto:support@viraladlbrary.site"
                className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]"
              >
                Contact support
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <a href="/#library" className="block hover:text-white">
                Ad Library
              </a>
              <a href="/#features" className="block hover:text-white">
                Features
              </a>
              <a href="/#pricing" className="block hover:text-white">
                Pricing
              </a>
              <Link to="/blog" className="block hover:text-white">
                Blog
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflows</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <Link to="/tiktok/trending" className="block hover:text-white">
                TikTok Trending
              </Link>
              <Link to="/website/cro-audit" className="block hover:text-white">
                Website CRO Audit
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Company</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <a href="mailto:sales@viraladlbrary.site" className="block hover:text-white">
                sales@viraladlbrary.site
              </a>
              <a href="mailto:support@viraladlbrary.site" className="block hover:text-white">
                support@viraladlbrary.site
              </a>
              <a href="tel:+263771472707" className="block hover:text-white">
                Calls/WhatsApp: +263771472707
              </a>
              <p className="pt-2 text-xs text-slate-500">Built for marketers, agencies, and performance teams.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} ViralAdLibrary. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="hover:text-slate-300">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-300">
              Terms
            </a>
            <a href="#" className="hover:text-slate-300">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
