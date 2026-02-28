import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth-context';
import { X, Flag, CheckCircle } from 'lucide-react';
import { REPORT_REASONS } from '../types';

interface ReportModalProps {
  targetUserId?: string;
  targetUserName?: string;
  targetHangoutId?: string;
  targetHangoutTitle?: string;
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  targetUserId,
  targetUserName,
  targetHangoutId,
  targetHangoutTitle,
  onClose,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const targetLabel = targetUserName
    ? `@${targetUserName}`
    : targetHangoutTitle
    ? `"${targetHangoutTitle}"`
    : 'this content';

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId || null,
        reported_hangout_id: targetHangoutId || null,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green" />
            </div>
            <h3 className="font-serif text-xl text-navy mb-2">Report Submitted</h3>
            <p className="text-sm text-mid mb-6">
              Thanks for helping keep the community safe. We'll review this shortly.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 bg-navy text-white rounded-xl font-bold text-sm hover:bg-orange transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2 text-red-500">
                <Flag size={16} />
                <h3 className="font-bold text-sm">Report {targetLabel}</h3>
              </div>
              <button onClick={onClose} className="p-1.5 text-mid hover:text-navy rounded-full hover:bg-bg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-mid">
                Your report is anonymous. We take all reports seriously and typically review within 24 hours.
              </p>

              {/* Reason */}
              <div>
                <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">
                  Reason
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                        reason === r
                          ? 'border-red-400 bg-red-50 text-red-700 font-medium'
                          : 'border-border bg-bg text-navy hover:border-mid'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional details */}
              <div>
                <label className="block text-[10px] font-bold text-mid uppercase tracking-widest mb-2">
                  Additional Details (optional)
                </label>
                <textarea
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-navy focus:ring-1 focus:ring-orange focus:border-orange focus:outline-none resize-none placeholder-light"
                  placeholder="Describe what happened..."
                  rows={3}
                  maxLength={500}
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!reason || loading}
                className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
