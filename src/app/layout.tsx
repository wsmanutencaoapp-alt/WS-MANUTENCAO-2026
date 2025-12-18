import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { InitializeCounter } from '@/components/initialize-counter';
import { Providers } from '@/lib/providers';
import { ThemeProvider } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'APP WS',
  description: 'Sistema de gerenciamento de manutenção de aeronaves inspirado no SAP',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <Providers>
            <FirebaseClientProvider>
              <InitializeCounter />
              {children}
            </FirebaseClientProvider>
          </Providers>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
