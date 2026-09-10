"use client";

import { useState } from "react";
import { REGION_OPTIONS } from "@/lib/regions";

const IDENTITY_FIELDS = ["Email", "Phone", "Identity"];

function toYyyymmdd(dateStr) {
  return Number(dateStr.replaceAll("-", ""));
}

function EventTag({ name, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
      {name}
      <button
        type="button"
        onClick={onRemove}
        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </span>
  );
}

export default function Home() {
  const [region, setRegion] = useState(REGION_OPTIONS[0]?.value ?? "eu");
  const [accountId, setAccountId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [eventInput, setEventInput] = useState("");
  const [eventNames, setEventNames] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [identityField, setIdentityField] = useState(IDENTITY_FIELDS[0]);
  const [identityValue, setIdentityValue] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  function addEvent() {
    const name = eventInput.trim();
    if (name && !eventNames.includes(name)) {
      setEventNames([...eventNames, name]);
    }
    setEventInput("");
  }

  function removeEvent(name) {
    setEventNames(eventNames.filter((n) => n !== name));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResults(null);

    if (eventNames.length === 0) {
      setError("Add at least one event to search for.");
      return;
    }
    if (!from || !to) {
      setError("Pick a from and to date.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/clevertap-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          accountId,
          passcode,
          eventNames,
          from: toYyyymmdd(from),
          to: toYyyymmdd(to),
          identityField,
          identityValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed.");
      }
      setResults(data.results);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 py-16 px-6">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            CleverTap Event Lookup
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Look up a single user&apos;s event history via the CleverTap Events
            API. Credentials are sent to your own server for this request only
            and are not stored.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              CleverTap account
            </legend>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Account ID
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Passcode
              </label>
              <input
                type="password"
                autoComplete="off"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              User to look up
            </legend>
            <div className="flex gap-3">
              <select
                value={identityField}
                onChange={(e) => setIdentityField(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {IDENTITY_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={
                  identityField === "Email"
                    ? "jane@example.com"
                    : identityField === "Phone"
                    ? "+15551234567"
                    : "identity value"
                }
                value={identityValue}
                onChange={(e) => setIdentityValue(e.target.value)}
                required
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Events &amp; date range
            </legend>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Events (CleverTap fetches one event type per request, so add
                each one you want)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={eventInput}
                  onChange={(e) => setEventInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEvent();
                    }
                  }}
                  placeholder="e.g. App Launched"
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={addEvent}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Add
                </button>
              </div>
              {eventNames.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {eventNames.map((name) => (
                    <EventTag
                      key={name}
                      name={name}
                      onRemove={() => removeEvent(name)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm text-zinc-600 dark:text-zinc-400">
                  From
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm text-zinc-600 dark:text-zinc-400">
                  To
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {loading ? "Fetching…" : "Fetch events"}
          </button>
        </form>

        {results && <Results results={results} />}
      </main>
    </div>
  );
}

function Results({ results }) {
  return (
    <div className="flex flex-col gap-6">
      {Object.entries(results).map(([eventName, data]) => (
        <div
          key={eventName}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            {eventName}
          </h2>
          {data.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {data.error}
            </p>
          )}
          {!data.error && data.records.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              No matching events in this date range.
            </p>
          )}
          {!data.error && data.records.length > 0 && (
            <>
              {data.truncated && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Result set was very large and got cut off. Narrow the date
                  range for a complete view.
                </p>
              )}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">Event props</th>
                      <th className="py-2 pr-4">Session props</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((record, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-100 align-top dark:border-zinc-900"
                      >
                        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs">
                          {record.ts}
                        </td>
                        <td className="py-2 pr-4">
                          <pre className="whitespace-pre-wrap font-mono text-xs">
                            {JSON.stringify(record.event_props ?? {}, null, 2)}
                          </pre>
                        </td>
                        <td className="py-2 pr-4">
                          <pre className="whitespace-pre-wrap font-mono text-xs">
                            {JSON.stringify(record.session_props ?? {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
