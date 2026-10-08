import PushImpressionsTool from "@/components/push/PushImpressionsTool";
import ToolPage from "@/components/shared/ToolPage";

export const metadata = { title: "Push Impressions · CleverPort" };

export default function Page() {
  return (
    <ToolPage
      title="Push Impressions"
      subtitle="Notifications sent vs. push impressions, by platform"
    >
      <PushImpressionsTool />
    </ToolPage>
  );
}
