import CountsTool from "@/components/counts/CountsTool";
import ToolPage from "@/components/shared/ToolPage";

export const metadata = { title: "Counts · CleverPort" };

export default function Page() {
  return (
    <ToolPage
      title="Event & Profile Counts"
      subtitle="How many times events happened, and how many profiles did them"
    >
      <CountsTool />
    </ToolPage>
  );
}
