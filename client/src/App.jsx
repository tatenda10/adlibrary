import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import DashboardLayout from './components/DashboardLayout.jsx';
import CroAudit from './pages/CroAudit.jsx';
import Bookmarks from './pages/Bookmarks.jsx';
import Landing from './pages/Landing.jsx';
import TikTokTrending from './pages/TikTokTrending.jsx';
import TikTokHotTakes from './pages/TikTokHotTakes.jsx';
// import TikTokSaved from './pages/TikTokSaved.jsx';
import TikTokWorkspace from './pages/TikTokWorkspace.jsx';
import TikTokWorkspaceFolder from './pages/TikTokWorkspaceFolder.jsx';
// import TikTokForYou from './pages/TikTokForYou.jsx';
import TikTokAnalysisPage from './pages/TikTokAnalysisPage.jsx';
import TikTokTrendingMusic from './pages/TikTokTrendingMusic.jsx';
import TikTokCreators from './pages/TikTokCreators.jsx';
// import TikTokTrendingHashtags from './pages/TikTokTrendingHashtags.jsx';
import TikTokPredictor from './pages/TikTokPredictor.jsx';
import TikTokHooks from './pages/TikTokHooks.jsx';
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
import Settings from './pages/Settings.jsx';
import Tutorial from './pages/Tutorial.jsx';
import DecisionEngine from './pages/DecisionEngine.jsx';
import CompetitorRadar from './pages/CompetitorRadar.jsx';
import CompetitorFunnelSpy from './pages/CompetitorFunnelSpy.jsx';
import CompetitorAngleMap from './pages/CompetitorAngleMap.jsx';
import Blog from './pages/Blog.jsx';
import SavedPlans from './pages/SavedPlans.jsx';
import MonthlySocialMediaPlanner from './components/decision-engine/MonthlySocialMediaPlanner.jsx';
import { getOnboardingStatus, setAuthExpiredHandler } from './lib/api.js';
import { preloadUnlockShowcase } from './lib/unlockShowcase.js';
import { useBilling } from './components/billing/BillingContext.jsx';
import { RequirePaidAccess, RequireProAccess } from './components/billing/BillingRouteGuards.jsx';
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

  return isSignedIn ? <Outlet /> : <Navigate to="/" replace />;
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
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    preloadUnlockShowcase();
  }, [isSignedIn]);

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
          setNeedsOnboarding(!status?.completed);
          if (status?.completed) {
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

  if (!isLoaded || checking) {
    return <AppLoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  const inOnboardingRoute = location.pathname.startsWith('/onboarding');
  if (needsOnboarding && !inOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

function RequireBillingSetup() {
  const location = useLocation();
  const { loading, subscription } = useBilling();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!subscription?.is_active) {
    if (subscription?.had_subscription_before) {
      return <Navigate to="/subscription-expired" replace />;
    }
    return <Navigate to="/onboarding/billing" replace state={{ from: location.pathname }} />;
  }

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
              <Route path="/app" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/app/cro-audit" element={<Navigate to="/website/cro-audit" replace />} />
              <Route path="/website" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/website/cro-audit" element={<RequireProAccess><CroAudit /></RequireProAccess>} />
              <Route path="/website/funnel-spy" element={<RequireProAccess><CompetitorFunnelSpy /></RequireProAccess>} />
              <Route path="/website/angle-map" element={<RequireProAccess><CompetitorAngleMap /></RequireProAccess>} />
              <Route path="/website/saved" element={<RequireProAccess><CroAudit /></RequireProAccess>} />
              <Route path="/facebook" element={<Navigate to="/facebook/ads" replace />} />
              <Route path="/facebook/ads" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} />
              <Route path="/facebook/trending-music" element={<RequirePaidAccess><FacebookAds /></RequirePaidAccess>} />
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
              <Route path="/tiktok/creators" element={<RequirePaidAccess><TikTokCreators /></RequirePaidAccess>} />
              {/* <Route path="/tiktok/trending-hashtags" element={<RequirePaidAccess><TikTokTrendingHashtags /></RequirePaidAccess>} /> */}
              <Route path="/tiktok/knowledge-hub" element={<Navigate to="/tiktok/hooks" replace />} />
              <Route path="/tiktok/hooks" element={<RequireProAccess><TikTokHooks /></RequireProAccess>} />
              <Route path="/tiktok/workspace" element={<RequirePaidAccess><TikTokWorkspace /></RequirePaidAccess>} />
              <Route
                path="/tiktok/workspace/:folderId"
                element={<RequirePaidAccess><TikTokWorkspaceFolder /></RequirePaidAccess>}
              />
              {/* <Route path="/tiktok/saved" element={<RequirePaidAccess><TikTokSaved /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/for-you" element={<RequireProAccess><TikTokForYou /></RequireProAccess>} /> */}
              <Route path="/tiktok/trending-music" element={<RequirePaidAccess><TikTokTrendingMusic /></RequirePaidAccess>} />
              <Route path="/tiktok/predictor" element={<RequireProAccess><TikTokPredictor /></RequireProAccess>} />
              {/* <Route path="/tiktok/collections" element={<RequirePaidAccess><TikTokCollectionsIndex /></RequirePaidAccess>} /> */}
              {/* <Route path="/tiktok/collections/:id" element={<RequirePaidAccess><TikTokCollectionPage /></RequirePaidAccess>} /> */}
              <Route path="/tiktok/analysis/:key" element={<TikTokAnalysisPage />} />
              <Route path="/bookmarks" element={<RequirePaidAccess><Bookmarks /></RequirePaidAccess>} />
              <Route path="/notes" element={<RequirePaidAccess><Notes /></RequirePaidAccess>} />
              <Route path="/app/decision-engine" element={<RequirePaidAccess><DecisionEngine /></RequirePaidAccess>} />
              <Route path="/app/competitor-analysis" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/competitor-analysis/results" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/competitor-analysis/competitors/:competitorId" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/competitor-radar" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/competitor-radar/results" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/competitor-radar/competitors/:competitorId" element={<RequireProAccess><CompetitorRadar /></RequireProAccess>} />
              <Route path="/app/monthly-social-media-plan" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/monthly-social-media-plan/:month" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/monthly-social-media-plan/:month/:date" element={<RequirePaidAccess><MonthlySocialMediaPlanner /></RequirePaidAccess>} />
              <Route path="/app/saved-plans" element={<RequirePaidAccess><SavedPlans /></RequirePaidAccess>} />
              <Route path="/tutorial" element={<Tutorial />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings/*" element={<Settings />} />
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
