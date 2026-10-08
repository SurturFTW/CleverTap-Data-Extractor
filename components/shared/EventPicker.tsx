"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { inputClass } from "@/components/shared/ui";

export const EVENT_SUGGESTIONS = [
    "App Launched",
    "Identity Error",
    "Identity Set",
    "Notification Viewed",
    "Notification Clicked",
    "UTM Visited",
    "Push Unregistered",
    "Reachable By",
];

/** Multi-select of event names: suggestion chips plus free-text entry. */
export default function EventPicker({
    value,
    onChange,
    input,
    onInputChange,
}: {
    value: string[];
    onChange: (names: string[]) => void;
    /** Text typed but not yet added; the parent includes it on submit. */
    input: string;
    onInputChange: (v: string) => void;
}) {
    const [focused, setFocused] = useState(false);

    const add = (raw: string) => {
        const names = raw
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean);
        if (names.length === 0) return;
        onChange(Array.from(new Set([...value, ...names])));
        onInputChange("");
    };
    const remove = (name: string) => onChange(value.filter((n) => n !== name));
    const toggle = (name: string) =>
        value.includes(name) ? remove(name) : add(name);

    return (
        <div className="flex flex-col gap-2">
            <div
                className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2 ${
                    focused
                        ? "border-black ring-1 ring-black"
                        : "border-gray-300"
                }`}
            >
                {value.map((n) => (
                    <span
                        key={n}
                        className="flex items-center gap-1 rounded-lg bg-black px-2.5 py-1 text-sm text-white"
                    >
                        {n}
                        <button
                            type="button"
                            onClick={() => remove(n)}
                            aria-label={`Remove ${n}`}
                            className="text-white/70 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
                <input
                    className={`${inputClass} !w-auto min-w-[10rem] flex-1 !border-0 !p-1 !ring-0`}
                    value={input}
                    placeholder={
                        value.length
                            ? "Add another event…"
                            : "Type an event name"
                    }
                    onChange={(e) => onInputChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        add(input);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            add(input);
                        } else if (
                            e.key === "Backspace" &&
                            !input &&
                            value.length
                        ) {
                            remove(value[value.length - 1]);
                        }
                    }}
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {EVENT_SUGGESTIONS.filter((n) => !value.includes(n)).map(
                    (n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => toggle(n)}
                            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                            <Plus size={12} />
                            {n}
                        </button>
                    ),
                )}
            </div>
        </div>
    );
}
