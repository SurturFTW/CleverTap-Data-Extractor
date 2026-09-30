import { BellRing, Hash, Upload, UserCheck, UserSearch } from "lucide-react";

export const TOOLS = [
    {
        href: "/identity-errors",
        label: "Identity Errors",
        description: "Find profiles affected by identity and merge errors",
        icon: UserCheck,
    },
    {
        href: "/push-impressions",
        label: "Push Impressions",
        description: "Check push notification impressions and delivery",
        icon: BellRing,
    },
    {
        href: "/user-data",
        label: "User Data",
        description: "Look up a user's profile and event history",
        icon: UserSearch,
    },
    {
        href: "/counts",
        label: "Counts",
        description: "Event and profile counts over a date range",
        icon: Hash,
    },
    {
        href: "/upload",
        label: "Upload",
        description: "Upload user profiles and events in bulk",
        icon: Upload,
    },
];
