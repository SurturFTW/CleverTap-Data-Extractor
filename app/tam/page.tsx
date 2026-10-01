import PageTitle from "@/components/shared/PageTitle";
import TamTracker from "@/components/tam/TamTracker";

export const metadata = {
  title: "TAM Tracker · CleverPort",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle
        title="TAM Tracker"
        subtitle="Quarterly audit, identity error and push impression health for each TAM's accounts"
      />
      <TamTracker />
    </div>
  );
}
