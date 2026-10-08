import UploadTool from "@/components/upload/UploadTool";
import ToolPage from "@/components/shared/ToolPage";

export const metadata = { title: "Upload · CleverPort" };

export default function Page() {
  return (
    <ToolPage
      title="Upload Data"
      subtitle="Add or update user profiles, or send events with their properties"
    >
      <UploadTool />
    </ToolPage>
  );
}
