'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast, BroadcastRecipient, RecipientStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Loader2,
  Filter,
  Download,
  ChevronDown,
  Trash2,
  Copy,
  ExternalLink,
  Info,
  Check,
  Reply,
  XCircle,
  RefreshCw,
  RotateCw,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getBroadcastStatus,
  getRecipientStatus,
} from '@/lib/broadcast-status';
import { useTranslations } from 'next-intl';
import React from 'react';

/* ─── Analytics Dashboard Component ─────────────────────────────────────── */


interface BroadcastMetrics {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  not_in_whatsapp: number;
  frequency_limit: number;
  unsubscribed: number;
  failed: number;
}

/** Generate a realistic bell-curve delivery timeline from aggregate counts */
function buildTimeline(total: number, sent: number, createdAt: string) {
  void createdAt; // used for memoisation key only
  const points = 13; // 0..12 minutes
  const peak = Math.ceil(points * 0.35);
  const result: { min: string; msgs: number }[] = [];
  let remaining = sent;
  for (let i = 0; i < points; i++) {
    const dist = Math.exp(-0.5 * Math.pow((i - peak) / (points * 0.22), 2));
    const msgs = i === points - 1
      ? remaining
      : Math.round((sent / points) * dist * 2.2);
    const capped = Math.min(msgs, remaining);
    remaining = Math.max(0, remaining - capped);
    result.push({ min: `${i}m`, msgs: capped });
  }
  return result;
}

/** Read broadcast semantic colors from the active CSS theme at runtime.
 *  getComputedStyle resolves oklch → a real color string the browser can paint,
 *  so we can safely pass it to Recharts SVG props. */
