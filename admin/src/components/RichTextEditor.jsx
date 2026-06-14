import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link', 'image'],
  [{ align: [] }],
  ['clean'],
];

function normalizeHtml(html) {
  const value = String(html || '').trim();
  if (!value || value === '<p><br></p>') return '';
  return html || '';
}

export function RichTextEditor({ value, onChange, placeholder = 'Write your article…' }) {
  const hostRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lastHtmlRef = useRef(normalizeHtml(value));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || quillRef.current) return;

    host.innerHTML = '';
    const editorEl = document.createElement('div');
    host.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: TOOLBAR_OPTIONS,
      },
    });

    quillRef.current = quill;

    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
      lastHtmlRef.current = normalizeHtml(quill.root.innerHTML);
    }

    quill.on('text-change', () => {
      const html = normalizeHtml(quill.root.innerHTML);
      lastHtmlRef.current = html;
      onChangeRef.current(html);
    });

    return () => {
      quillRef.current = null;
      host.innerHTML = '';
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const next = normalizeHtml(value);
    if (next === lastHtmlRef.current) return;

    lastHtmlRef.current = next;
    if (next) {
      quill.clipboard.dangerouslyPasteHTML(next);
    } else {
      quill.setText('');
    }
  }, [value]);

  return <div className="admin-quill" ref={hostRef} />;
}

export function ArticleHtmlContent({ html = '' }) {
  if (!html || !String(html).trim()) return null;
  return (
    <div
      className="article-html prose prose-invert max-w-none text-base leading-8 text-slate-200 [&_a]:text-emerald-300 [&_blockquote]:border-l-emerald-400/40 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
