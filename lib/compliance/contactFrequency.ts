import { prisma } from "@/lib/db/prisma";
import type { $Enums } from "@/generated/prisma/client";

const CALL_CHANNELS: $Enums.Channel[] = ["PHONE", "AI_VOICE_CALL", "OPERATOR_CALL"];
const MAX_CALLS_PER_DAY = 1;
const MAX_CALLS_PER_WEEK = 3;
const MAX_SMS_PER_DAY = 1;
const QUIET_HOURS_START_JST = 8;
const QUIET_HOURS_END_JST = 20;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * All day/week-boundary math below is explicitly JST-based (not the host
 * process's local timezone) since this product only operates in Japan.
 */
export function jstDayStart(date: Date): Date {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const midnightJst = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return new Date(midnightJst - JST_OFFSET_MS);
}

/** Monday-start JST week. */
function jstWeekStart(date: Date): Date {
  const dayStart = jstDayStart(date);
  const jstDow = new Date(dayStart.getTime() + JST_OFFSET_MS).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (jstDow + 6) % 7;
  return new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
}

function isWithinQuietHours(date: Date): boolean {
  const hour = new Date(date.getTime() + JST_OFFSET_MS).getUTCHours();
  return hour >= QUIET_HOURS_START_JST && hour < QUIET_HOURS_END_JST;
}

export interface ContactStats {
  callsToday: number;
  callsThisWeek: number;
  smsToday: number;
  mailThisWeek: number;
  lastContactAt: Date | null;
  nextAllowedAt: Date | null;
}

export async function getContactStats(claimId: string, now = new Date()): Promise<ContactStats> {
  const dayStart = jstDayStart(now);
  const weekStart = jstWeekStart(now);

  const [callsToday, callsThisWeek, smsToday, mailThisWeek, lastSent] = await Promise.all([
    prisma.scheduledCommunication.count({
      where: { claimId, status: "SENT", channel: { in: CALL_CHANNELS }, sentAt: { gte: dayStart } },
    }),
    prisma.scheduledCommunication.count({
      where: { claimId, status: "SENT", channel: { in: CALL_CHANNELS }, sentAt: { gte: weekStart } },
    }),
    prisma.scheduledCommunication.count({
      where: { claimId, status: "SENT", channel: "SMS", sentAt: { gte: dayStart } },
    }),
    prisma.scheduledCommunication.count({
      where: { claimId, status: "SENT", channel: "LETTER", sentAt: { gte: weekStart } },
    }),
    prisma.scheduledCommunication.findFirst({
      where: { claimId, status: "SENT" },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  let nextAllowedAt: Date | null = null;
  if (callsToday >= MAX_CALLS_PER_DAY || smsToday >= MAX_SMS_PER_DAY) {
    nextAllowedAt = new Date(dayStart.getTime() + DAY_MS);
  }
  if (callsThisWeek >= MAX_CALLS_PER_WEEK) {
    const nextWeekStart = new Date(weekStart.getTime() + 7 * DAY_MS);
    if (!nextAllowedAt || nextWeekStart > nextAllowedAt) nextAllowedAt = nextWeekStart;
  }

  return {
    callsToday,
    callsThisWeek,
    smsToday,
    mailThisWeek,
    lastContactAt: lastSent?.sentAt ?? null,
    nextAllowedAt,
  };
}

/**
 * Returns a reason string if sending on this channel right now would violate
 * the frequency/quiet-hours policy, or null if it's allowed. Mail/email/portal
 * are not frequency-limited (only call/SMS channels, per the current policy).
 */
export async function checkContactFrequency(
  claimId: string,
  channel: $Enums.Channel,
  now = new Date(),
): Promise<string | null> {
  const isCall = CALL_CHANNELS.includes(channel);
  const isSms = channel === "SMS";
  if (!isCall && !isSms) return null;

  if (!isWithinQuietHours(now)) {
    return "営業時間外(08:00〜20:00)のため送信を見送りました";
  }

  const stats = await getContactStats(claimId, now);

  if (isCall) {
    if (stats.callsToday >= MAX_CALLS_PER_DAY) return `本日の架電上限(${MAX_CALLS_PER_DAY}回)に達しています`;
    if (stats.callsThisWeek >= MAX_CALLS_PER_WEEK)
      return `今週の架電上限(${MAX_CALLS_PER_WEEK}回)に達しています`;
  }
  if (isSms && stats.smsToday >= MAX_SMS_PER_DAY) {
    return `本日のSMS送信上限(${MAX_SMS_PER_DAY}回)に達しています`;
  }
  return null;
}
