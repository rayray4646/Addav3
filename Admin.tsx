import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { Report, Profile } from '../types';
import { ArrowLeft, ShieldAlert, CheckCircle, XCircle, Ban, Eye, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type ReportWithDetails = Report & {
  reporter: Profile;
  reported_user: Profile | null;
};

const AdminPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchReports();
  }, [profile]);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reporter_id(id, name, avatar_url, occupation),
        reported_user:users!reported_user_id(id, name, avatar_url, occupation, is_banned)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) setReports(data as any);
    setLoading(false);
  };

  const handleResolve = async (reportId: string, status: 'actioned' | 'dismissed') => {
    setActionLoading(reportId + status);
    try {
      const { error } = await supabase.rpc('admin_resolve_report', {
        report_id: reportId,
        new_status: status,
      });
      if (error) throw error;
      await fetchReports();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (userId: string, reportId: string, reason: string) => {
    if (!confirm(`Ban this user for: "${reason}"? This will remove all their pending requests.`)) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase.rpc('admin_ban_user', {
        target_user_id: userId,
        reason_text: reason,
      });
      if (error) throw error;
      await handleResolve(reportId, 'actioned');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!profile || profile.role !== 'admin') return null;

  const filtered = reports.filter(r =>
    activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
  );

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  const statusColor: Record<string, string> = {
    pending: 'bg-orange-dim text-orange border-orange/20',
    reviewed: 'bg-bg text-mid border-border',
    actioned: 'bg-red-50 text-red-600 border-red-100',
    dismissed: 'bg-green-bg text-green border-green/20',
  };

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-mid hover:text-navy rounded-full hover:bg-bg transition-colors">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-orange" />
          <span className="font-serif text-lg text-navy">Admin</span>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-orange text-white text-xs font-bold rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-5 pb-24">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-2xl text-orange">{reports.filter(r => r.status === 'pending').length}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Pending</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-2xl text-red-500">{reports.filter(r => r.status === 'actioned').length}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Actioned</div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 text-center">
            <div className="font-serif text-2xl text-navy">{reports.length}</div>
            <div className="text-[10px] text-mid uppercase tracking-wider mt-1">Total</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg p-1 rounded-full border border-border mb-5">
          {(['pending', 'reviewed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-full text-sm font-bold transition-all capitalize ${
                activeTab === tab ? 'bg-surface text-navy shadow-sm' : 'text-mid hover:text-navy'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-mid animate-pulse">Loading reports…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle size={40} className="text-green mx-auto mb-3" />
            <p className="text-mid">No {activeTab} reports</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(report => (
              <div key={report.id} className="bg-surface rounded-2xl border border-border p-5">
                {/* Report Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flag size={14} className="text-red-400 shrink-0" />
                    <span className="text-sm font-bold text-navy">{report.reason}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor[report.status]}`}>
                    {report.status}
                  </span>
                </div>

                {/* Reported User */}
                {report.reported_user && (
                  <div className="bg-bg rounded-xl border border-border p-3 mb-3">
                    <p className="text-[10px] font-bold text-mid uppercase tracking-wider mb-2">Reported User</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-border overflow-hidden bg-surface shrink-0">
                        {report.reported_user.avatar_url ? (
                          <img src={report.reported_user.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-mid">
                            {report.reported_user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy truncate">{report.reported_user.name}</p>
                        <p className="text-[10px] text-mid">{report.reported_user.occupation || 'No occupation set'}</p>
                      </div>
                      {(report.reported_user as any).is_banned && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-full border border-red-100">
                          Banned
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Details */}
                {report.details && (
                  <p className="text-sm text-mid bg-bg rounded-xl border border-border p-3 mb-3 italic">
                    "{report.details}"
                  </p>
                )}

                {/* Reporter */}
                <div className="flex items-center justify-between text-[10px] text-light mb-3">
                  <span>Reported by <span className="font-bold text-mid">{report.reporter?.name || 'Unknown'}</span></span>
                  <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                </div>

                {/* Actions — only for pending */}
                {report.status === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <button
                      onClick={() => handleResolve(report.id, 'dismissed')}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-xl text-xs font-bold text-mid hover:text-green hover:border-green/50 transition-colors"
                    >
                      <XCircle size={14} /> Dismiss
                    </button>

                    {report.reported_user && !(report.reported_user as any).is_banned && (
                      <button
                        onClick={() => handleBanUser(report.reported_user!.id, report.id, report.reason)}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        <Ban size={14} /> Ban User
                      </button>
                    )}

                    {report.reported_hangout_id && (
                      <button
                        onClick={() => navigate(`/hangout/${report.reported_hangout_id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-xl text-xs font-bold text-mid hover:text-navy transition-colors"
                      >
                        <Eye size={14} /> View Adda
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
