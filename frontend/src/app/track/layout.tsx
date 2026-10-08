import type { Metadata } from 'next';
import { NO_INDEX } from '@/lib/seo';

// Personal / transactional page — never indexed.
export const metadata: Metadata = { title: 'تتبع الطلب', robots: NO_INDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
