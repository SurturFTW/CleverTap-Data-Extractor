/**
 * CleverTap Identity Events Reporter — Full Logging Version
 */

const CREDS_SHEET_NAME = "API Credentials";
const RESULTS_SHEET_NAME = "Error Data";

const COL_ACCOUNT_ID = 1;
const COL_PASSCODE = 2;
const COL_REGION = 3;
const COL_FROM_DATE = 4;
const COL_TO_DATE = 5;

// You said there are 2 header rows, so values are in row 3
const CREDS_DATA_ROW = 3;

const REGION_URLS = {
    in1: "https://in1.api.clevertap.com",
    eu1: "https://eu1.api.clevertap.com",
    us1: "https://us1.api.clevertap.com",
    sg1: "https://sg1.api.clevertap.com",
    mec1: "https://mec1.api.clevertap.com",
    aps3: "https://aps3.api.clevertap.com",
};

const IDENTITY_EVENTS = [
    {
        label: "Identity Set (New User)",
        event: "Identity Set",
        type: "new user",
    },
    {
        label: "Identity Set (Merged)",
        event: "Identity Set",
        type: "merged",
    },
    {
        label: "Identity Set (Appended)",
        event: "Identity Set",
        type: "appended",
    },
    {
        label: "Identity Error",
        event: "Identity Error",
        type: null,
    },
];

const POLL_WAIT_MS = 30000;
const POLL_MAX_TRIES = 10;

function fetchIdentityEvents() {
    try {
        Logger.log("========== SCRIPT START ==========");
        Logger.log(`Started at: ${new Date().toLocaleString()}`);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        Logger.log(`Spreadsheet name: ${ss.getName()}`);

        const config = getConfig(ss);
        if (!config) {
            Logger.log("Config validation failed. Stopping script.");
            return;
        }

        const resultsSheet = getOrCreateResultsSheet(ss);
        writeHeaders(resultsSheet);

        const results = [];

        for (const item of IDENTITY_EVENTS) {
            Logger.log("----------------------------------------");
            Logger.log(`Processing: ${item.label}`);
            Logger.log(`Event Name: ${item.event}`);
            Logger.log(`Type: ${item.type}`);
            Logger.log("----------------------------------------");

            const sdkCount = fetchEventCount(
                config,
                item.event,
                "sdk",
                item.type,
            );
            const apiCount = fetchEventCount(
                config,
                item.event,
                "api",
                item.type,
            );

            Logger.log(`SDK Count = ${sdkCount}`);
            Logger.log(`API Count = ${apiCount}`);

            results.push({
                event: item.label,
                sdk: sdkCount,
                api: apiCount,
            });

            Logger.log(
                `Result pushed: ${JSON.stringify(results[results.length - 1])}`,
            );
        }

        Logger.log("========== ALL RESULTS ==========");
        Logger.log(JSON.stringify(results));
        Logger.log("=================================");

        const grandTotal = results.reduce((sum, r) => sum + r.sdk + r.api, 0);
        Logger.log(`Grand Total = ${grandTotal}`);

        const DATA_START_ROW = 3;

        results.forEach((r, i) => {
            const total = r.sdk + r.api;
            const rate = grandTotal > 0 ? total / grandTotal : 0;
            const row = DATA_START_ROW + i;

            Logger.log(`Writing row ${row}`);
            Logger.log(`Row data: ${JSON.stringify(r)}`);
            Logger.log(`Total: ${total}`);
            Logger.log(`Rate: ${rate}`);

            resultsSheet.getRange(row, 1).setValue(r.event);
            resultsSheet
                .getRange(row, 2)
                .setValue(r.sdk)
                .setNumberFormat("#,##0");
            resultsSheet
                .getRange(row, 3)
                .setValue(r.api)
                .setNumberFormat("#,##0");
            resultsSheet
                .getRange(row, 4)
                .setValue(total)
                .setNumberFormat("#,##0");
            resultsSheet
                .getRange(row, 5)
                .setValue(rate)
                .setNumberFormat("0.00%");
        });

        const errorEntry = results.find((r) => r.event === "Identity Error");
        const errorSDK = errorEntry ? errorEntry.sdk : 0;
        const errorAPI = errorEntry ? errorEntry.api : 0;
        const errorTotal = errorSDK + errorAPI;
        const errorRate = grandTotal > 0 ? errorTotal / grandTotal : 0;

        Logger.log(`Identity Error SDK = ${errorSDK}`);
        Logger.log(`Identity Error API = ${errorAPI}`);
        Logger.log(`Identity Error Total = ${errorTotal}`);
        Logger.log(`Identity Error Rate = ${errorRate}`);

        const summaryRow = DATA_START_ROW + results.length + 1;

        resultsSheet
            .getRange(summaryRow, 1, 1, 5)
            .setBackground("#FCE8E6")
            .setFontWeight("bold");

        resultsSheet.getRange(summaryRow, 1).setValue("Identity Error %");
        resultsSheet
            .getRange(summaryRow, 2)
            .setValue(errorSDK)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(summaryRow, 3)
            .setValue(errorAPI)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(summaryRow, 4)
            .setValue(errorTotal)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(summaryRow, 5)
            .setValue(errorRate)
            .setNumberFormat("0.00%");

        const totalRow = summaryRow + 1;
        const totalSDK = results.reduce((s, r) => s + r.sdk, 0);
        const totalAPI = results.reduce((s, r) => s + r.api, 0);

        Logger.log(`TOTAL SDK = ${totalSDK}`);
        Logger.log(`TOTAL API = ${totalAPI}`);
        Logger.log(`TOTAL Overall = ${grandTotal}`);

        resultsSheet
            .getRange(totalRow, 1, 1, 5)
            .setBackground("#E8F0FE")
            .setFontWeight("bold");

        resultsSheet.getRange(totalRow, 1).setValue("Total");
        resultsSheet
            .getRange(totalRow, 2)
            .setValue(totalSDK)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(totalRow, 3)
            .setValue(totalAPI)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(totalRow, 4)
            .setValue(grandTotal)
            .setNumberFormat("#,##0");
        resultsSheet
            .getRange(totalRow, 5)
            .setValue(grandTotal > 0 ? 1 : 0)
            .setNumberFormat("0.00%");

        Logger.log("========== SCRIPT COMPLETE ==========");
        Logger.log(`Finished at: ${new Date().toLocaleString()}`);
        Logger.log("=====================================");

        SpreadsheetApp.getUi().alert(
            "Identity events data fetched successfully!",
        );
    } catch (e) {
        Logger.log("========== FATAL ERROR ==========");
        Logger.log(e.toString());
        Logger.log(e.stack);
        Logger.log("=================================");

        SpreadsheetApp.getUi().alert("Script failed:\n\n" + e.toString());
    }
}

