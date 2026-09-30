import PushImpressionsTool from "@/components/push/PushImpressionsTool";
import PageTitle from "@/components/shared/PageTitle";

export const metadata = { title: "Push Impressions · CleverPort" };

export default function Page() {
    return (
        <div className="mx-auto w-full max-w-6xl">
            <PageTitle
                title="Push Impressions"
                subtitle="Notifications sent vs. push impressions, by platform"
            />
            <PushImpressionsTool />
        </div>
    );
}
