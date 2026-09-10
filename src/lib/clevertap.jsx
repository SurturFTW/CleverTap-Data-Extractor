import { REGIONS } from "@/lib/regions";

function baseUrl(region) {
    const r = REGIONS[region] || REGIONS.eu;
    return `https://${r.host}/1/events.json`;
}

// CleverTap returns HTTP 202 while a batch is still being prepared server-side.
const POLL_DELAY_MS = 2000;
const MAX_POLL_ATTEMPTS = 10;
const MAX_PAGES_PER_EVENT = 20;

async function ctRequest({ url, method, accountId, passcode, body }) {
    const res = await fetch(url, {
        method,
        headers: {
            "X-CleverTap-Account-Id": accountId,
            "X-CleverTap-Passcode": passcode,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            `Unexpected response from CleverTap (HTTP ${res.status}): ${text.slice(0, 200)}`,
        );
    }

    if (res.status === 202) {
        return { pending: true, json };
    }

    if (!res.ok || json.status === "fail") {
        throw new Error(
            json.error ||
                json.message ||
                `CleverTap request failed (HTTP ${res.status})`,
        );
    }

    return { pending: false, json };
}

async function withPolling(makeRequest) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const result = await makeRequest();
        if (!result.pending) return result.json;
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    }
    throw new Error(
        "CleverTap kept the batch in a pending state for too long. Try again shortly.",
    );
}

// Fetches every record for a single event name matching the given identity filter,
// following the cursor until CleverTap stops returning `next_cursor`.
export async function fetchEventRecords({
    region,
    accountId,
    passcode,
    eventName,
    from,
    to,
    identityField,
    identityValue,
}) {
    const url = `${baseUrl(region)}?app=false&profile=false&event=false`;

    const initial = await withPolling(() =>
        ctRequest({
            url,
            method: "POST",
            accountId,
            passcode,
            body: {
                event_name: eventName,
                common_profile_properties: {
                    profile_fields: [
                        {
                            name: identityField,
                            operator: "equals",
                            value: identityValue,
                        },
                    ],
                },
                from,
                to,
            },
        }),
    );

    const records = [];
    let cursor = initial.cursor;
    let pages = 0;
    let truncated = false;

    while (cursor) {
        if (pages >= MAX_PAGES_PER_EVENT) {
            truncated = true;
            break;
        }
        pages += 1;

        // `cursor` is already percent-encoded by CleverTap; re-encoding it here
        // would double-encode it (e.g. `%2F` -> `%252F`) and invalidate it.
        const cursorUrl = `${baseUrl(region)}?cursor=${cursor}`;
        const page = await withPolling(() =>
            ctRequest({ url: cursorUrl, method: "POST", accountId, passcode }),
        );

        if (Array.isArray(page.records)) {
            records.push(...page.records);
        }
        cursor = page.next_cursor;
    }

    return { records, truncated };
}
