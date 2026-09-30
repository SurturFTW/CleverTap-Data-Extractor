"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FilterOperator, PropertyFilter } from "@/lib/clevertap/types";
import { SecondaryButton, inputClass } from "@/components/shared/ui";

const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "gte", label: "greater than or equal", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "lte", label: "less than or equal", needsValue: true },
  { value: "exists", label: "exists", needsValue: false },
  { value: "not_exists", label: "does not exist", needsValue: false },
];
const NUMERIC: FilterOperator[] = ["gt", "gte", "lt", "lte"];

export type FilterRow = { id: string; name: string; operator: FilterOperator; value: string };

const newFilter = (): FilterRow => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  operator: "equals",
  value: "",
});

/** Validates the rows and converts them to API filters, or returns an error message. */
export function buildFilters(rows: FilterRow[]): PropertyFilter[] | string {
  const out: PropertyFilter[] = [];
  for (const f of rows) {
    const op = OPERATORS.find((o) => o.value === f.operator)!;
    if (!f.name.trim()) return "Each property filter needs a property name.";
    if (op.needsValue && !f.value.trim())
      return `Enter a value for the “${f.name}” filter.`;
    if (NUMERIC.includes(f.operator) && !Number.isFinite(Number(f.value)))
      return `“${f.name}” ${op.label} needs a number.`;
    out.push({
      name: f.name.trim(),
      operator: f.operator,
      ...(op.needsValue && {
        value: NUMERIC.includes(f.operator) ? Number(f.value) : f.value.trim(),
      }),
    });
  }
  return out;
}

export default function PropertyFilters({
  filters,
  onChange,
  hint,
}: {
  filters: FilterRow[];
  onChange: (f: FilterRow[]) => void;
  hint: string;
}) {
  const patch = (id: string, p: Partial<FilterRow>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <p className="text-sm font-medium text-gray-700">
        Event property filters <span className="font-normal text-gray-500">({hint})</span>
      </p>
      {filters.map((f) => {
        const needsValue = OPERATORS.find((o) => o.value === f.operator)!.needsValue;
        return (
          <div key={f.id} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_1fr_auto]">
            <input
              className={inputClass}
              placeholder="Property name"
              value={f.name}
              onChange={(e) => patch(f.id, { name: e.target.value })}
            />
            <select
              className={inputClass}
              value={f.operator}
              onChange={(e) => patch(f.id, { operator: e.target.value as FilterOperator })}
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder={needsValue ? "Value" : "—"}
              disabled={!needsValue}
              value={needsValue ? f.value : ""}
              onChange={(e) => patch(f.id, { value: e.target.value })}
            />
            <SecondaryButton onClick={() => onChange(filters.filter((x) => x.id !== f.id))}>
              <Trash2 size={18} />
            </SecondaryButton>
          </div>
        );
      })}
      <div>
        <SecondaryButton onClick={() => onChange([...filters, newFilter()])}>
          <Plus size={18} />
          Add filter
        </SecondaryButton>
      </div>
    </div>
  );
}
