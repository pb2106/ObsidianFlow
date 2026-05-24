import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import { projectConfig } from '@/config/project.config';
import './globals.css';
import './auth.css';

export const metadata: Metadata = {
  title: projectConfig.meta.name,
  description: projectConfig.meta.tagline || `Welcome to ${projectConfig.meta.name}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: `${projectConfig.theme.font}, system-ui, sans-serif` }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
