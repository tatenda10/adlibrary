import { useEffect, useState } from 'react';
import { SignUpButton } from '@clerk/clerk-react';
import { useApiToast } from '../hooks/useApiToast.js';
import { previewLandingWebsite } from '../lib/api.js';
import CubeLoader from './CubeLoader.jsx';
import WebsiteAnalysisReport, {
  GlobeIcon,
  GraduationIcon,
  LockIcon,
} from './WebsiteAnalysisReport.jsx';

function WebsiteAnalysisPreviewModal({ websiteUrl, onClose, onSeeMore }) {
  const { notifyApiError } = useApiToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        setLoading(true);
        const data = await previewLandingWebsite({ websiteUrl });
        if (!cancelled) {
          setReport(data?.report || null);
        }
      } catch (err) {
        if (!cancelled) {
          notifyApiError(err, 'Failed to analyze website');
          setReport(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [notifyApiError, websiteUrl]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-5xl bg-black text-[#e8dccd]" style={{ fontFamily: 'inherit' }}>
        {loading ? (
          <div className="mt-8 flex justify-center py-12">
            <CubeLoader label="Analyzing website…" size={100} />
          </div>
        ) : report ? (
          <WebsiteAnalysisReport
            title={report?.title || 'Website conversion snapshot'}
            actions={(
              <>
                <SignUpButton mode="modal">
                  <button
                    onClick={onSeeMore}
                    className="bg-[#22c55e] px-4 py-1.5 text-[12px] font-semibold text-[#04110a] transition hover:bg-[#34d370]"
                  >
                    See more
                  </button>
                </SignUpButton>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-[#22c55e] bg-transparent px-4 py-1.5 text-[12px] font-semibold text-[#f0e4d6] transition hover:border-[#34d370]"
                >
                  Close
                </button>
              </>
            )}
            metrics={report.metrics || []}
            columns={[
              { icon: <GraduationIcon />, title: 'What looks okay', items: report.whats_working || [], itemPrefix: '-- ' },
              { icon: <GlobeIcon />, title: 'What to improve', items: report.to_improve || [], itemPrefix: '-- ' },
              { icon: <LockIcon />, title: 'Action points', items: report.action_points || [], itemPrefix: '-- ' },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}

export default WebsiteAnalysisPreviewModal;
