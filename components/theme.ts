import type { AttackKind } from '../lib/iotrapApi';

export const colors = {
  background: '#0B1120',
  surface: '#111827',
  surfaceRaised: '#1F2937',
  border: '#273244',
  text: '#E5E7EB',
  textMuted: '#9CA3AF',
  live: '#22C55E',
  paused: '#9CA3AF',
  danger: '#EF4444',
  dangerSurface: '#3B1219',
  offlineSurface: '#1F2937',
  accent: '#38BDF8',
} as const;

export const mono = 'monospace';

export const kindStyle: Record<AttackKind, { label: string; color: string }> = {
  login_failed: { label: 'Login falhou', color: '#F59E0B' },
  login_success: { label: 'Login aceito', color: '#EF4444' },
  command: { label: 'Comando executado', color: '#A855F7' },
  download: { label: 'Download de arquivo', color: '#F43F5E' },
  connect: { label: 'Conexão', color: '#64748B' },
  other: { label: 'Evento', color: '#64748B' },
};
