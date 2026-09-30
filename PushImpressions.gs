const EVENT_SENT = "Notification Sent";
const EVENT_IMPRESSION = "Push Impressions";

const MODE_ALL = "ALL";
const MODE_TOTAL = "TOTAL";
const MODE_ANDROID = "ANDROID";
const MODE_IOS = "IOS";

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu("Fetch Data")
        .addItem("Update All", "updateAll")
        .addSeparator()
        .addItem("Update Total Only", "updateTotalOnly")
        .addItem("Update Android Only", "updateAndroidOnly")
        .addItem("Update iOS Only", "updateIosOnly")
        .addToUi();
}

function updateAll() {
    updatePushDashboard(MODE_ALL);
}

function updateTotalOnly() {
    updatePushDashboard(MODE_TOTAL);
}

function updateAndroidOnly() {
    updatePushDashboard(MODE_ANDROID);
}

function updateIosOnly() {
    updatePushDashboard(MODE_IOS);
}

function updatePushDashboard(mode) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const credentialsSheet = ss.getSheetByName("API Credentials");
    const dashboardSheet = ss.getSheetByName("Event Data");
    const ui = SpreadsheetApp.getUi();

    const credentials = credentialsSheet.getDataRange().getValues();

    if (dashboardSheet.getLastRow() > 1) {
        dashboardSheet
            .getRange(2, 1, dashboardSheet.getLastRow() - 1, 11)
            .clearContent();
    }

    const accounts = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 2; i < credentials.length; i++) {
        const [name, accountId, passcode, region, fromDate, toDate] =
            credentials[i];

        if (
            !name &&
            !accountId &&
            !passcode &&
            !region &&
            !fromDate &&
            !toDate
        ) {
            continue;
        }

        accounts.push({
            rowNumber: i + 1,
            name: name || `Row ${i + 1}`,
            accountId,
            passcode,
            region,
            fromDate,
            toDate,
            isComplete: !!(
                name &&
                accountId &&
                passcode &&
                region &&
                fromDate &&
                toDate
            ),
        });
    }

    if (accounts.length === 0) {
        ui.alert("CleverTap Dashboard", "No accounts found.", ui.ButtonSet.OK);
        return;
    }

    const initialRows = accounts.map((account) => [
        account.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        account.isComplete ? "PENDING" : "INCOMPLETE",
    ]);

    dashboardSheet
        .getRange(2, 1, initialRows.length, 11)
        .setValues(initialRows);
    SpreadsheetApp.flush();

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const dashboardRow = i + 2;

        if (!account.isComplete) {
            Logger.log(`Skipping incomplete row ${account.rowNumber}`);
            failedCount++;
            continue;
        }

        dashboardSheet.getRange(dashboardRow, 11).setValue("LOADING...");
        SpreadsheetApp.flush();

        try {
            const counts = getCountsByMode(
                account.accountId,
                account.passcode,
                account.region,
                account.fromDate,
                account.toDate,
                mode,
            );

            writeCountsToDashboard(
                dashboardSheet,
                dashboardRow,
                account.name,
                counts,
                mode,
            );

            dashboardSheet.getRange(dashboardRow, 11).setValue("DONE");
            SpreadsheetApp.flush();

            successCount++;
        } catch (e) {
            Logger.log(`ERROR for ${account.name}: ${e}`);
            dashboardSheet.getRange(dashboardRow, 11).setValue("FAILED");
            SpreadsheetApp.flush();

            failedCount++;
        }
    }

    ui.alert(
        "CleverTap Dashboard",
        `Processing completed.

Mode: ${mode}
Successful: ${successCount}
Failed / Incomplete: ${failedCount}`,
        ui.ButtonSet.OK,
    );
}

function getCountsByMode(accountId, passcode, region, fromDate, toDate, mode) {
    const requests = [];

    if (mode === MODE_ALL || mode === MODE_TOTAL) {
        requests.push({
            key: "totalSent",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_SENT,
                [
                    {
                        name: "Campaign Type",
                        operator: "equals",
                        value: ["Mobile Push - Android", "Mobile Push - iOS"],
                    },
                ],
                null,
                fromDate,
                toDate,
            ),
        });

        requests.push({
            key: "totalImpressions",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_IMPRESSION,
                null,
                null,
                fromDate,
                toDate,
            ),
        });
    }

    if (mode === MODE_ALL || mode === MODE_ANDROID) {
        requests.push({
            key: "androidSent",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_SENT,
                [
                    {
                        name: "Campaign Type",
                        operator: "equals",
                        value: "Mobile Push - Android",
                    },
                ],
                null,
                fromDate,
                toDate,
            ),
        });

        requests.push({
            key: "androidImpressions",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_IMPRESSION,
                null,
                [
                    {
                        name: "OS",
                        operator: "equals",
                        value: ["Android"],
                    },
                ],
                fromDate,
                toDate,
            ),
        });
    }

    if (mode === MODE_ALL || mode === MODE_IOS) {
        requests.push({
            key: "iosSent",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_SENT,
                [
                    {
                        name: "Campaign Type",
                        operator: "equals",
                        value: "Mobile Push - iOS",
                    },
                ],
                null,
                fromDate,
                toDate,
            ),
        });

        requests.push({
            key: "iosImpressions",
            request: buildRequest(
                accountId,
                passcode,
                region,
                EVENT_IMPRESSION,
                null,
                [
                    {
                        name: "OS",
                        operator: "equals",
                        value: ["iOS"],
                    },
                ],
                fromDate,
                toDate,
            ),
        });
    }

    const responses = fetchAllInBatches(
        requests.map((item) => item.request),
        3,
    );

    const counts = {};

    responses.forEach((response, index) => {
        const text = response.getContentText();
        Logger.log(`Response ${index + 1}: ${text}`);

        const result = JSON.parse(text);
        const key = requests[index].key;

        if (result.status === "success") {
            counts[key] = result.count || 0;
        } else if (result.status === "partial") {
            counts[key] = pollEventCount(
                accountId,
                passcode,
                region,
                result.req_id,
            );
        } else {
            throw new Error(text);
        }
    });

    return counts;
}

