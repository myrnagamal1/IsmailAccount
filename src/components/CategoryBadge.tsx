import type { Category } from '../types';

export function CategoryBadge({ value }: { value: Category }) {
  return <span className={`category-badge category-${value.toLowerCase().replace(/[^a-z]/g, '')}`}><span className="category-dot" />{value}</span>;
}
