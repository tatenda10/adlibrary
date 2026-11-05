import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import DashboardLayout from './components/DashboardLayout.jsx';
import CroAudit from './pages/CroAudit.jsx';
import Bookmarks from './pages/Bookmarks.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import TikTokTrending from './pages/TikTokTrending.jsx';
import TikTokHotTakes from './pages/TikTokHotTakes.jsx';
// import TikTokSaved from './pages/TikTokSaved.jsx';
import TikTokWorkspace from './pages/TikTokWorkspace.jsx';
import TikTokWorkspaceFolder from './pages/TikTokWorkspaceFolder.jsx';
// import TikTokForYou from './pages/TikTokForYou.jsx';
import TikTokAnalysisPage from './pages/TikTokAnalysisPage.jsx';
import TikTokTrendingMusic from './pages/TikTokTrendingMusic.jsx';
// import TikTokCreators from './pages/TikTokCreators.jsx';
// import TikTokTrendingHashtags from './pages/TikTokTrendingHashtags.jsx';
// import TikTokPredictor from './pages/TikTokPredictor.jsx';
// import TikTokHooks from './pages/TikTokHooks.jsx';
// import TikTokCollectionsIndex from './pages/TikTokCollectionsIndex.jsx';
// import TikTokCollectionPage from './pages/TikTokCollectionPage.jsx';
import FacebookAds from './pages/FacebookAds.jsx';
import FacebookWorkspace from './pages/FacebookWorkspace.jsx';
import FacebookWorkspaceFolder from './pages/FacebookWorkspaceFolder.jsx';
import GoogleAds from './pages/GoogleAds.jsx';
import InstagramAds from './pages/InstagramAds.jsx';
import InstagramWorkspace from './pages/InstagramWorkspace.jsx';
import InstagramWorkspaceFolder from './pages/InstagramWorkspaceFolder.jsx';
import InstagramTrending from './pages/InstagramTrending.jsx';
import Articles from './pages/Articles.jsx';
import Notes from './pages/Notes.jsx';
import RedditAds from './pages/RedditAds.jsx';
import Billing from './pages/Billing.jsx';
import Onboarding from './pages/Onboarding.jsx';
import OnboardingUnlock from './pages/OnboardingUnlock.jsx';
import OnboardingBilling from './pages/OnboardingBilling.jsx';
import SubscriptionExpired from './pages/SubscriptionExpired.jsx';
import Tutorial from './pages/Tutorial.jsx';
import DecisionEngine from './pages/DecisionEngine.jsx';
import CompetitorRadar from './pages/CompetitorRadar.jsx';
import CompetitorFunnelSpy from './pages/CompetitorFunnelSpy.jsx';
import CompetitorAngleMap from './pages/CompetitorAngleMap.jsx';
import Blog from './pages/Blog.jsx';
import SavedPlans from './pages/SavedPlans.jsx';
import ContentLibrary from './pages/ContentLibrary.jsx';
import Home from './pages/Home.jsx';
import Content from './pages/Content.jsx';
import CreateContent from './pages/CreateContent.jsx';
import ReferEarn from './pages/ReferEarn.jsx';
import Brand from './pages/Brand.jsx';
import Influencers from './pages/Influencers.jsx';
import MonthlySocialMediaPlanner from './components/decision-engine/MonthlySocialMediaPlanner.jsx';
import { getOnboardingStatus, setAuthExpiredHandler } from './lib/api.js';
import { useBilling } from './components/billing/BillingContext.jsx';
import { RequirePaidAccess, RequireFeature } from './components/billing/BillingRouteGuards.jsx';
import { FEATURES } from './lib/entitlements.js';
import { CubeLoaderOverlay } from './components/CubeLoader.jsx';
import { trackPageView } from './lib/firebaseAnalytics.js';
import AnalyticsBridge from './components/AnalyticsBridge.jsx';
import MetaPixelBridge from './components/MetaPixelBridge.jsx';

function AuthExpiredListener() {
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthExpiredHandler(async () => {
      const freshToken = await getToken({ skipCache: true });
      if (freshToken) return;
      await signOut({ redirectUrl: '/' });
    });
    return () => setAuthExpiredHandler(null);
  }, [getToken, signOut]);

  return null;
}

function AppLoadingScreen() {
  return <CubeLoaderOverlay minHeight="100vh" className="min-h-screen bg-[#080808]" />;
}

function clearPendingOnboardingFlow() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('pending_app_flow');
    localStorage.removeItem('pending_website_url');
  } catch {
    // Ignore storage cleanup issues.
  }
}

function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AppLoadingScreen />;
  }

  return isSignedIn ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

