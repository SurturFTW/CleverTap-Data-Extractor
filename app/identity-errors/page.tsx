import IdentityErrorsTool from "@/components/identity/IdentityErrorsTool";
import PageTitle from "@/components/shared/PageTitle";

export const metadata = { title: "Identity Errors · CleverPort" };

export default function Page() {
    return (
        <div className="mx-auto w-full max-w-4xl">
            <PageTitle
                title="Identity Events"
                subtitle="Identity Set and Identity Error counts, split by SDK vs API"
            />
            <IdentityErrorsTool />
        </div>
    );
}
