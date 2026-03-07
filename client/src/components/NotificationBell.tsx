/**
 * NotificationBell.tsx — In-app notification bell with unread badge count.
 * Fetches from a simple in-memory approach using risk score alerts.
 */
import { useState } from 'react';

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    level?: 'RED' | 'AMBER' | 'GREEN';
    createdAt: string;
    read: boolean;
}

interface NotificationBellProps {
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
}

export function NotificationBell({ notifications, onMarkRead }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const unread = notifications.filter(n => !n.read).length;

    return (
        <div className="relative">
            <button
                id="btn-notification-bell"
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-xl hover:bg-slate-700/50 transition-colors"
                aria-label={`Notifications (${unread} unread)`}
            >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a1 1 0 10-2 0v.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 01-6 0" />
                </svg>
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 animate-pulse">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Dropdown */}
                    <div className="absolute right-0 top-12 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                            <span className="font-semibold text-slate-200 text-sm">Notifications</span>
                            {unread > 0 && (
                                <span className="text-xs text-indigo-400">{unread} unread</span>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="text-sm text-muted text-center py-6">No notifications</p>
                            ) : (
                                notifications.slice(0, 20).map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => { onMarkRead(n.id); }}
                                        className={`px-4 py-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition-colors ${!n.read ? 'bg-slate-700/20' : ''}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {n.level === 'RED' && <span className="text-red-400 text-sm shrink-0">🔴</span>}
                                            {n.level === 'AMBER' && <span className="text-amber-400 text-sm shrink-0">🟡</span>}
                                            {!n.level && <span className="text-slate-400 text-sm shrink-0">🔔</span>}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-200 truncate">{n.title}</p>
                                                <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                                                <p className="text-xs text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
