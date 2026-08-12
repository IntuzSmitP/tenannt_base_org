"use client";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const btnBase = {
    padding: '0.3rem 0.65rem', borderRadius: '6px',
    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem',
    fontWeight: 500, minWidth: '34px',
  } as React.CSSProperties;

  const activeBtn = { ...btnBase, background: 'var(--primary-color)', color: 'white', border: '1px solid var(--primary-color)' } as React.CSSProperties;
  const disabledBtn = { ...btnBase, opacity: 0.4, cursor: 'not-allowed' } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
      <button style={page === 1 ? disabledBtn : btnBase} onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} style={{ padding: '0 0.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>…</span>
        ) : (
          <button key={p} style={p === page ? activeBtn : btnBase} onClick={() => onPageChange(p as number)} aria-current={p === page ? 'page' : undefined}>{p}</button>
        )
      )}
      <button style={page === totalPages ? disabledBtn : btnBase} onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{total} total</span>
    </div>
  );
}
