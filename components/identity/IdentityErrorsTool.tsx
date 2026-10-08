"use client";

import { Download, Loader2, UserCheck, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fetchCount } from "@/lib/clevertap/fetch-count";
import { IDENTITY_ROWS, identityQueries } from "@/lib/clevertap/identity-queries";
import type { Credentials } from "@/lib/clevertap/types";
import AccountFields, {
    useSelectedAccount,
} from "@/components/shared/AccountFields";
import { daysAgo, isoToInt } from "@/lib/utils/dates";
import { fmtPercent, ratio } from "@/lib/utils/format";
import { runPool } from "@/lib/utils/pool";
import {
    CopyTsvButton,
    ErrorBanner,
    Label,
    NumCell,
    PrimaryButton,
    SecondaryButton,
    inputClass,
    td,
    th,
    type Cell,
} from "@/components/shared/ui";

const CONCURRENCY = 3;

export default function IdentityErrorsTool() {
    const account = useSelectedAccount();
    const { current } = account;
    const { accountId, passcode, region } = current;
    const [from, setFrom] = useState(daysAgo(7));
    const [to, setTo] = useState(daysAgo(1));

    const [cells, setCells] = useState<Record<string, Cell>>({});
    // Which account the table below was fetched for (the form can change after)
    const [ranFor, setRanFor] = useState("");
    const [running, setRunning] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    async function run() {
        setFormError(null);
        const fromInt = isoToInt(from);
        const toInt = isoToInt(to);
        if (!accountId.trim() || !passcode.trim())
            return setFormError("Enter the Account ID and Passcode.");
        if (!fromInt || !toInt) return setFormError("Pick a valid date range.");
        if (fromInt > toInt)
            return setFormError("From date must be on or before To date.");

        const creds: Credentials = {
            accountId: accountId.trim(),
            passcode: passcode.trim(),
            region,
        };
        const queries = identityQueries();
        const controller = new AbortController();
        abortRef.current = controller;

        setRanFor(
            `${current.name.trim() || accountId.trim()} · ${region} · ${from} to ${to}`,
        );
        setRunning(true);
        setCells(
            Object.fromEntries(
                queries.map((q) => [q.key, { state: "loading" }]),
            ),
        );

        await runPool(
            queries.map(({ key, query }) => async () => {
                let cell: Cell;
                try {
                    const value = await fetchCount(
                        creds,
                        query,
                        { from: fromInt, to: toInt },
                        controller.signal,
                    );
                    cell = { state: "done", value };
                } catch (e) {
                    if (controller.signal.aborted) return;
                    cell = {
                        state: "error",
                        message: e instanceof Error ? e.message : "Failed",
                    };
                }
                setCells((prev) => ({ ...prev, [key]: cell }));
            }),
            CONCURRENCY,
            controller.signal,
        );
        setRunning(false);
    }

    function cancel() {
        abortRef.current?.abort();
        setRunning(false);
        setCells({});
    }

    const val = (key: string) => {
        const c = cells[key];
        return c?.state === "done" ? c.value : 0;
    };

    const { rows, totals, tsv } = useMemo(() => {
        const base = IDENTITY_ROWS.map((r) => {
            const sdk = val(`${r.label}:sdk`);
            const api = val(`${r.label}:api`);
            return { label: r.label, sdk, api, total: sdk + api };
        });
        const grand = base.reduce((s, r) => s + r.total, 0);
        const err = base.find((r) => r.label === "Identity Error")!;
        const t = {
            sdk: base.reduce((s, r) => s + r.sdk, 0),
            api: base.reduce((s, r) => s + r.api, 0),
            grand,
            err,
        };
        const tsv: (string | number)[][] = [
            ["Event", "SDK", "API", "Total", "Rate"],
            ...base.map((r) => [
                r.label,
                r.sdk,
                r.api,
                r.total,
                fmtPercent(ratio(r.total, grand)),
            ]),
            [
                "Identity Error %",
                err.sdk,
                err.api,
                err.total,
                fmtPercent(ratio(err.total, grand)),
            ],
            ["Total", t.sdk, t.api, grand, grand > 0 ? "100.00%" : "0.00%"],
        ];
        return { rows: base, totals: t, tsv };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cells]);

    const hasResults = Object.keys(cells).length > 0;
    const done = Object.values(cells).filter(
        (c) => c.state !== "loading",
    ).length;
    const total = Object.keys(cells).length;


    return (
        <div className="flex flex-col gap-6">
            <form
                className="grid gap-4 rounded-xl border border-gray-200 bg-white p-8 shadow-md sm:grid-cols-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    run();
                }}
            >
                <h2 className="flex items-center gap-3 text-xl font-semibold text-black sm:col-span-2">
                    <UserCheck size={24} />
                    CleverTap Account
                </h2>
                <AccountFields {...account} />
                <Label label="From">
                    <input
                        className={inputClass}
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </Label>
                <Label label="To">
                    <input
                        className={inputClass}
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </Label>
                <div className="flex items-center gap-3 pt-2 sm:col-span-2">
                    <PrimaryButton type="submit" disabled={running}>
                        {running ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        {running
                            ? `Fetching… (${done}/${total})`
                            : "Fetch data"}
                    </PrimaryButton>
                    {running && (
                        <SecondaryButton type="button" onClick={cancel}>
                            <X size={18} />
                            Cancel
                        </SecondaryButton>
                    )}
                    {hasResults && !running && <CopyTsvButton rows={tsv} />}
                </div>
            </form>

            {formError && <ErrorBanner>{formError}</ErrorBanner>}

            {hasResults && ranFor && (
                <p className="-mb-2 text-sm text-gray-600">
                    Results for{" "}
                    <span className="font-medium text-black">{ranFor}</span>
                </p>
            )}
            {hasResults && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className={th}>Event</th>
                                <th className={th}>SDK</th>
                                <th className={th}>API</th>
                                <th className={th}>Total</th>
                                <th className={th}>Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rows.map((r) => (
                                <tr key={r.label}>
                                    <td className={td}>{r.label}</td>
                                    <td className={td}>
                                        <NumCell
                                            cell={cells[`${r.label}:sdk`]}
                                        />
                                    </td>
                                    <td className={td}>
                                        <NumCell
                                            cell={cells[`${r.label}:api`]}
                                        />
                                    </td>
                                    <td className={td}>
                                        {r.total.toLocaleString("en-US")}
                                    </td>
                                    <td className={td}>
                                        {fmtPercent(
                                            ratio(r.total, totals.grand),
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-semibold">
                                <td className={td}>Total</td>
                                <td className={td}>
                                    {totals.sdk.toLocaleString("en-US")}
                                </td>
                                <td className={td}>
                                    {totals.api.toLocaleString("en-US")}
                                </td>
                                <td className={td}>
                                    {totals.grand.toLocaleString("en-US")}
                                </td>
                                <td className={td}>
                                    {totals.grand > 0 ? "100.00%" : "0.00%"}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
