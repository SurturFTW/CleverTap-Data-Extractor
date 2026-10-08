import IdentityErrorsTool from "@/components/identity/IdentityErrorsTool";
import ToolPage from "@/components/shared/ToolPage";

export const metadata = { title: "Identity Errors · CleverPort" };

export default function Page() {
  return (
    <ToolPage
      title="Identity Events"
      subtitle="Identity Set and Identity Error counts, split by SDK vs API"
    >
      <IdentityErrorsTool />
    </ToolPage>
  );
}
