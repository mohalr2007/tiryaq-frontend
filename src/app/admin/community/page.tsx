'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, RefreshCw, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { getStableAuthUser, supabase } from "@/utils/supabase/client";
import { logAuditEvent } from "@/utils/telemetry";
import { useI18n } from "@/lib/i18n";

type PostReportRow = {
  id: string;
  post_id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
  reporter: { full_name: string | null } | { full_name: string | null }[] | null;
  post: { title: string | null; doctor_id: string | null; is_hidden: boolean | null } | { title: string | null; doctor_id: string | null; is_hidden: boolean | null }[] | null;
};

type CommentReportRow = {
  id: string;
  comment_id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
  reporter: { full_name: string | null } | { full_name: string | null }[] | null;
  comment: { content: string | null; is_hidden: boolean | null; post_id: string | null } | { content: string | null; is_hidden: boolean | null; post_id: string | null }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function AdminCommunityModerationPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [postReports, setPostReports] = useState<PostReportRow[]>([]);
  const [commentReports, setCommentReports] = useState<CommentReportRow[]>([]);

  const loadQueue = async () => {
    setLoading(true);
    const { user, error } = await getStableAuthUser();

    if (error && !user) {
      setLoading(false);
      return;
    }

    if (!user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    setAdminId(profile.id);

    const [postReportsResult, commentReportsResult] = await Promise.all([
      supabase
        .from("community_post_reports")
        .select("id, post_id, reason, status, created_at, reporter:profiles!reporter_id(full_name), post:community_posts!post_id(title, doctor_id, is_hidden)")
        .order("created_at", { ascending: false }),
      supabase
        .from("community_comment_reports")
        .select("id, comment_id, reason, status, created_at, reporter:profiles!reporter_id(full_name), comment:community_post_comments!comment_id(content, is_hidden, post_id)")
        .order("created_at", { ascending: false }),
    ]);

    setPostReports((postReportsResult.data ?? []) as PostReportRow[]);
    setCommentReports((commentReportsResult.data ?? []) as CommentReportRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const resolvePostReport = async (report: PostReportRow, action: "dismissed" | "actioned") => {
    if (!adminId) {
      return;
    }

    if (action === "actioned") {
      const reason = window.prompt("Raison du masquage de la publication:", report.reason || "Signalement validé");
      if (!reason || !reason.trim()) {
        return;
      }

      const { error: hideError } = await supabase
        .from("community_posts")
        .update({
          is_hidden: true,
          hidden_reason: reason.trim(),
          hidden_at: new Date().toISOString(),
          hidden_by: adminId,
        })
        .eq("id", report.post_id);

      if (hideError) {
        alert(hideError.message);
        return;
      }
    }

    const { error: reportError } = await supabase
      .from("community_post_reports")
      .update({
        status: action,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (reportError) {
      alert(reportError.message);
      return;
    }

    await logAuditEvent({
      actorId: adminId,
      action: action === "actioned" ? "community_post_moderated" : "community_post_report_dismissed",
      entityType: "community_post_report",
      entityId: report.id,
      metadata: { post_id: report.post_id },
    });

    await loadQueue();
  };

  const resolveCommentReport = async (report: CommentReportRow, action: "dismissed" | "actioned") => {
    if (!adminId) {
      return;
    }

    if (action === "actioned") {
      const reason = window.prompt("Raison du masquage du commentaire:", report.reason || "Signalement validé");
      if (!reason || !reason.trim()) {
        return;
      }

      const { error: hideError } = await supabase
        .from("community_post_comments")
        .update({
          is_hidden: true,
          hidden_reason: reason.trim(),
          hidden_at: new Date().toISOString(),
          hidden_by: adminId,
        })
        .eq("id", report.comment_id);

      if (hideError) {
        alert(hideError.message);
        return;
      }
    }

    const { error: reportError } = await supabase
      .from("community_comment_reports")
      .update({
        status: action,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (reportError) {
      alert(reportError.message);
      return;
    }

    await logAuditEvent({
      actorId: adminId,
      action: action === "actioned" ? "community_comment_moderated" : "community_comment_report_dismissed",
      entityType: "community_comment_report",
      entityId: report.id,
      metadata: { comment_id: report.comment_id },
    });

    await loadQueue();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("common.accessDenied")}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("common.moderatorsOnly")}</p>
          <Link href="/" className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck size={22} className="text-blue-600" />
              {t("admin.title")}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Gestion des signalements publications et commentaires.
            </p>
          </div>
          <button
            onClick={() => void loadQueue()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw size={15} />
            {t("admin.refresh")}
          </button>
        </div>

        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{t("admin.postReports")} ({postReports.length})</h2>
          <div className="space-y-3">
            {postReports.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("admin.noPostReports")}</p> : null}
            {postReports.map((report) => {
              const reporter = normalizeRelation(report.reporter);
              const post = normalizeRelation(report.post);
              return (
                <div key={report.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{post?.title ?? "Publication sans titre"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Signalé par {reporter?.full_name ?? "Utilisateur"} · {new Date(report.created_at).toLocaleString("fr-FR")} · statut: {report.status}
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Motif: {report.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void resolvePostReport(report, "actioned")}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                    >
                      <EyeOff size={12} />
                      Masquer + valider
                    </button>
                    <button
                      onClick={() => void resolvePostReport(report, "dismissed")}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <XCircle size={12} />
                      Rejeter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{t("admin.commentReports")} ({commentReports.length})</h2>
          <div className="space-y-3">
            {commentReports.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("admin.noCommentReports")}</p> : null}
            {commentReports.map((report) => {
              const reporter = normalizeRelation(report.reporter);
              const comment = normalizeRelation(report.comment);
              return (
                <div key={report.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-sm text-slate-800 dark:text-slate-200">{comment?.content ?? "Commentaire supprimé"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Signalé par {reporter?.full_name ?? "Utilisateur"} · {new Date(report.created_at).toLocaleString("fr-FR")} · statut: {report.status}
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Motif: {report.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void resolveCommentReport(report, "actioned")}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                    >
                      <CheckCircle2 size={12} />
                      Masquer + valider
                    </button>
                    <button
                      onClick={() => void resolveCommentReport(report, "dismissed")}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <XCircle size={12} />
                      Rejeter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