function fetchEventCount(config, eventName, source, type) {
    const endpoint = `${getBaseUrl(config.region)}/1/counts/events.json`;

    const eventProperties = [
        {
            name: "source",
            operator: "equals",
            value: source,
        },
    ];

    if (type) {
        eventProperties.push({
            name: "type",
            operator: "equals",
            value: type,
        });
    }

    const payload = {
        event_name: eventName,
        from: config.from,
        to: config.to,
        event_properties: eventProperties,
    };

    Logger.log("========== API REQUEST ==========");
    Logger.log(`Endpoint: ${endpoint}`);
    Logger.log(`Event: ${eventName}`);
    Logger.log(`Source: ${source}`);
    Logger.log(`Type: ${type}`);
    Logger.log(`Payload: ${JSON.stringify(payload)}`);
    Logger.log("=================================");

    let data = postJson(endpoint, payload, config);

    Logger.log("========== API PARSED RESPONSE ==========");
    Logger.log(JSON.stringify(data));
    Logger.log("=========================================");

    if (data.status === "partial" && data.req_id) {
        Logger.log(`Partial response received. req_id=${data.req_id}`);
        data = pollForResult(config, data.req_id);
    }

    if (data.status === "success") {
        Logger.log(
            `Success count for event="${eventName}", source="${source}", type="${type}" = ${data.count || 0}`,
        );
        return data.count || 0;
    }

    Logger.log("========== API FAILURE ==========");
    Logger.log(`Event: ${eventName}`);
    Logger.log(`Source: ${source}`);
    Logger.log(`Type: ${type}`);
    Logger.log(`Failure Response: ${JSON.stringify(data)}`);
    Logger.log("=================================");

    return 0;
}

function postJson(endpoint, payload, config) {
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        headers: {
            "X-CleverTap-Account-Id": config.accountId,
            "X-CleverTap-Passcode": config.passcode,
        },
        muteHttpExceptions: true,
    };

    Logger.log("Sending POST request...");
    Logger.log(`URL: ${endpoint}`);

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseText = response.getContentText();

    Logger.log("========== RAW RESPONSE ==========");
    Logger.log(`HTTP Code: ${response.getResponseCode()}`);
    Logger.log(responseText);
    Logger.log("==================================");

    return JSON.parse(responseText);
}

function pollForResult(config, reqId) {
    const pollUrl = `${getBaseUrl(config.region)}/1/counts/events.json?req_id=${reqId}`;

    const options = {
        method: "get",
        headers: {
            "X-CleverTap-Account-Id": config.accountId,
            "X-CleverTap-Passcode": config.passcode,
        },
        muteHttpExceptions: true,
    };

    Logger.log("========== POLLING START ==========");
    Logger.log(`req_id: ${reqId}`);
    Logger.log(`Poll URL: ${pollUrl}`);

    for (let attempt = 1; attempt <= POLL_MAX_TRIES; attempt++) {
        Logger.log(`Polling attempt ${attempt}/${POLL_MAX_TRIES}`);
        Utilities.sleep(POLL_WAIT_MS);

        const response = UrlFetchApp.fetch(pollUrl, options);
        const responseText = response.getContentText();

        Logger.log(`Polling HTTP Code: ${response.getResponseCode()}`);
        Logger.log(`Polling raw response: ${responseText}`);

        const data = JSON.parse(responseText);

        Logger.log(`Polling parsed response: ${JSON.stringify(data)}`);

        if (data.status !== "partial") {
            Logger.log("Polling completed.");
            Logger.log("========== POLLING END ==========");
            return data;
        }
    }

    Logger.log("Polling timed out.");
    Logger.log("========== POLLING END ==========");

    return {
        status: "fail",
        error: "Polling timed out",
    };
}

