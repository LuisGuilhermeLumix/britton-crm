interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '12px', className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function StatCardSkeleton() {
  return (
    <div className="stats-card">
      <Skeleton width="90px" height="10px" />
      <div style={{ marginTop: 16 }}>
        <Skeleton width="56px" height="28px" />
      </div>
      <div style={{ marginTop: 14 }}>
        <Skeleton width="120px" height="10px" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 12px' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 1fr 120px', gap: 16 }}>
          <Skeleton height="11px" />
          <Skeleton height="11px" />
          <Skeleton height="11px" />
          <Skeleton height="11px" />
          <Skeleton height="11px" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="kanban-card" style={{ cursor: 'default' }}>
      <Skeleton width="70%" height="12px" />
      <Skeleton width="50%" height="11px" />
      <Skeleton width="85%" height="11px" />
    </div>
  );
}
