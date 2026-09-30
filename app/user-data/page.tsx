import PageTitle from "@/components/shared/PageTitle";
import UserDataTool from "@/components/user/UserDataTool";

export const metadata = { title: "User Data · CleverPort" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle
        title="User Data"
        subtitle="Look up a user’s profile or their events"
      />
      <UserDataTool />
    </div>
  );
}