function getConfig(ss) {
    const sheet = ss.getSheetByName(CREDS_SHEET_NAME);

    if (!sheet) {
        SpreadsheetApp.getUi().alert(`Sheet "${CREDS_SHEET_NAME}" not found.`);
        return null;
    }

    Logger.log(`Reading credentials from sheet: ${CREDS_SHEET_NAME}`);
    Logger.log(`Reading credentials from row: ${CREDS_DATA_ROW}`);

    const row = sheet.getRange(CREDS_DATA_ROW, 1, 1, 5).getValues()[0];

    Logger.log(`Raw credentials row: ${JSON.stringify(row)}`);

    const accountId = row[COL_ACCOUNT_ID - 1].toString().trim();
    const passcode = row[COL_PASSCODE - 1].toString().trim();
    const region = row[COL_REGION - 1].toString().trim().toLowerCase();
    const fromRaw = row[COL_FROM_DATE - 1];
    const toRaw = row[COL_TO_DATE - 1];

    Logger.log("========== CONFIG RAW ==========");
    Logger.log(`Account ID raw: ${row[COL_ACCOUNT_ID - 1]}`);
    Logger.log(`Passcode raw: ${passcode ? "[PRESENT]" : "[MISSING]"}`);
    Logger.log(`Region raw: ${row[COL_REGION - 1]}`);
    Logger.log(`From raw: ${fromRaw}`);
    Logger.log(`To raw: ${toRaw}`);
    Logger.log("================================");

    if (!accountId || !passcode) {
        SpreadsheetApp.getUi().alert(
            `Please fill in Account ID and Passcode in row ${CREDS_DATA_ROW} of "${CREDS_SHEET_NAME}".`,
        );
        return null;
    }

    if (!REGION_URLS[region]) {
        SpreadsheetApp.getUi().alert(
            `Unknown region "${region}" in "${CREDS_SHEET_NAME}".\n` +
                `Valid values: ${Object.keys(REGION_URLS).join(", ")}`,
        );
        return null;
    }

    const from = dateToInt(fromRaw);
    const to = dateToInt(toRaw);

    Logger.log("========== CONFIG PARSED ==========");
    Logger.log(`Account ID: ${accountId}`);
    Logger.log(`Passcode: [HIDDEN]`);
    Logger.log(`Region: ${region}`);
    Logger.log(`From: ${from}`);
    Logger.log(`To: ${to}`);
    Logger.log("===================================");

    if (!from || !to) {
        SpreadsheetApp.getUi().alert(
            `Invalid From/To dates in "${CREDS_SHEET_NAME}".\n` +
                "Enter dates as YYYYMMDD or use a Date-formatted cell.",
        );
        return null;
    }

    if (from > to) {
        SpreadsheetApp.getUi().alert(
            "From Date must be before or equal to To Date.",
        );
        return null;
    }

    return {
        accountId,
        passcode,
        region,
        from,
        to,
    };
}

function getOrCreateResultsSheet(ss) {
    let sheet = ss.getSheetByName(RESULTS_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(RESULTS_SHEET_NAME);
    }

    // Only clear values
    sheet.clearContents();

    return sheet;
}

function writeHeaders(sheet) {
    const headers = ["Event", "SDK", "API", "Total", "Rate"];

    headers.forEach((h, i) => {
        sheet.getRange(2, i + 1).setValue(h);
    });
}

function getBaseUrl(region) {
    const baseUrl = REGION_URLS[region];
    Logger.log(`Base URL for region "${region}" = ${baseUrl}`);
    return baseUrl;
}

function dateToInt(value) {
    Logger.log(`dateToInt input: ${value}`);

    if (!value && value !== 0) {
        Logger.log("dateToInt result: null");
        return null;
    }

    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        const result = parseInt(`${y}${m}${d}`, 10);

        Logger.log(`dateToInt Date object result: ${result}`);
        return result;
    }

    const str = value.toString().trim();
    Logger.log(`dateToInt string value: ${str}`);

    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const y = slashMatch[3];
        const m = slashMatch[1].padStart(2, "0");
        const d = slashMatch[2].padStart(2, "0");
        const result = parseInt(`${y}${m}${d}`, 10);

        Logger.log(`dateToInt slash date result: ${result}`);
        return result;
    }

    const dashMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dashMatch) {
        const result = parseInt(
            `${dashMatch[1]}${dashMatch[2]}${dashMatch[3]}`,
            10,
        );

        Logger.log(`dateToInt dash date result: ${result}`);
        return result;
    }

    const n = parseInt(str.replace(/[-\/]/g, ""), 10);
    const result = isNaN(n) || n < 19000101 ? null : n;

    Logger.log(`dateToInt numeric result: ${result}`);
    return result;
}

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu("CleverTap")
        .addItem("Fetch Identity Events", "fetchIdentityEvents")
        .addToUi();
}
