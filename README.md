# CleverTap Data Extractor (CleverPort)

A Next.js app that lets anyone on the team pull CleverTap data without a Google Sheet.
It replaces the old Apps Script reports (`IdentityErrors.gs`, `PushImpressions.gs`).

| Page | What it does |
| --- | --- |
| `/identity-errors` | Identity Set (new / merged / appended) and Identity Error counts, split by SDK vs API |
| `/push-impressions` | Notification Sent vs Push Impressions per account, for total / Android / iOS |
| `/user-data` | A user's profile, or their events (by email or phone; leave empty for all users) |

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Credentials

Enter your CleverTap Account ID, Passcode and region in the UI. They are saved in your
browser's `localStorage` (shared by all pages) and sent with each request to the
server routes under `app/api/clevertap/`, which forward them to CleverTap. The server
does not store or log them.

## Notes

- The server routes are stateless proxies with a fixed region whitelist. Polling and
  cursor paging are driven from the browser so each request stays short.
- The Get Events API cannot filter by user on its own. The export request asks
  CleverTap to filter by Email/Phone; every returned record is re-checked against the
  lookup, and the export falls back to an unfiltered scan if the filter is rejected.
