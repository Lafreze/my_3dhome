import type { Metadata } from 'next';
import SharedModel from '../shared-model';
export const metadata: Metadata = {
  title: '私密分享 · SATORI',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default function ModelSharePage() {
  return <SharedModel />;
}
