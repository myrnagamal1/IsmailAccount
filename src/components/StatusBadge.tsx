import type { Status } from '../types';

export function StatusBadge({ value }: { value: Status }) {
  return <span className={`status-badge status-${value.toLowerCase().replace(/[^a-z]/g, '')}`}>{value}</span>;
}
