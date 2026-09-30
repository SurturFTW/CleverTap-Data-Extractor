import PageTitle from "@/components/shared/PageTitle";
import UploadTool from "@/components/upload/UploadTool";

export const metadata = { title: "Upload · CleverPort" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle
        title="Upload Data"
        subtitle="Add or update user profiles, or send events with their properties"
      />
      <UploadTool />
    </div>
  );
}