function PublicOnly() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AppLoadingScreen />;
  }

  if (isSignedIn) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Landing />;
}

function RequireOnboarding() {
  const location = useLocation();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { loading: billingLoading, subscription } = useBilling();
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [statusPaidAccess, setStatusPaidAccess] = useState(false);
  const [statusCompleted, setStatusCompleted] = useState(false);
  const hasPaidAccess =
    Boolean(subscription?.is_active || subscription?.is_paid) ||
    ['starter', 'pro', 'agency'].includes(String(subscription?.plan_key || subscription?.current_plan || '').toLowerCase()) ||
    Boolean(subscription?.dodo_subscription_id || subscription?.dodo_customer_id);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (!isLoaded || !isSignedIn) return;
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setNeedsOnboarding(true);
            setChecking(false);
          }
          return;
        }
        const status = await getOnboardingStatus(token);
        if (!cancelled) {
          const statusHasPaidAccess = Boolean(status?.hasPaidAccess || status?.paid || status?.subscription?.is_active);
          const completed = Boolean(status?.completed);
          setStatusPaidAccess(statusHasPaidAccess);
          setStatusCompleted(completed);
          setNeedsOnboarding(!completed && !statusHasPaidAccess);
          if (completed) {
            clearPendingOnboardingFlow();
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          // Do not trap returning users in onboarding because of a transient status failure.
          setNeedsOnboarding(false);
          setChecking(false);
        }
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  if (!isLoaded || checking || (billingLoading && !statusPaidAccess)) {
    return <AppLoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  const canSkipOnboarding = hasPaidAccess || statusPaidAccess || statusCompleted;

  if (canSkipOnboarding && location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/app" replace />;
  }

  const inOnboardingRoute = location.pathname.startsWith('/onboarding');
  if (needsOnboarding && !canSkipOnboarding && !inOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

function RequireBillingSetup() {
  return <Outlet />;
}

function App() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname, {
      route: location.pathname,
      query: location.search || '',
    });
  }, [location.pathname, location.search]);

  return (
    <>
      <AuthExpiredListener />
      <AnalyticsBridge />
      <MetaPixelBridge />
      <Routes>
      <Route path="/" element={<PublicOnly />} />
      <Route path="/sign-in/*" element={<AuthPage mode="sign-in" />} />
      <Route path="/sign-up/*" element={<AuthPage mode="sign-up" />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<Blog />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireOnboarding />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/onboarding/unlock" element={<OnboardingUnlock />} />
          <Route path="/onboarding/billing" element={<OnboardingBilling />} />
          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
          <Route element={<RequireBillingSetup />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app" element={<RequirePaidAccess><Home /></RequirePaidAccess>} />
              <Route path="/app/cro-audit" element={<Navigate to="/website/cro-audit" replace />} />
              <Route path="/website" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/website/cro-audit" element={<RequireFeature feature={FEATURES.WEBSITE_RESEARCH}><CroAudit /></RequireFeature>} />
              <Route path="/website/funnel-spy" element={<RequireFeature feature={FEATURES.WEBSITE_RESEARCH}><CompetitorFunnelSpy /></RequireFeature>} />
              <Route path="/website/angle-map" element={<RequireFeature feature={FEATURES.WEBSITE_RESEARCH}><CompetitorAngleMap /></RequireFeature>} />
              <Route path="/website/saved" element={<RequireFeature feature={FEATURES.WEBSITE_RESEARCH}><CroAudit /></RequireFeature>} />
              <Route path="/facebook" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/content-library" element={<Navigate to="/facebook/ad-examples" replace />} />
              <Route path="/facebook/ad-examples" element={<RequirePaidAccess><ContentLibrary /></RequirePaidAccess>} />
              <Route path="/facebook/ads" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} />
              <Route path="/facebook/trending-music" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/facebook/hook-generator" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} />
              <Route path="/facebook/workspace" element={<RequirePaidAccess><FacebookWorkspace /></RequirePaidAccess>} />
              <Route
                path="/facebook/workspace/:folderId"
                element={<RequirePaidAccess><FacebookWorkspaceFolder /></RequirePaidAccess>}
              />
              {/* <Route path="/facebook/groups" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} /> */}
              {/* <Route path="/facebook/followers" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} /> */}
              <Route path="/instagram" element={<Navigate to="/instagram/posts" replace />} />
              <Route path="/instagram/posts" element={<RequirePaidAccess><InstagramAds /></RequirePaidAccess>} />
              <Route path="/instagram/reels" element={<RequirePaidAccess><InstagramAds /></RequirePaidAccess>} />
              <Route path="/instagram/trending" element={<RequirePaidAccess><InstagramTrending /></RequirePaidAccess>} />
              <Route path="/instagram/analysis/:key" element={<TikTokAnalysisPage />} />
              <Route path="/instagram/workspace" element={<RequirePaidAccess><InstagramWorkspace /></RequirePaidAccess>} />
              <Route
                path="/instagram/workspace/:folderId"
                element={<RequirePaidAccess><InstagramWorkspaceFolder /></RequirePaidAccess>}
              />
              <Route path="/linkedin" element={<Navigate to="/articles" replace />} />
              <Route path="/articles" element={<RequirePaidAccess><Articles /></RequirePaidAccess>} />
              <Route path="/articles/:slug" element={<RequirePaidAccess><Articles /></RequirePaidAccess>} />
              <Route path="/google-ads" element={<RequirePaidAccess><GoogleAds /></RequirePaidAccess>} />
              <Route path="/reddit" element={<RequirePaidAccess><RedditAds /></RequirePaidAccess>} />
              <Route path="/tiktok/trending" element={<RequirePaidAccess><TikTokTrending /></RequirePaidAccess>} />
              <Route path="/tiktok/hot-takes" element={<RequirePaidAccess><TikTokHotTakes /></RequirePaidAccess>} />
              {/* <Route path="/tiktok/creators" element={<RequirePaidAccess><TikTokCreators /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/trending-hashtags" element={<RequirePaidAccess><TikTokTrendingHashtags /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/knowledge-hub" element={<Navigate to="/tiktok/hooks" replace />} /> */}
              {/* <Route path="/tiktok/hooks" element={<RequireFeature feature={FEATURES.TIKTOK_HOOKS}><TikTokHooks /></RequireFeature>} /> */}
              <Route path="/tiktok/workspace" element={<RequirePaidAccess><TikTokWorkspace /></RequirePaidAccess>} />
              <Route
                path="/tiktok/workspace/:folderId"
                element={<RequirePaidAccess><TikTokWorkspaceFolder /></RequirePaidAccess>}
              />
              {/* <Route path="/tiktok/saved" element={<RequirePaidAccess><TikTokSaved /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/for-you" element={<RequireFeature feature={FEATURES.TIKTOK_HOOKS}><TikTokForYou /></RequireFeature>} /> */}
              <Route path="/tiktok/trending-music" element={<RequirePaidAccess><TikTokTrendingMusic /></RequirePaidAccess>} />
              {/* <Route path="/tiktok/predictor" element={<RequireFeature feature={FEATURES.TIKTOK_PREDICTOR}><TikTokPredictor /></RequireFeature>} /> */}
              {/* <Route path="/tiktok/collections" element={<RequirePaidAccess><TikTokCollectionsIndex /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/collections/:id" element={<RequirePaidAccess><TikTokCollectionPage /></RequirePaidAccess>} /> */}
              <Route path="/tiktok/analysis/:key" element={<TikTokAnalysisPage />} />
              <Route path="/bookmarks" element={<RequirePaidAccess><Bookmarks /></RequirePaidAccess>} />
              <Route path="/notes" element={<RequirePaidAccess><Notes /></RequirePaidAccess>} />
              <Route path="/app/decision-engine" element={<RequirePaidAccess><DecisionEngine /></RequirePaidAccess>} />
              <Route path="/app/competitor-analysis" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/competitor-analysis/results" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/competitor-analysis/competitors/:competitorId" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/competitor-radar" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/competitor-radar/results" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/competitor-radar/competitors/:competitorId" element={<RequireFeature feature={FEATURES.COMPETITOR_RADAR}><CompetitorRadar /></RequireFeature>} />
              <Route path="/app/monthly-social-media-plan" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/monthly-social-media-plan/:month" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/monthly-social-media-plan/:month/:date" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/content" element={<RequirePaidAccess><Content /></RequirePaidAccess>} />
              <Route path="/app/create-content" element={<RequirePaidAccess><Content /></RequirePaidAccess>} />
              <Route path="/app/ai-studio" element={<RequirePaidAccess><CreateContent /></RequirePaidAccess>} />
              <Route path="/app/influencers" element={<RequirePaidAccess><Influencers /></RequirePaidAccess>} />
              <Route path="/app/saved-plans" element={<RequirePaidAccess><SavedPlans /></RequirePaidAccess>} />
              <Route path="/tutorial" element={<Tutorial />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/refer-and-earn" element={<RequirePaidAccess><ReferEarn /></RequirePaidAccess>} />
              <Route path="/brand" element={<RequirePaidAccess><Brand /></RequirePaidAccess>} />
              <Route path="/settings/*" element={<Navigate to="/brand" replace />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
