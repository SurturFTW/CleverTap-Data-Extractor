"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ID_TYPES,
  STANDARD_PROFILE_KEYS,
  VALUE_TYPES,
  newProp,
  type IdType,
  type PropRow,
  type RecordDraft,
  type UploadKind,
  type ValueType,
} from "@/lib/clevertap/upload";
import { EVENT_SUGGESTIONS } from "@/components/shared/EventPicker";
import { Label, SecondaryButton, inputClass } from "@/components/shared/ui";

function ValueInput({
  row,
  onChange,
}: {
  row: PropRow;
  onChange: (value: string) => void;
}) {
  if (row.type === "boolean") {
    return (
      <select className={inputClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (row.type === "date") {
    return (
      <input
        className={inputClass}
        type="datetime-local"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const placeholder =
    row.type === "list" || row.type === "add" || row.type === "remove"
      ? "a, b, c"
      : row.type === "string"
        ? "Value"
        : "0";
  return (
    <input
      className={inputClass}
      type={row.type === "number" || row.type === "incr" || row.type === "decr" ? "number" : "text"}
      step="any"
      placeholder={placeholder}
      value={row.value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function RecordEditor({
  kind,
  index,
  draft,
  onChange,
  onRemove,
  canRemove,
}: {
  kind: UploadKind;
  index: number;
  draft: RecordDraft;
  onChange: (next: RecordDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const types = VALUE_TYPES.filter((t) => kind === "profile" || !t.profileOnly);
  // useId is stable between server and client render (draft.id is random)
  const uniq = useId();
  const listId = `keys-${uniq}`;
  const eventsListId = `events-${uniq}`;

  const patchProp = (id: string, p: Partial<PropRow>) =>
    onChange({ ...draft, props: draft.props.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-black">
          {kind === "profile" ? "Profile" : "Event"} {index + 1}
        </h3>
        {canRemove && (
          <SecondaryButton onClick={onRemove}>
            <Trash2 size={16} />
            Remove
          </SecondaryButton>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Identify user by">
          <select
            className={inputClass}
            value={draft.idType}
            onChange={(e) => onChange({ ...draft, idType: e.target.value as IdType })}
          >
            {ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Label>
        <Label label={ID_TYPES.find((t) => t.value === draft.idType)!.label}>
          <input
            className={inputClass}
            autoComplete="off"
            value={draft.idValue}
            onChange={(e) => onChange({ ...draft, idValue: e.target.value })}
          />
        </Label>

        {kind === "event" && (
          <>
            <Label label="Event name">
              <input
                className={inputClass}
                list={eventsListId}
                value={draft.evtName}
                onChange={(e) => onChange({ ...draft, evtName: e.target.value })}
              />
              <datalist id={eventsListId}>
                {EVENT_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
              </datalist>
            </Label>
            <Label label="Time (optional — defaults to now)">
              <input
                className={inputClass}
                type="datetime-local"
                value={draft.ts}
                onChange={(e) => onChange({ ...draft, ts: e.target.value })}
              />
            </Label>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">
          {kind === "profile" ? "User properties" : "Event properties"}
        </p>
        {kind === "profile" && (
          <datalist id={listId}>
            {STANDARD_PROFILE_KEYS.map((k) => <option key={k} value={k} />)}
          </datalist>
        )}
        {draft.props.map((row) => (
          <div key={row.id} className="grid items-center gap-2 sm:grid-cols-[1fr_11rem_1fr_auto]">
            <input
              className={inputClass}
              placeholder="Property name"
              list={kind === "profile" ? listId : undefined}
              value={row.key}
              onChange={(e) => patchProp(row.id, { key: e.target.value })}
            />
            <select
              className={inputClass}
              value={row.type}
              onChange={(e) => patchProp(row.id, { type: e.target.value as ValueType, value: "" })}
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ValueInput row={row} onChange={(value) => patchProp(row.id, { value })} />
            <SecondaryButton
              onClick={() =>
                onChange({ ...draft, props: draft.props.filter((r) => r.id !== row.id) })
              }
            >
              <Trash2 size={16} />
            </SecondaryButton>
          </div>
        ))}
        <div>
          <SecondaryButton onClick={() => onChange({ ...draft, props: [...draft.props, newProp()] })}>
            <Plus size={16} />
            Add property
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
