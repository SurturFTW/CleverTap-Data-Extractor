import CountsTool from "@/components/counts/CountsTool";
import PageTitle from "@/components/shared/PageTitle";

export const metadata = { title: "Counts · CleverPort" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle
        title="Event & Profile Counts"
        subtitle="How many times events happened, and how many profiles did them"
      />
      <CountsTool />
    </div>
  );
}
