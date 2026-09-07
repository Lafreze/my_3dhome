import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '小森居 Komori · 给生活留一点空白',
  description: '走进一间温暖的互动小屋。转动视角，打开台灯，在白昼与夜晚之间，享受属于自己的片刻。',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
