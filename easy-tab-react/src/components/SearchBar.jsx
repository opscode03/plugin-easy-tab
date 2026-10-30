import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { SEARCH_ENGINES } from "../data";
import Select from "./Select";

export default function SearchBar({ engine, openTarget, onEngineChange, inputRef }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setError("输入关键词或网址后再搜索。");
      inputRef.current?.focus();
      return;
    }

    const selectedEngine = SEARCH_ENGINES.find((item) => item.id === engine) || SEARCH_ENGINES[0];
    const isUrl = !/\s/.test(value) && (/^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value));
    const target = isUrl
      ? (/^https?:\/\//i.test(value) ? value : `https://${value}`)
      : selectedEngine.url.replace("{query}", encodeURIComponent(value));
    if (openTarget === "new") {
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(target);
    }
  }

  return (
    <div className="reveal relative z-20 [animation-delay:180ms]">
      <form
        className="mt-8 flex min-h-16 items-center gap-3 rounded-[20px] border border-line bg-surface py-2 pl-5 pr-2 shadow-search transition focus-within:border-sage focus-within:ring-4 focus-within:ring-sage-soft max-[480px]:mt-7 max-[480px]:min-h-[60px] max-[480px]:gap-2 max-[480px]:pl-4"
        role="search"
        noValidate
        onSubmit={handleSubmit}
      >
        <Search className="h-5 w-5 shrink-0 text-ink-muted" strokeWidth={1.7} aria-hidden="true" />
        <label className="sr-only" htmlFor="search-input">搜索或输入网址</label>
        <input
          ref={inputRef}
          id="search-input"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          type="text"
          value={query}
          placeholder="搜索或输入网址"
          autoComplete="off"
          spellCheck="false"
          aria-invalid={Boolean(error)}
          aria-describedby="search-error"
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
        />
        <div className="flex shrink-0 items-center gap-2 max-[480px]:gap-1">
          <Select
            id="engine-select"
            ariaLabel="选择搜索引擎"
            variant="ghost"
            value={engine}
            options={SEARCH_ENGINES.map((item) => ({ value: item.id, label: item.label }))}
            onChange={onEngineChange}
          />
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-sage text-canvas transition hover:bg-sage-hover active:scale-95"
            type="submit"
            aria-label="搜索"
            title="搜索"
          >
            <ArrowUpRight className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </form>
      <p id="search-error" className="mx-1 mb-[-28px] mt-2 text-[13px] text-danger" role="alert">
        {error}
      </p>
    </div>
  );
}
