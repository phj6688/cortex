import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '../lib/trpc-provider';
import { SSEProvider } from '../components/layout/sse-provider';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cortex V3',
  description: 'AI Task Delegation Control Plane',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <TRPCProvider>
          <SSEProvider>
            {children}
          </SSEProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
