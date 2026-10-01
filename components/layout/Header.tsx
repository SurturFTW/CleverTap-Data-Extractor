"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export default function Header() {
    const pathname = usePathname();
    return (
        <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
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
                    <Link
                        href="/dashboard"
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4 ${
                            pathname === "/dashboard"
                                ? "bg-black text-white"
                                : "border border-black text-black hover:bg-gray-50"
                        }`}
                    >
                        <LayoutDashboard size={16} />
                        <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                </nav>
            </div>
        </header>
    );
}
