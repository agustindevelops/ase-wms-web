"use client";

import { wisJson } from "@/lib/api/wisFetch";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type ItemOption = {
  id: string;
  name: string;
  categoryName: string | null;
  quantityOwned: number;
  quantityAvailable: number;
};

type Props = {
  id?: string;
  value: ItemOption | null;
  onChange: (item: ItemOption | null) => void;
  /** Items to hide from results (e.g. already added). */
  excludeIds?: string[];
  /** Enter with a selected item and the list closed. */
  onConfirm?: () => void;
  placeholder?: string;
};

const DEBOUNCE_MS = 250;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-green-100 text-brown-900">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** Debounced, fuzzy (typo-tolerant) catalog item autocomplete. */
export default function ItemSearch({
  id,
  value,
  onChange,
  excludeIds = [],
  onConfirm,
  placeholder = "Search items…",
}: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text, DEBOUNCE_MS);
  const clearedByTyping = useRef(false);

  useEffect(() => {
    if (clearedByTyping.current) {
      clearedByTyping.current = false;
      return;
    }
    setText(value?.name ?? "");
  }, [value]);

  const search = useQuery({
    queryKey: ["item-search", query.trim()],
    queryFn: () =>
      wisJson<{ items: ItemOption[] }>(
        `/api/item/search?limit=12&q=${encodeURIComponent(query.trim())}`,
      ),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const results = (search.data?.items ?? []).filter(
    (item) => !excludeIds.includes(item.id),
  );
  const pending = text !== query || search.isFetching;

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: ItemOption) => {
    onChange(item);
    setText(item.name);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && results[active]) {
        choose(results[active]);
      } else if (!open && value) {
        onConfirm?.();
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const showList = open && (results.length > 0 || !pending);

  return (
    <div className="relative">
      <div className="relative">
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-brown-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && results[active] ? `${listId}-${results[active].id}` : undefined
          }
          value={text}
          placeholder={placeholder}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            if (value) {
              clearedByTyping.current = true;
              onChange(null);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-brown-200 bg-white py-2 pr-9 pl-9 text-brown-800 placeholder:text-brown-400"
        />
        {pending && open ? (
          <span
            aria-hidden
            className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brown-200 border-t-brown-500"
          />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(null);
              setText("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-brown-500 hover:bg-brown-100"
          >
            ×
          </button>
        ) : null}
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-brown-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-brown-500">
              {search.isError
                ? "Search failed. Try again."
                : query.trim()
                  ? `No items match “${query.trim()}”`
                  : "No items available"}
            </li>
          ) : (
            results.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={`cursor-pointer px-3 py-2 ${
                  index === active ? "bg-brown-50" : ""
                }`}
              >
                <p className="text-sm text-brown-800">
                  <Highlight text={item.name} query={query} />
                </p>
                <p className="text-xs text-brown-500">
                  {[
                    item.categoryName,
                    `${item.quantityAvailable} of ${item.quantityOwned} available`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
