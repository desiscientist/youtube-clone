"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Mic, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

/** Waits until typing pauses before asking for suggestions. */
function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchBox({
  initialQuery = "",
  className,
  onSubmitted,
}: {
  initialQuery?: string;
  className?: string;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const container = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const debounced = useDebounced(query.trim(), 150);

  useEffect(() => setVoiceSupported(getSpeechRecognition() !== null), []);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["search-suggest", debounced],
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(
        `/api/search/suggest?q=${encodeURIComponent(debounced)}`,
      );
      if (!response.ok) return [];
      return ((await response.json()) as { suggestions: string[] }).suggestions;
    },
  });
  const visible = open && query.trim().length > 0 && suggestions.length > 0;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function go(term: string) {
    const trimmed = term.trim();
    setOpen(false);
    setHighlighted(-1);
    if (!trimmed) return;
    setQuery(trimmed);
    onSubmitted?.();
    router.push(`/results?q=${encodeURIComponent(trimmed)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(highlighted >= 0 && visible ? suggestions[highlighted] : query);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!visible) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    }
  }

  function startVoiceSearch() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const instance = new Recognition();
    instance.lang = navigator.language || "en-US";
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) go(transcript);
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    instance.start();
  }

  return (
    <form
      className={cn("relative items-center", className)}
      onSubmit={submit}
      ref={container}
      role="search"
    >
      <div className="relative flex h-10 w-full rounded-l-full border border-border bg-background shadow-inner shadow-black/[0.03] focus-within:border-sky-500">
        <input
          aria-activedescendant={
            visible && highlighted >= 0 ? `${listId}-${highlighted}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={visible}
          aria-label="Search videos"
          className="min-w-0 flex-1 rounded-l-full bg-transparent px-5 text-base outline-none placeholder:text-muted"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={listening ? "Listening…" : "Search"}
          role="combobox"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="px-3 text-muted hover:text-foreground"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            type="button"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        )}

        {visible && (
          <ul
            className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-2xl border border-border bg-surface py-2 shadow-xl"
            id={listId}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <li
                aria-selected={index === highlighted}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-1.5 text-sm",
                  index === highlighted
                    ? "bg-surface-muted"
                    : "hover:bg-surface-muted",
                )}
                id={`${listId}-${index}`}
                key={suggestion}
                onMouseDown={(event) => {
                  // mousedown, so the click lands before the input loses focus.
                  event.preventDefault();
                  go(suggestion);
                }}
                onMouseEnter={() => setHighlighted(index)}
                role="option"
              >
                <Search className="shrink-0 text-muted" size={16} />
                <span className="truncate font-medium">{suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        aria-label="Search"
        className="h-10 w-[68px] shrink-0 rounded-l-none rounded-r-full border border-l-0 border-border bg-surface-muted hover:bg-surface-muted/75"
        size="icon"
        type="submit"
        variant="ghost"
      >
        <Search size={20} />
      </Button>
      {voiceSupported && (
        <Button
          aria-label={
            listening ? "Stop voice search" : "Search with your voice"
          }
          aria-pressed={listening}
          className={cn(
            "ml-3 shrink-0 bg-surface-muted hover:bg-surface-muted/75",
            listening && "bg-accent text-white hover:bg-accent/90",
          )}
          onClick={startVoiceSearch}
          size="icon"
          title="Search with your voice"
          type="button"
          variant="ghost"
        >
          <Mic size={19} />
        </Button>
      )}
    </form>
  );
}
