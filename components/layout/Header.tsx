"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BellRing, Hash, UserCheck, UserSearch } from "lucide-react";

const LINKS = [
    { href: "/identity-errors", label: "Identity Errors", icon: UserCheck },
    { href: "/push-impressions", label: "Push Impressions", icon: BellRing },
    { href: "/user-data", label: "User Data", icon: UserSearch },
    { href: "/counts", label: "Counts", icon: Hash },
];

export default function Header() {
    const pathname = usePathname();
    return (
        <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white">
                        <Image
                            src="/icon.png"
                            alt="CleverPort Logo"
                            width={30}
                            height={30}
                        />
                    </span>
                    <span className="text-lg font-bold text-black">
                        CleverPort
                    </span>
                </Link>
                <nav className="flex items-center gap-3">
                    {LINKS.map((l) => {
                        const active = pathname === l.href;
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                    active
                                        ? "bg-black text-white"
                                        : "border border-black text-black hover:bg-gray-50"
                                }`}
                            >
                                <l.icon size={16} />
                {l.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