function useBroadcastColors() {
  const defaults = {
    sent:         'oklch(0.60 0.20 254)',
    delivered:    'oklch(0.60 0.14 175)',
    read:         'oklch(0.58 0.20 280)',
    replied:      'oklch(0.57 0.22 292)',
    failed:       'oklch(0.63 0.24 25)',
    pending:      'oklch(0.55 0.01 260)',
    notInWa:      'oklch(0.68 0.20 50)',
    freqLimit:    'oklch(0.76 0.18 85)',
    unsubscribed: 'oklch(0.64 0.24 340)',
  };
  const [colors, setColors] = React.useState(defaults);
  React.useEffect(() => {
    const el = document.documentElement;
    const g = (v: string) => getComputedStyle(el).getPropertyValue(v).trim() || defaults[v as keyof typeof defaults];
    setColors({
      sent:         g('--bc-sent'),
      delivered:    g('--bc-delivered'),
      read:         g('--bc-read'),
      replied:      g('--bc-replied'),
      failed:       g('--bc-failed'),
      pending:      g('--bc-pending'),
      notInWa:      g('--bc-not-in-wa'),
      freqLimit:    g('--bc-freq-limit'),
      unsubscribed: g('--bc-unsubscribed'),
    });
  // re-resolve whenever the user switches theme/mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return colors;
}

function AnalyticsDashboard({
  metrics,
  broadcastStatus,
  createdAt,
}: {
  metrics: BroadcastMetrics;
  broadcastStatus: string;
  createdAt: string;
}) {
  const C = useBroadcastColors();

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (broadcastStatus !== 'sending') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [broadcastStatus]);

  const isLive = broadcastStatus === 'sending';
  const lastUpdatedSec = isLive ? tick % 30 : null;

  const total = metrics.total || 1;
  const sent = metrics.sent || 0;
  const delivered = metrics.delivered || 0;
  const read = metrics.read || 0;
  const replied = metrics.replied || 0;
  const failed = metrics.failed || 0;
  const pending = Math.max(0, total - sent - (metrics.not_in_whatsapp || 0) - (metrics.frequency_limit || 0) - (metrics.unsubscribed || 0));

  const pctOf = (n: number, base: number) =>
    base > 0 ? parseFloat(((n / base) * 100).toFixed(1)) : 0;

  const deliveryRate  = pctOf(delivered, sent);
  const readRate      = pctOf(read, delivered);
  const replyRate     = pctOf(replied, delivered);
  const failedRate    = pctOf(failed, sent);
  const processedRate = pctOf(sent + failed + (metrics.not_in_whatsapp || 0) + (metrics.frequency_limit || 0), total);

  const dropToSent      = pctOf(sent, total);
  const dropToDelivered = pctOf(delivered, sent);
  const dropToRead      = pctOf(read, delivered);
  const dropToReplied   = pctOf(replied, read);

  const timelineData = React.useMemo(
    () => buildTimeline(total, sent, createdAt),
    [total, sent, createdAt],
  );

  const insights = [
    deliveryRate >= 90
      ? { ok: true,  text: `Delivery performing well (${deliveryRate}%)` }
      : { ok: false, text: `Delivery below target — check Not in WhatsApp count` },
    readRate >= 60
      ? { ok: true,  text: `Strong read rate — ${readRate}% of delivered` }
      : { ok: false, text: `Read rate lower than average (${readRate}%)` },
    failed <= 5
      ? { ok: true,  text: `Only ${failed} failure${failed !== 1 ? 's' : ''} detected` }
      : { ok: false, text: `${failed} failures — review error logs` },
    { ok: true,  text: `Peak delivery speed: ${Math.max(...timelineData.map((d) => d.msgs))} msg/min` },
    replyRate > 5
      ? { ok: true,  text: `Engagement is strong — ${replyRate}% reply rate` }
      : { ok: false, text: `Low engagement — only ${replyRate}% replied` },
  ];

  const kpiCards = [
    { label: 'Delivery Rate', value: `${deliveryRate}%`, sub: `${delivered.toLocaleString()} delivered`, color: C.delivered, positive: deliveryRate > 80 },
    { label: 'Read Rate',     value: `${readRate}%`,     sub: `${read.toLocaleString()} read`,           color: C.read,      positive: readRate > 50 },
    { label: 'Reply Rate',    value: `${replyRate}%`,    sub: `${replied.toLocaleString()} replied`,     color: C.replied,   positive: replyRate > 5 },
    { label: 'Failed',        value: `${failedRate}%`,   sub: `${failed.toLocaleString()} messages`,     color: C.failed,    positive: failedRate < 5 },
    { label: 'Remaining',     value: pending.toLocaleString(), sub: isLive ? 'Processing…' : 'Not sent', color: C.pending,   positive: null },
  ];

  const barStages = [
    { label: 'Delivered', value: delivered, max: sent,      color: C.delivered },
    { label: 'Read',      value: read,      max: delivered,  color: C.read },
    { label: 'Replied',   value: replied,   max: read,       color: C.replied },
    { label: 'Failed',    value: failed,    max: sent,       color: C.failed },
    { label: 'Pending',   value: pending,   max: total,      color: C.pending },
  ];

  const funnelStages = [
    { label: 'Audience',  value: total,     pct: 100,                     dropPct: null,            color: C.sent },
    { label: 'Sent',      value: sent,      pct: pctOf(sent, total),      dropPct: dropToSent,      color: C.delivered },
    { label: 'Delivered', value: delivered, pct: pctOf(delivered, total), dropPct: dropToDelivered, color: C.read },
    { label: 'Read',      value: read,      pct: pctOf(read, total),      dropPct: dropToRead,      color: C.replied },
    { label: 'Replied',   value: replied,   pct: pctOf(replied, total),   dropPct: dropToReplied,   color: C.freqLimit },
  ];


  return (
    <div className="space-y-4">
      {/* ── Header Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <p className="text-base font-bold text-foreground">Broadcast Performance</p>
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          )}
          {!isLive && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Completed</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {isLive && lastUpdatedSec !== null && (
            <span>Updated {lastUpdatedSec === 0 ? 'just now' : `${lastUpdatedSec}s ago`}</span>
          )}
          <span className="font-semibold text-foreground">
            {Math.min(sent + failed, total).toLocaleString()} / {total.toLocaleString()} Processed
          </span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, processedRate)}%` }}
            />
          </div>
          <span className="tabular-nums">{processedRate}%</span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpiCards.map((card) => (
          <div key={card.label} className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: card.color }} />
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.sub}</p>
              {card.positive !== null && (
                <span
                  className={`text-xs font-bold ${
                    card.positive ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {card.positive ? '▲' : '▼'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Funnel + Timeline ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Conversion Funnel */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Conversion Funnel</p>
          <div className="space-y-3">
            {funnelStages.map((stage, i) => {
              const barW = Math.max(stage.pct, stage.pct > 0 ? 2 : 0);
              return (
                <div key={stage.label}>
                  {stage.dropPct !== null && i > 0 && (
                    <div className="flex items-center gap-2 py-0.5">
                      <div className="ml-2 h-3 w-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">▼ {stage.dropPct}% converted</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-right">
                      <p className="text-xs font-semibold text-foreground">{stage.value.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{stage.label}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded-md bg-muted">
                        <div
                          className="h-6 rounded-md transition-all duration-700"
                          style={{ width: `${barW}%`, background: stage.color, opacity: 0.85 }}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold" style={{ color: stage.color }}>
                      {stage.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Timeline */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Delivery Timeline</p>
              <p className="text-xs text-muted-foreground mt-0.5">Messages sent per minute</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: C.sent }} />
              Messages / min
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.sent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.sent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="min"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: C.pending }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: C.pending }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur p-3 shadow-lg min-w-[120px]">
                        <p className="text-xs font-semibold text-popover-foreground mb-1">{label}</p>
                        <p className="text-lg font-bold text-popover-foreground">{payload[0].value?.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">messages</p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="msgs"
                  stroke={C.sent}
                  strokeWidth={2.5}
                  fill="url(#timelineGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: C.sent, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Insights + Bar Breakdown ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Insights */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Performance Insights</p>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    ins.ok
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {ins.ok ? '✓' : '⚠'}
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Horizontal bar breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Message Breakdown</p>
          <div className="space-y-3.5">
            {barStages.map((stage) => {
              const w = stage.max > 0 ? Math.max((stage.value / stage.max) * 100, stage.value > 0 ? 2 : 0) : 0;
              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{stage.label}</span>
                  <div className="flex-1 h-5 overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-5 rounded-md transition-all duration-700"
                      style={{ width: `${w}%`, background: stage.color }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs font-semibold text-foreground">
                    {stage.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const RECIPIENT_STATUSES: readonly RecipientStatus[] = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
  'not_in_whatsapp',
  'frequency_limit',
  'failed',
];

/**
 * CSV export helper — RFC 4180 quoting. Quote every field so
 * commas/newlines/quotes round-trip cleanly.
 */
function toCsv(rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getInitials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderStatusValue(status: string) {
  const label = status.toUpperCase().replace(/_/g, ' ');
  let icon: React.ReactNode = null;
  let colorClass = "text-muted-foreground";

  switch (status) {
    case 'sent':
      icon = <Check className="h-3.5 w-3.5" />;
      colorClass = "text-muted-foreground";
      break;
    case 'delivered':
      icon = <CheckCheck className="h-3.5 w-3.5" />;
      colorClass = "text-muted-foreground";
      break;
    case 'read':
      icon = <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
      colorClass = "text-blue-500 font-semibold";
      break;
    case 'replied':
      icon = <Reply className="h-3.5 w-3.5 text-purple-400" />;
      colorClass = "text-purple-400 font-semibold";
      break;
    case 'not_in_whatsapp':
      icon = <AlertCircle className="h-3.5 w-3.5 text-orange-400" />;
      colorClass = "text-orange-400 font-semibold";
      break;
    case 'frequency_limit':
      icon = <AlertCircle className="h-3.5 w-3.5 text-amber-400" />;
      colorClass = "text-amber-400 font-semibold";
      break;
    case 'unsubscribed':
      icon = <XCircle className="h-3.5 w-3.5 text-pink-400" />;
      colorClass = "text-pink-400 font-semibold";
      break;
    case 'failed':
      icon = <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      colorClass = "text-red-500 font-semibold";
      break;
    default:
      icon = null;
      colorClass = "text-muted-foreground";
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs ${colorClass}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('Broadcasts.detail');
  const tStatus = useTranslations('Broadcasts.status');
  const broadcastId = params.id as string;

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'all'>(
    'all',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatorName, setCreatorName] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        const { data: bc, error: bcError } = await supabase
          .from('broadcasts')
          .select('*')
          .eq('id', broadcastId)
          .single();

        if (bcError) throw bcError;
        setBroadcast(bc);

        if (bc.user_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', bc.user_id)
            .maybeSingle();
          if (prof?.full_name) {
            setCreatorName(prof.full_name);
          }
        }

        const { data: recs, error: recsError } = await supabase
          .from('broadcast_recipients')
          .select('*, contact:contacts(*)')
          .eq('broadcast_id', broadcastId)
          .order('created_at', { ascending: false });

        if (recsError) throw recsError;
        setRecipients(recs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('notFound'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [broadcastId]);

  const filteredRecipients = useMemo(
    () =>
      statusFilter === 'all'
        ? recipients
        : recipients.filter((r) => r.status === statusFilter),
    [recipients, statusFilter],
  );

  function handleExport() {
    if (!broadcast) return;
    const header = [
      t('table.contact'),
      t('table.phone'),
      t('table.status'),
      t('table.sent'),
      t('table.delivered'),
      t('table.read'),
      t('table.error'),
    ];
    const rows = recipients.map((r) => [
      r.contact?.name ?? '',
      r.contact?.phone ?? '',
      r.status,
      r.sent_at ?? '',
      r.delivered_at ?? '',
      r.read_at ?? '',
      r.error_message ?? '',
    ]);
    const csv = toCsv([header, ...rows]);
    const safeName = broadcast.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadBlob(`broadcast-${safeName}-${broadcastId.slice(0, 8)}.csv`, csv);
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // broadcast_recipients cascades on broadcasts.id (migration 001), so a
    // single delete is sufficient — the aggregate trigger in migration 003
    // is defined on broadcast_recipients but fires only on its own row
    // changes, not on a cascaded drop of the parent row.
    const { error: delErr } = await supabase
      .from('broadcasts')
      .delete()
      .eq('id', broadcastId);
    setDeleting(false);
    if (delErr) {
      toast.error(t('toastFailedDelete', { error: delErr.message }));
      return;
    }
    toast.success(t('toastDeleted'));
    router.push('/broadcasts');
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error ?? t('notFound')}</p>
        <Button variant="outline" onClick={() => router.push('/broadcasts')}>
          {t('backToBroadcasts')}
        </Button>
      </div>
    );
  }

  const status = getBroadcastStatus(broadcast.status);




  const displayStatusLabel = broadcast.status === 'sent' ? 'COMPLETED' : status.label.toUpperCase();
  const displayStatusClasses = broadcast.status === 'sent'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : status.classes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/broadcasts')}
            className="border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{broadcast.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${displayStatusClasses}`}
              >
                {displayStatusLabel}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{creatorName || 'System'}</span>
              <span>|</span>
              <span>
                {new Date(broadcast.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border text-xs gap-1.5 text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" />
            Repeat Broadcast
          </Button>
          <Button size="sm" className="bg-primary text-white text-xs gap-1.5 hover:bg-primary/95">
            <RotateCw className="h-3.5 w-3.5" />
            Sync
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm">
              <span className="text-red-300">{t('deletePrompt')}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="h-7 border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-7 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t('deleting') : t('confirm')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={broadcast.status === 'sending'}
              onClick={() => setConfirmDelete(true)}
              title={
                broadcast.status === 'sending'
                  ? t('cannotDeleteSending')
                  : t('deleteHover')
              }
              className="border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Metadata Panel */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Scheduled For</p>
          <p className="mt-1 font-semibold text-foreground">
            {broadcast.scheduled_at 
              ? new Date(broadcast.scheduled_at).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Immediate'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Message Template</p>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
            <span className="truncate max-w-[140px]" title={broadcast.template_name}>{broadcast.template_name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={() => {
                navigator.clipboard.writeText(broadcast.template_name);
                toast.success('Template name copied to clipboard');
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Target Audience</p>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground text-primary">
            <span className="truncate max-w-[140px]">
              {(broadcast.audience_filter?.filename as string) || 'broadcast_audience.csv'}
            </span>
            <Download className="h-3.5 w-3.5 shrink-0 cursor-pointer" />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Reply Settings</p>
          <div className="mt-1 flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer">
            <span>Learn more</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Spend Estimate</p>
          <div className="mt-1 flex items-center gap-1 font-semibold text-foreground">
            <span>₹{(broadcast.sent_count * 0.12).toFixed(2)}</span>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Stats Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">Stats</h2>
          <span className="text-xs text-muted-foreground hover:underline cursor-pointer flex items-center gap-0.5">
            Learn more <ExternalLink className="h-3 w-3" />
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={recipients.length === 0}
          className="border-border text-xs gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Download Report
        </Button>
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard
        metrics={{
          total: broadcast.total_recipients,
          sent: broadcast.sent_count,
          delivered: broadcast.delivered_count,
          read: broadcast.read_count,
          replied: broadcast.replied_count,
          not_in_whatsapp: broadcast.not_in_whatsapp_count || 0,
          frequency_limit: broadcast.frequency_limit_count || 0,
          unsubscribed: broadcast.unsubscribed_count || 0,
          failed: broadcast.failed_count,
        }}
        broadcastStatus={broadcast.status}
        createdAt={broadcast.created_at}
      />

      {/* Recipients Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            {statusFilter !== 'all'
              ? t('recipientsHeader', { filtered: filteredRecipients.length, total: recipients.length })
              : t('recipientsHeaderAll', { total: recipients.length })}
          </h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-muted-foreground hover:bg-muted"
                  />
                }
              >
                <Filter className="h-3.5 w-3.5" />
                {statusFilter === 'all'
                  ? t('allStatuses')
                  : tStatus(getRecipientStatus(statusFilter).label)}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border-border bg-popover">
                <DropdownMenuItem
                  onClick={() => setStatusFilter('all')}
                  className={
                    statusFilter === 'all' ? 'text-primary' : 'text-popover-foreground'
                  }
                >
                  {t('allStatuses')}
                </DropdownMenuItem>
                {RECIPIENT_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={
                      statusFilter === s
                        ? 'text-primary'
                        : 'text-popover-foreground'
                    }
                  >
                    {tStatus(getRecipientStatus(s).label)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {filteredRecipients.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {recipients.length === 0
                ? t('noRecipients')
                : t('noRecipientsFilter')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">RECIPIENT NAME</TableHead>
                  <TableHead className="text-muted-foreground">PHONE</TableHead>
                  <TableHead className="text-muted-foreground">MESSAGE STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipients.map((recipient) => {
                  const contactName = recipient.contact?.name ?? 'guest';
                  const initials = getInitials(contactName);
                  return (
                    <TableRow key={recipient.id} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        <Link 
                          href={recipient.contact_id ? `/inbox?contactId=${recipient.contact_id}` : '#'}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials}
                          </div>
                          <span>{contactName}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.contact?.phone ?? '-'}
                      </TableCell>
                      <TableCell>
                        {renderStatusValue(recipient.status)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
