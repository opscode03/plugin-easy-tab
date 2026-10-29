import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Modal from "./Modal";
import { getMark, normalizeUrl } from "../data";

export default function ShortcutDialog({ open, shortcut, onClose, onSave }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(shortcut?.name || "");
      setUrl(shortcut?.url || "");
      setError("");
      setInvalidField("");
    }
  }, [open, shortcut]);

  function showError(message, field) {
    setError(message);
    setInvalidField(field);
    document.getElementById(field)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setInvalidField("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      showError("请输入入口名称。", "shortcut-name");
      return;
    }

    let normalizedUrl;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      showError("请输入有效网址，例如 example.com。", "shortcut-url");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: shortcut?.id,
        name: trimmedName,
        url: normalizedUrl,
        mark: getMark(trimmedName)
      });
      onClose();
    } catch {
      showError("保存失败，请检查浏览器存储权限后重试。", "shortcut-url");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="shortcut-dialog-title"
      className="dialog-enter m-auto max-h-[calc(100dvh_-_32px)] w-[min(calc(100%_-_32px),440px)] max-w-[440px] rounded-3xl"
    >
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">常用入口</p>
          <h2 id="shortcut-dialog-title" className="dialog-title">{shortcut ? "编辑入口" : "添加入口"}</h2>
        </div>
        <button className="icon-button -mr-2 -mt-1" type="button" aria-label="关闭入口编辑" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <form className="flex min-h-0 flex-col" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-6 overflow-y-auto p-6 max-[480px]:p-5">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="shortcut-name">名称</label>
            <input
              id="shortcut-name"
              className="field-input aria-[invalid=true]:border-danger"
              type="text"
              maxLength={12}
              placeholder="例如：开发者文档"
              required
              autoFocus
              value={name}
              aria-invalid={invalidField === "shortcut-name"}
              aria-describedby="shortcut-form-error"
              onChange={(event) => {
                setName(event.target.value);
                setError("");
                setInvalidField("");
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="shortcut-url">网址</label>
            <input
              id="shortcut-url"
              className="field-input aria-[invalid=true]:border-danger"
              type="text"
              inputMode="url"
              placeholder="example.com"
              required
              value={url}
              aria-invalid={invalidField === "shortcut-url"}
              aria-describedby="url-help shortcut-form-error"
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
                setInvalidField("");
              }}
            />
            <p id="url-help" className="mb-0 mt-2 text-xs text-ink-muted">无需输入 https://</p>
          </div>
          <p id="shortcut-form-error" className="m-0 text-[13px] leading-relaxed text-danger" role="alert">{error}</p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-line p-4 px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button className="button-secondary" type="button" onClick={onClose}>取消</button>
          <button className="button-primary" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "保存中…" : "保存入口"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
