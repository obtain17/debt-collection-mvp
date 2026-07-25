import Link from "next/link";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import { getAiVoiceSettings } from "@/lib/voice/getAiVoiceSettings";
import { VOICE_TELEPHONY_PROVIDER_LABEL, VOICE_SPEECH_PROVIDER_LABEL } from "@/lib/format";
import { updateAiVoiceSettings } from "./actions";
import type { $Enums } from "@/generated/prisma/client";

const TELEPHONY_OPTIONS: $Enums.VoiceTelephonyProvider[] = ["TWILIO", "AMAZON_CONNECT"];
const SPEECH_OPTIONS: $Enums.VoiceSpeechProvider[] = ["OPENAI_REALTIME", "AZURE_AI_SPEECH"];

export default async function AiVoiceSettingsPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const settings = await getAiVoiceSettings(session.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">AI音声自動督促の設定</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/settings/ai-voice/targets" className="text-slate-600 underline">
            発信対象・除外対象を確認
          </Link>
          <Link href="/settings/ai-voice/calls" className="text-slate-600 underline">
            通話録音・文字起こし・要約
          </Link>
        </div>
      </div>

      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
        このMVPには実際の電話回線接続(Twilio/Amazon Connect等)はありません。有効化すると、督促スケジュールの
        「AI音声電話」ステップやケース詳細画面の「今すぐ架電」ボタンから、シミュレーションされた通話(会話の
        トランスクリプト・要約付き)が発生するようになります。本番化の際は、下記で選択したプロバイダに実際に
        接続する実装への置き換えが必要です。
      </p>

      <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        <h2 className="mb-2 font-semibold">常時有効な固定ルール(設定では無効化できません)</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>本人確認が完了するまで、債権の種類・金額等の内容を一切開示しません。</li>
          <li>留守番電話には、折り返し依頼のみを残し、債権内容は残しません。</li>
          <li>弁護士介入・破産手続・債務不存在の主張・苦情を検知した場合、即座に会話を終了し担当者へ引き継ぎます。</li>
          <li>減額・和解条件の交渉はAIが行わず、必ず人間の担当者が対応します。</li>
          <li>発信・会話内容・自動停止・担当者への引き継ぎは、すべて監査ログに記録されます。</li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form action={updateAiVoiceSettings} className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
            AI音声自動督促を有効にする
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">電話基盤(テレフォニー)</span>
              <select
                name="telephonyProvider"
                defaultValue={settings.telephonyProvider}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              >
                {TELEPHONY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {VOICE_TELEPHONY_PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">音声認識・読み上げ</span>
              <select
                name="speechProvider"
                defaultValue={settings.speechProvider}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              >
                {SPEECH_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {VOICE_SPEECH_PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">名乗る部署名</span>
              <input
                name="callerName"
                defaultValue={settings.callerName}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">発信可能時間帯(開始時)</span>
              <input
                name="callWindowStartHour"
                type="number"
                min={0}
                max={23}
                defaultValue={settings.callWindowStartHour}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">発信可能時間帯(終了時)</span>
              <input
                name="callWindowEndHour"
                type="number"
                min={1}
                max={24}
                defaultValue={settings.callWindowEndHour}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
          </div>

          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            保存
          </button>
        </form>
      </section>
    </div>
  );
}
