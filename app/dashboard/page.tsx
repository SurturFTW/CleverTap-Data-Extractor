import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageTitle from "@/components/shared/PageTitle";
import { TOOLS } from "@/lib/tools";

export const metadata = { title: "Dashboard · CleverPort" };

export default function Page() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <PageTitle
                title="Dashboard"
                subtitle="Pick a tool to fetch or upload CleverTap data"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TOOLS.map((t) => (
                    <Link
                        key={t.href}
                        href={t.href}
                        className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-black hover:shadow-md"
                    >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white">
                            <t.icon size={20} />
                        </span>
                        <h2 className="text-lg font-semibold text-black">
                            {t.label}
                        </h2>
                        <p className="flex-1 text-sm text-gray-600">
                            {t.description}
                        </p>
                        <span className="flex items-center gap-1 text-sm font-medium text-black">
                            Open
                            <ArrowRight
                                size={16}
                                className="transition-transform group-hover:translate-x-1"
                            />
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
