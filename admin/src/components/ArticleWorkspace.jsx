import { useEffect, useMemo, useState } from 'react';
import {
  adminCreateArticle,
  adminDeleteArticle,
  adminGetArticles,
  adminUpdateArticle,
} from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

const EMPTY_FORM = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  author: 'ViralAdLibrary Team',
  status: 'draft',
};

const fieldClass =
  'w-full rounded-lg border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white outline-none ring-emerald-500/20 placeholder:text-[#6b7280] focus:border-emerald-500/40 focus:ring-2';

export function ArticleWorkspace({ mode = 'all' }) {
  const { token } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const isEditing = useMemo(() => Number.isFinite(Number(form.id)), [form.id]);
  const showEditor = mode !== 'all';
  const showList = mode !== 'new';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const rows = await adminGetArticles(token);
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) setMessage(err.message || 'Failed to load articles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        author: form.author,
        status: form.status,
      };
      const saved = isEditing
        ? await adminUpdateArticle(token, form.id, payload)
        : await adminCreateArticle(token, payload);
      setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setForm(EMPTY_FORM);
      setMessage(isEditing ? 'Article updated.' : 'Article created.');
    } catch (err) {
      setMessage(err.message || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminDeleteArticle(token, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (Number(form.id) === Number(id)) setForm(EMPTY_FORM);
      setMessage('Article deleted.');
    } catch (err) {
      setMessage(err.message || 'Failed to delete article');
    }
  };

  const resetEditor = () => {
    setForm(EMPTY_FORM);
    setImageUrl('');
  };

  const insertAtEnd = (snippet) => {
    setForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n${snippet}` : snippet,
    }));
  };

  const addBulletTemplate = () => {
    insertAtEnd('- Point one\n- Point two\n- Point three');
  };

  const addImageByUrl = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    insertAtEnd(`![Article image](${trimmed})`);
    setImageUrl('');
  };

  const handleImageFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        insertAtEnd(`![${file.name}](${dataUrl})`);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      {showEditor ? (
        <form onSubmit={handleSave} className="space-y-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">{isEditing ? 'Edit article' : 'New article'}</h2>
            {isEditing ? (
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-[#d1d5db] hover:bg-white/5"
              >
                Clear editor
              </button>
            ) : null}
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title"
            className={fieldClass}
          />
          <input
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            placeholder="Slug (optional)"
            className={fieldClass}
          />
          <input
            value={form.excerpt}
            onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
            placeholder="Excerpt"
            className={fieldClass}
          />

          <div className="rounded-lg border border-white/10 bg-[#0c0c0c] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#7f8ba0]">Content tools</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addBulletTemplate}
                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-[#d1d5db] hover:bg-white/5"
              >
                Add bullet template
              </button>
              <label className="cursor-pointer rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-[#d1d5db] hover:bg-white/5">
                Attach image file
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Or paste image URL"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={addImageByUrl}
                className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-[#d1d5db] hover:bg-white/5"
              >
                Add image
              </button>
            </div>
          </div>

          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            placeholder="Story content (supports markdown-style bullet points and image tags)"
            rows={10}
            className={`${fieldClass} resize-y min-h-[220px]`}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              placeholder="Author"
              className={fieldClass}
            />
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className={fieldClass}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-[#041006] hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEditing ? 'Update article' : 'Create article'}
            </button>
          </div>
          {message ? <p className="text-sm text-[#9ca3af]">{message}</p> : null}
        </form>
      ) : null}

      {showList ? (
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Published & drafts</h2>
          {loading ? <p className="mt-3 text-sm text-[#9ca3af]">Loading…</p> : null}
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-[#070707] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-[#9ca3af]">
                    /{item.slug} · {item.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...item });
                      if (mode === 'all') {
                        setMessage('Open "Add Article" to edit this item.');
                      }
                    }}
                    className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-[#e5e7eb] hover:bg-white/5"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!items.length && !loading ? <p className="mt-3 text-sm text-[#9ca3af]">No articles yet.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
