import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ClientProviders } from './client-providers';


export const metadata: Metadata = {
  title: 'APP WS',
  description: 'Sistema de gerenciamento de manutenção de aeronaves inspirado no SAP',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Rubik+Glitch&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
