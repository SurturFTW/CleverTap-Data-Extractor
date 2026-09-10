import { fetchEventRecords } from "@/lib/clevertap";

export async function POST(request) {
  const body = await request.json();
  const {
    region,
    accountId,
    passcode,
    eventNames,
    from,
    to,
    identityField,
    identityValue,
  } = body || {};

  if (!accountId || !passcode) {
    return Response.json(
      { error: "Account ID and passcode are required." },
      { status: 400 }
    );
  }
  if (!Array.isArray(eventNames) || eventNames.length === 0) {
    return Response.json(
      { error: "Select at least one event." },
      { status: 400 }
    );
  }
  if (!from || !to) {
    return Response.json(
      { error: "A date range is required." },
      { status: 400 }
    );
  }
  if (!identityField || !identityValue) {
    return Response.json(
      { error: "An identity field and value are required." },
      { status: 400 }
    );
  }

  const results = {};

  for (const eventName of eventNames) {
    try {
      const { records, truncated } = await fetchEventRecords({
        region,
        accountId,
        passcode,
        eventName,
        from,
        to,
        identityField,
        identityValue,
      });
      results[eventName] = { records, truncated };
    } catch (err) {
      results[eventName] = { error: err.message || "Request failed." };
    }
  }

  return Response.json({ results });
}
