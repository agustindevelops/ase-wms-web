"use client";

import MarkdownEditor from "@/components/MarkdownEditor";
import { fieldClass } from "../inventory/inventoryTypes";
import {
  centsToInput,
  type BookingFormOption,
  type PackageVariantDetail,
} from "./packageTypes";

export type VariantLine = {
  /** Stable key for React; existing variants use their id. */
  key: string;
  id?: string;
  name: string;
  preview: string;
  description: string;
  price: string;
  forms: string[];
};

let nextKey = 0;
function newKey() {
  nextKey += 1;
  return `new-${nextKey}`;
}

export function initialVariantLines(
  variants: PackageVariantDetail[] | undefined,
): VariantLine[] {
  if (!variants || variants.length === 0) {
    return [
      {
        key: newKey(),
        name: "",
        preview: "",
        description: "",
        price: "",
        forms: [],
      },
    ];
  }
  return variants.map((row) => ({
    key: row.id,
    id: row.id,
    name: row.name,
    preview: row.preview,
    description: row.description ?? "",
    price: centsToInput(row.priceCents),
    forms: [...row.forms],
  }));
}

type Props = {
  lines: VariantLine[];
  setLines: (lines: VariantLine[] | ((current: VariantLine[]) => VariantLine[])) => void;
  forms: BookingFormOption[];
  disabled?: boolean;
};

export default function PackageVariantsEditor({
  lines,
  setLines,
  forms,
  disabled,
}: Props) {
  const update = (index: number, patch: Partial<VariantLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const toggleForm = (index: number, code: string) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const has = line.forms.includes(code);
        return {
          ...line,
          forms: has
            ? line.forms.filter((entry) => entry !== code)
            : [...line.forms, code],
        };
      }),
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brown-700">Style variants</p>
          <p className="mt-1 text-xs text-brown-500">
            Shown as style cards on the customer site. Order here is the display
            order. Attach booking forms when a style needs extra steps.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                key: newKey(),
                name: "",
                preview: "",
                description: "",
                price: "",
                forms: [],
              },
            ])
          }
          className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          Add style
        </button>
      </div>
      <ul className="space-y-4">
        {lines.map((line, index) => (
          <li
            key={line.key}
            className="rounded-xl border border-brown-200 bg-white p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-brown-800">
                Style {index + 1}
              </p>
              <button
                type="button"
                disabled={disabled || lines.length <= 1}
                onClick={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
                className="text-sm font-medium text-peach-700 hover:underline disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`variant-name-${line.key}`}
                  className="mb-1 block text-xs font-medium text-brown-600"
                >
                  Name
                </label>
                <input
                  id={`variant-name-${line.key}`}
                  required
                  disabled={disabled}
                  value={line.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Intimate Celebration"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor={`variant-price-${line.key}`}
                  className="mb-1 block text-xs font-medium text-brown-600"
                >
                  Price modifier (USD)
                </label>
                <input
                  id={`variant-price-${line.key}`}
                  required
                  inputMode="decimal"
                  disabled={disabled}
                  value={line.price}
                  onChange={(e) => update(index, { price: e.target.value })}
                  placeholder="0.00"
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-brown-500">
                  Added to the package base price on the customer site.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor={`variant-preview-${line.key}`}
                  className="mb-1 block text-xs font-medium text-brown-600"
                >
                  Preview
                </label>
                <input
                  id={`variant-preview-${line.key}`}
                  required
                  maxLength={512}
                  disabled={disabled}
                  value={line.preview}
                  onChange={(e) => update(index, { preview: e.target.value })}
                  placeholder="We bring the tables, chairs, styling and décor…"
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-brown-500">
                  Short sentence on the style card under the name.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor={`variant-description-${line.key}`}
                  className="mb-1 block text-xs font-medium text-brown-600"
                >
                  Description
                </label>
                <MarkdownEditor
                  id={`variant-description-${line.key}`}
                  value={line.description}
                  onChange={(value) => update(index, { description: value })}
                  placeholder="Extra detail appended under the package description when this style is selected…"
                />
                <p className="mt-1 text-xs text-brown-500">
                  Optional markdown. Shown under the package description when
                  this style is selected.
                </p>
              </div>
              {forms.length > 0 ? (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-2 text-xs font-medium text-brown-600">
                    Booking forms
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {forms.map((form) => {
                      const checked = line.forms.includes(form.code);
                      return (
                        <label
                          key={form.code}
                          className="inline-flex items-center gap-2 text-sm text-brown-800"
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={() => toggleForm(index, form.code)}
                            className="rounded border-brown-300 text-green-700 focus:ring-green-500"
                          />
                          {form.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
