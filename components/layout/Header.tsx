import Link from "next/link";
import Image from "next/image";

export default function Header() {
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
            </div>
        </header>
    );
}
