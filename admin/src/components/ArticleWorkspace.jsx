import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminCreateArticle,
  adminDeleteArticle,
  adminGetArticles,
  adminUpdateArticle,
} from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import {
  adminInputClass,
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
} from './ui/AdminUi.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';

const EMPTY_FORM = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  author: 'ViralAdLibrary Team',
  status: 'draft',
};

export function ArticleWorkspace({ mode = 'all' }) {
  const { token } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('info');
  const [imageUrl, setImageUrl] = useState('');

  const isEditing = useMemo(() => Number(form.id) > 0, [form.id]);
  const showEditor = mode !== 'all' || isEditing;
  const showList = mode !== 'new';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const rows = await adminGetArticles(token);
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) {
          setMessage(err.message || 'Failed to load articles');
          setMessageTone('error');
        }
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
    const plainContent = String(form.content || '').replace(/<[^>]+>/g, '').trim();
    if (!String(form.title || '').trim()) {
      setMessage('Title is required.');
      setMessageTone('error');
      return;
    }
    if (!plainContent) {
      setMessage('Article body is required.');
      setMessageTone('error');
      return;
    }
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
      setMessageTone('success');
    } catch (err) {
      setMessage(err.message || 'Failed to save article');
      setMessageTone('error');
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
      setMessageTone('success');
    } catch (err) {
      setMessage(err.message || 'Failed to delete article');
      setMessageTone('error');
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
    const snippet = `<p><img src="${trimmed}" alt="Article image" /></p>`;
    setForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}${snippet}` : snippet,
    }));
    setImageUrl('');
  };

  const handleImageFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        const snippet = `<p><img src="${dataUrl}" alt="${file.name}" /></p>`;
        setForm((prev) => ({
          ...prev,
          content: prev.content ? `${prev.content}${snippet}` : snippet,
        }));
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      {showEditor ? (
        <AdminCard>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{isEditing ? 'Edit article' : 'New article'}</p>
              {isEditing ? (
                <AdminButton type="button" variant="ghost" onClick={resetEditor}>
                  Clear editor
                </AdminButton>
              ) : null}
            </div>

            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title"
              className={adminInputClass}
              required
            />
            <input
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="Slug (optional — auto from title if empty)"
              className={adminInputClass}
            />
            <input
              value={form.excerpt}
              onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
              placeholder="Excerpt — shown on blog index"
              className={adminInputClass}
            />

            <div className="rounded-sm border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">Content tools</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminButton type="button" variant="ghost" onClick={addBulletTemplate}>
                  Plain-text bullet template
                </AdminButton>
                <label className="cursor-pointer">
                  <span className="inline-flex rounded-sm border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#d1d5db] hover:bg-white/5">
                    Attach image file
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste image URL"
                  className={adminInputClass}
                />
                <AdminButton type="button" variant="secondary" onClick={addImageByUrl}>
                  Insert image HTML
                </AdminButton>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">Article body</p>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((p) => ({ ...p, content: html }))}
                placeholder="Write with headings, lists, links, and images…"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={form.author}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                placeholder="Author"
                className={adminInputClass}
              />
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className={adminInputClass}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <AdminButton type="submit" disabled={saving} className="md:self-end">
                {saving ? 'Saving…' : isEditing ? 'Update' : 'Publish / save'}
              </AdminButton>
            </div>

            {message ? <AdminAlert tone={messageTone}>{message}</AdminAlert> : null}
          </form>
        </AdminCard>
      ) : null}

      {showList ? (
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Published & drafts</p>
            <Link to="/articles/new" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
              + New article
            </Link>
          </div>

          {loading ? <p className="mt-4 text-sm text-[#9ca3af]">Loading…</p> : null}

          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/8 bg-black/20 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <AdminBadge tone={item.status === 'published' ? 'success' : 'draft'}>{item.status}</AdminBadge>
                  </div>
                  <p className="mt-1 text-xs text-[#7f8ba0]">/{item.slug}</p>
                </div>
                <div className="flex gap-2">
                  <AdminButton type="button" variant="ghost" onClick={() => setForm({ ...item })}>
                    Edit
                  </AdminButton>
                  <AdminButton type="button" variant="danger" onClick={() => handleDelete(item.id)}>
                    Delete
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>

          {!items.length && !loading ? (
            <p className="mt-4 text-sm text-[#9ca3af]">No articles yet. Create your first post.</p>
          ) : null}

          {message && !showEditor ? <div className="mt-4"><AdminAlert tone={messageTone}>{message}</AdminAlert></div> : null}
        </AdminCard>
      ) : null}
    </div>
  );
}
