// ─── Spinner ────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
    return (
        <span
            role="status"
            aria-label="Loading"
            className={`${dim} border-2 border-primary-600 border-t-transparent rounded-full animate-spin inline-block`}
        />
    );
}

export function FullPageSpinner() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Spinner size="lg" />
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────
interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="empty-state animate-fade-in">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <p className="empty-state-title">{title}</p>
            {description && <p className="empty-state-desc">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

// ─── Error Banner ─────────────────────────────────────────────────
interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
    return (
        <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in"
        >
            <span>⚠ {message}</span>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                    Retry
                </button>
            )}
        </div>
    );
}

// ─── Skeleton Row ─────────────────────────────────────────────────
export function SkeletonRow({ count = 3 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full" />
            ))}
        </>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────
export function ProgressBar({
    value,
    max = 100,
    label,
}: {
    value: number;
    max?: number;
    label?: string;
}) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <div className="flex flex-col gap-1">
            {label !== undefined && (
                <div className="flex justify-between text-xs text-muted">
                    <span>{label}</span>
                    <span>{pct}%</span>
                </div>
            )}
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
