import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initMetaPixel, trackMetaPageView } from '../lib/metaPixel.js';

export default function MetaPixelBridge() {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel().catch(() => {});
  }, []);

  useEffect(() => {
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
