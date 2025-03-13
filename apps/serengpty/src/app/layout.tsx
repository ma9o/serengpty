//import '../../../../libs/ui-utils/src/global.css';

import '@enclaveid/ui-utils/global.css';
import './styles/stream-chat-custom.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SerenGPTy',
  description: 'Find ChatGPT and Claude users who think like you',
  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: light)',
        url: '/logo-dark.svg',
        href: '/logo-dark.svg',
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: '/logo-light.svg',
        href: '/logo-light.svg',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
