import UserDataTool from "@/components/user/UserDataTool";
import ToolPage from "@/components/shared/ToolPage";

export const metadata = { title: "User Data · CleverPort" };

export default function Page() {
  return (
    <ToolPage
      title="User Data"
      subtitle="Look up a user’s profile or their events"
    >
      <UserDataTool />
    </ToolPage>
  );
}
