// RULE: dangerouslySetInnerHTML is banned in this codebase. All user data renders through JSX only.
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
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
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
