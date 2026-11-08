import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { SEARCH_ENGINES } from "../data";
import Select from "./Select";

export default function SearchBar({ engine, openTarget, onEngineChange, inputRef, seed }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const selectedEngine = SEARCH_ENGINES.find((item) => item.id === engine) || SEARCH_ENGINES[0];
  const isAi = selectedEngine.type === "ai";

  useEffect(() => {
    if (!seed) return;
    setQuery(seed.text);
    setError("");
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(seed.text.length, seed.text.length);
  }, [seed, inputRef]);

  function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setError(isAi ? "输入问题后再发起对话。" : "输入关键词或网址后再搜索。");
      inputRef.current?.focus();
      return;
    }

    const isUrl = !/\s/.test(value) && (/^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value));
    const target = !isAi && isUrl
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
        className="mt-3 flex min-h-[clamp(44px,6vh,56px)] items-center gap-2.5 rounded-[10px] border border-[color:var(--line)] bg-surface py-1.5 pl-4 pr-1.5 transition-colors max-[480px]:mt-2 max-[480px]:gap-2 max-[480px]:py-1"
        role="search"
        noValidate
        onSubmit={handleSubmit}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" strokeWidth={1.7} aria-hidden="true" />
        <label className="sr-only" htmlFor="search-input">{isAi ? "输入问题，开始 AI 对话" : "搜索或输入网址"}</label>
        <input
          ref={inputRef}
          id="search-input"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted"
          type="text"
          value={query}
          placeholder={isAi ? "输入问题，开始 AI 对话" : "搜索或输入网址"}
          autoComplete="off"
          spellCheck="false"
          aria-invalid={Boolean(error)}
          aria-describedby="search-error"
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
            setError("");
            inputRef.current?.blur();
          }}
        />
        <div className="flex shrink-0 items-center gap-2 max-[480px]:gap-1">
          <Select
            id="engine-select"
            ariaLabel="选择搜索服务"
            variant="ghost"
            value={engine}
            options={SEARCH_ENGINES.map((item) => ({ value: item.id, label: item.label }))}
            onChange={onEngineChange}
          />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] active:opacity-90"
            type="submit"
            aria-label={isAi ? "打开 AI 对话" : "搜索"}
            title={isAi ? "打开 AI 对话" : "搜索"}
          >
            <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </form>
      {error && (
        <p id="search-error" className="mx-1 mt-2 text-[13px] leading-relaxed text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
