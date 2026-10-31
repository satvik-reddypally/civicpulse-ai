import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CivicPulse AI | Multimodal Civic Triage & SLA Governance',
  description:
    'Autonomous multimodal civic grievance triage, real-time geospatial enrichment, and multilingual statutory SLA explainer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}