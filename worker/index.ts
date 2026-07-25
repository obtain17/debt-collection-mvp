import "dotenv/config";
import cron from "node-cron";
import { sendDueCommunications } from "../lib/dunning/sendCommunication";

async function tick(): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const count = await sendDueCommunications();
    console.log(
      count > 0
        ? `[worker] ${startedAt} - ${count}件の督促を送信しました`
        : `[worker] ${startedAt} - 送信対象なし`,
    );
  } catch (error) {
    console.error(`[worker] ${startedAt} - エラー:`, error);
  }
}

console.log("[worker] 督促ワーカーを起動しました(1分間隔でポーリング)");

// Run once immediately so any backlog present at startup (e.g. right after
// seeding demo data) is processed without waiting for the first cron tick.
tick();
cron.schedule("* * * * *", tick);