function fetchAllInBatches(requestList, batchSize) {
    const allResponses = [];

    for (let i = 0; i < requestList.length; i += batchSize) {
        const batch = requestList.slice(i, i + batchSize);

        Logger.log(
            `Running batch ${Math.floor(i / batchSize) + 1} with ${batch.length} requests`,
        );

        const batchResponses = UrlFetchApp.fetchAll(batch);
        allResponses.push(...batchResponses);

        if (i + batchSize < requestList.length) {
            Utilities.sleep(1000);
        }
    }

    return allResponses;
}

function writeCountsToDashboard(sheet, row, name, counts, mode) {
    const existing = sheet.getRange(row, 1, 1, 11).getValues()[0];

    existing[0] = name;

    if (mode === MODE_ALL || mode === MODE_TOTAL) {
        existing[1] = counts.totalImpressions || 0;
        existing[2] = counts.totalSent || 0;
        existing[3] = calculatePercent(existing[1], existing[2]);
    }

    if (mode === MODE_ALL || mode === MODE_ANDROID) {
        existing[4] = counts.androidSent || 0;
        existing[5] = counts.androidImpressions || 0;
        existing[6] = calculatePercent(existing[5], existing[4]);
    }

    if (mode === MODE_ALL || mode === MODE_IOS) {
        existing[7] = counts.iosSent || 0;
        existing[8] = counts.iosImpressions || 0;
        existing[9] = calculatePercent(existing[8], existing[7]);
    }

    sheet.getRange(row, 1, 1, 11).setValues([existing]);
    formatPercentColumns(sheet, row);
}

function buildRequest(
    accountId,
    passcode,
    region,
    eventName,
    eventProperties,
    technographics,
    fromDate,
    toDate,
) {
    const payload = {
        event_name: eventName,
        from: Number(formatDateForCleverTap(fromDate)),
        to: Number(formatDateForCleverTap(toDate)),
    };

    if (eventProperties && eventProperties.length > 0) {
        payload.event_properties = eventProperties;
    }

    if (technographics && technographics.length > 0) {
        payload.common_profile_properties = {
            technographics: technographics,
        };
    }

    Logger.log(`Request: ${eventName} | ${JSON.stringify(payload)}`);

    return {
        url: `https://${region}.api.clevertap.com/1/counts/events.json`,
        method: "post",
        contentType: "application/json",
        headers: {
            "X-CleverTap-Account-Id": accountId,
            "X-CleverTap-Passcode": passcode,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
    };
}

function pollEventCount(accountId, passcode, region, reqId) {
    Utilities.sleep(10000);

    const response = UrlFetchApp.fetch(
        `https://${region}.api.clevertap.com/1/counts/events.json?req_id=${reqId}`,
        {
            method: "get",
            headers: {
                "X-CleverTap-Account-Id": accountId,
                "X-CleverTap-Passcode": passcode,
            },
            muteHttpExceptions: true,
        },
    );

    const text = response.getContentText();
    Logger.log(`Poll response: ${text}`);

    const result = JSON.parse(text);

    if (result.status === "success") return result.count || 0;

    if (result.status === "partial") {
        return pollEventCount(accountId, passcode, region, reqId);
    }

    throw new Error(text);
}

function calculatePercent(impressions, sent) {
    if (!sent || sent === 0) return 0;
    return impressions / sent;
}

function formatPercentColumns(sheet, row) {
    sheet.getRange(row, 4).setNumberFormat("0.00%");
    sheet.getRange(row, 7).setNumberFormat("0.00%");
    sheet.getRange(row, 10).setNumberFormat("0.00%");
}

function formatDateForCleverTap(value) {
    if (!value) throw new Error("Missing date");

    if (
        Object.prototype.toString.call(value) === "[object Date]" &&
        !isNaN(value)
    ) {
        return Utilities.formatDate(
            value,
            Session.getScriptTimeZone(),
            "yyyyMMdd",
        );
    }

    if (typeof value === "number") {
        const valueString = String(Math.floor(value));
        if (/^\d{8}$/.test(valueString)) return valueString;
    }

    const parsedDate = new Date(value);

    if (!isNaN(parsedDate)) {
        return Utilities.formatDate(
            parsedDate,
            Session.getScriptTimeZone(),
            "yyyyMMdd",
        );
    }

    throw new Error(`Invalid date value: ${value}`);
}
