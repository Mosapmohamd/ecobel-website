'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pixel } from '@/lib/analytics';

/** PageView on first load and on every client-side route change (rendered
 * once, in the root layout). The tracker itself makes sure each path counts
 * once, whatever re-renders or Strict Mode do. */
export default function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    pixel.pageView();
  }, [pathname]);
  return null;
}
