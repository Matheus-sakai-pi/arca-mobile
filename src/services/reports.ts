import app from '../../app.json';
import { Platform } from 'react-native';
import { requireSupabase, scopedSupabase } from '@/lib/supabase';
import { decodeReportReceipt, reportError, type ReportReason } from '@/lib/reports';

export function reportsRepository(owner: string) {
  const client = scopedSupabase(requireSupabase(), owner);
  function check(error: {code?: string; message: string} | null) { if (error) throw new Error(reportError(error)); }
  return {
    async submit(lesson: string, question: string, reason: ReportReason, comment: string, requestKey: string, signal: AbortSignal) {
      const {data,error} = await client.rpc('submit_question_report', {p_lesson:lesson,p_question:question,p_reason:reason,p_comment:comment.trim(),p_version:app.expo.version,p_platform:Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'web',p_request_key:requestKey}).abortSignal(signal);
      check(error); return decodeReportReceipt(data,owner);
    },
  };
}
