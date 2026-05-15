import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

const SHIMMER_CSS = `
@keyframes rh-skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.rh-skeleton-cell {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e6edf5 0%, #f0f4f8 40%, #e6edf5 80%);
  background-size: 800px 100%;
  animation: rh-skeleton-shimmer 1.4s linear infinite;
}
`;

export function LoadingSkeleton({ rows = 5, columns = 4 }: LoadingSkeletonProps) {
  const rowList = Array.from({ length: rows });
  const colList = Array.from({ length: columns });

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      data-testid="loading-skeleton"
      style={{
        marginTop: '1rem',
        padding: '1.25rem',
        backgroundColor: 'var(--color-surface, #ffffff)',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}
    >
      <style>{SHIMMER_CSS}</style>
      {rowList.map((_, r) => (
        <div
          key={r}
          data-testid="skeleton-row"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '0.75rem'
          }}
        >
          {colList.map((__, c) => (
            <div
              key={c}
              className="rh-skeleton-cell"
              style={{ opacity: 0.4 + ((rows - r) / rows) * 0.5 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
