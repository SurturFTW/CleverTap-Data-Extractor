"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, ShieldCheck, Upload } from "lucide-react";
import AccountFields, {
  useSelectedAccount,
} from "@/components/shared/AccountFields";
import {
  CopyTextButton,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  td,
  th,
} from "@/components/shared/ui";
import {
  buildBatch,
  newDraft,
  type RecordDraft,
  type UploadKind,
  type UploadResponse,
} from "@/lib/clevertap/upload";
import { fmtNumber } from "@/lib/utils/format";
import { postJson } from "@/lib/utils/http";
import RecordEditor from "./RecordEditor";

type Outcome = { kind: UploadKind; dryRun: boolean; sent: number; res: UploadResponse };

const LABEL: Record<UploadKind, { tab: string; noun: string }> = {
  profile: { tab: "User profiles", noun: "profile" },
  event: { tab: "Events", noun: "event" },
};

export default function UploadTool() {
  const account = useSelectedAccount();
  const { current } = account;

  const [kind, setKind] = useState<UploadKind>("profile");
  // Each tab keeps its own drafts so switching doesn't lose work
  const [drafts, setDrafts] = useState<Record<UploadKind, RecordDraft[]>>({
    profile: [newDraft()],
    event: [newDraft()],
  });
  const [busy, setBusy] = useState<"dry" | "live" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const list = drafts[kind];
  const setList = (next: RecordDraft[]) => setDrafts((d) => ({ ...d, [kind]: next }));

  // Live preview of exactly what will be sent (credentials are never included)
  const batch = useMemo(() => buildBatch(kind, list), [kind, list]);
  const previewJson = useMemo(
    () => (batch.ok ? JSON.stringify({ d: batch.value }, null, 2) : ""),
    [batch],
  );

  async function send(dryRun: boolean) {
    setError(null);
    setOutcome(null);
    if (!current.accountId.trim() || !current.passcode.trim())
      return setError("Enter the Account ID and Passcode.");
    if (!batch.ok) return setError(batch.error);

    if (!dryRun) {
      const n = batch.value.length;
      const ok = window.confirm(
        `Upload ${n} ${LABEL[kind].noun}${n === 1 ? "" : "s"} to account ${current.accountId.trim()} (${current.region})?\n\n` +
          "This writes to CleverTap and can't be undone from here.",
      );
      if (!ok) return;
    }

    setBusy(dryRun ? "dry" : "live");
    try {
      const data = await postJson<UploadResponse>(
                "/api/clevertap/upload",
                {
          credentials: {
            accountId: current.accountId.trim(),
            passcode: current.passcode.trim(),
            region: current.region,
          },
          records: batch.value,
          dryRun,
        },
                // Writes are never retried automatically
                { step: "Upload", retries: 0 },
            );
      setOutcome({ kind, dryRun, sent: batch.value.length, res: data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-8 shadow-md">
        <h2 className="flex items-center gap-3 text-xl font-semibold text-black">
          <Upload size={24} />
          Upload to CleverTap
        </h2>

        <div className="flex gap-2 border-b border-gray-200">
          {(["profile", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setError(null);
                setOutcome(null);
              }}
              className={`px-4 pb-3 text-base transition-all duration-200 ${
                kind === k
                  ? "border-b-2 border-black font-medium text-black"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {LABEL[k].tab}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AccountFields {...account} />
        </div>

        {list.map((d, i) => (
          <RecordEditor
            key={d.id}
            kind={kind}
            index={i}
            draft={d}
            canRemove={list.length > 1}
            onChange={(next) => setList(list.map((x) => (x.id === d.id ? next : x)))}
            onRemove={() => setList(list.filter((x) => x.id !== d.id))}
          />
        ))}
        <div>
          <SecondaryButton onClick={() => setList([...list, newDraft()])}>
            <Plus size={18} />
            Add another {LABEL[kind].noun}
          </SecondaryButton>
        </div>

        <details className="rounded-xl border border-gray-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            Preview request body
          </summary>
          <div className="border-t border-gray-200 p-4">
            {batch.ok ? (
              <>
                <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">{previewJson}</pre>
                <div className="mt-3">
                  <CopyTextButton text={previewJson} />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Not ready yet — {batch.error}</p>
            )}
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <SecondaryButton onClick={() => send(true)} disabled={busy !== null}>
            {busy === "dry" ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Validate (dry run)
          </SecondaryButton>
          <PrimaryButton onClick={() => send(false)} disabled={busy !== null}>
            {busy === "live" ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload {list.length} {LABEL[kind].noun}
            {list.length === 1 ? "" : "s"}
          </PrimaryButton>
        </div>
        <p className="text-sm text-gray-500">
          A dry run asks CleverTap to validate the records without saving anything. Uploading
          writes to the account above and asks you to confirm first.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {outcome && <Result outcome={outcome} />}
    </div>
  );
}

function Result({ outcome }: { outcome: Outcome }) {
  const { res, dryRun, sent } = outcome;
  const failed = res.unprocessed.length;
  const good = res.status === "success" && !res.error;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
      <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
        {good ? (
          <CheckCircle2 className="text-green-600" size={22} />
        ) : (
          <ShieldCheck className="text-amber-600" size={22} />
        )}
        <div>
          <h3 className="text-base font-semibold text-black">
            {dryRun ? "Dry run" : "Upload"}{" "}
            {good ? "succeeded" : res.status === "partial" ? "partly succeeded" : "failed"}
          </h3>
          <p className="text-sm text-gray-600">
            {fmtNumber(res.processed)} of {fmtNumber(sent)} record{sent === 1 ? "" : "s"}{" "}
            {dryRun ? "valid" : "processed"}
            {failed > 0 ? `, ${fmtNumber(failed)} rejected` : ""}
            {dryRun ? " — nothing was saved." : "."}
          </p>
        </div>
      </div>

      {res.error && <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{res.error}</p>}

      {failed > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Problem</th>
                <th className={th}>Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 align-top">
              {res.unprocessed.map((u, i) => (
                <tr key={i}>
                  <td className={td}>{u.code ?? "–"}</td>
                  <td className={td}>{u.error ?? "–"}</td>
                  <td className={`${td} break-all font-mono text-xs`}>{JSON.stringify(u.record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
