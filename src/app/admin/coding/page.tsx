'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Question {
  id: number;
  title: string;
  slug: string;
  difficulty: string;
  category: string;
  isActive: boolean;
  description?: string;
  tags?: string[];
  constraints?: string;
  hints?: string[];
  examples?: any;
  testCases?: any;
  starterCode?: any;
  solution?: string;
  orderIndex?: number;
}

const EMPTY_FORM = {
  title:       '',
  slug:        '',
  description: '',
  difficulty:  'EASY',
  category:    'Arrays',
  tags:        '',
  constraints: '',
  hints:       '',
  orderIndex:  0,
  examples:    '[{"input":"","output":"","explanation":""}]',
  testCases:   '[{"input":"","expectedOutput":"","isHidden":false}]',
  starterCode: JSON.stringify({
    c:   '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
    sql: '-- Write your SQL query here\nSELECT * FROM table;',
  }, null, 2),
  solution: '',
};

export default function AdminCodingPage() {
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null); // null = create mode
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/coding/questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Open "Add" form ──────────────────────────────────────────────────────
  const handleAddNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  // ── Open "Edit" form with existing data ──────────────────────────────────
  const handleEdit = async (q: Question) => {
    setError('');
    setSuccess('');
    setEditingId(q.id);

    // Fetch full question data (list doesn't include all fields)
    try {
      const res = await fetch(`/api/coding/questions/${q.slug}?admin=true`);
      if (res.ok) {
        const data = await res.json();
        const full = data.question;
        setForm({
          title:       full.title       || '',
          slug:        full.slug        || '',
          description: full.description || '',
          difficulty:  full.difficulty  || 'EASY',
          category:    full.category    || '',
          tags:        (full.tags       || []).join(', '),
          constraints: full.constraints || '',
          hints:       (full.hints      || []).join('\n'),
          orderIndex:  full.orderIndex  || 0,
          examples:    JSON.stringify(full.examples    || [], null, 2),
          testCases:   JSON.stringify(full.testCases   || [], null, 2),
          starterCode: JSON.stringify(full.starterCode || {}, null, 2),
          solution:    full.solution    || '',
        });
      }
    } catch {
      // fallback: use list data
      setForm({
        ...EMPTY_FORM,
        title:      q.title,
        slug:       q.slug,
        difficulty: q.difficulty,
        category:   q.category,
      });
    }

    setShowForm(true);
    // Scroll to form
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleTitleChange = (title: string) => {
    // Only auto-generate slug in create mode
    if (editingId === null) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setForm(f => ({ ...f, title, slug }));
    } else {
      setForm(f => ({ ...f, title }));
    }
  };

  // ── Parse + validate JSON fields ─────────────────────────────────────────
  const parseFormJson = () => {
    const examples    = JSON.parse(form.examples);
    const testCases   = JSON.parse(form.testCases);
    const starterCode = JSON.parse(form.starterCode);
    return { examples, testCases, starterCode };
  };

  // ── Submit: create or update ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);

    try {
      let examples, testCases, starterCode;
      try {
        ({ examples, testCases, starterCode } = parseFormJson());
      } catch {
        setError('Invalid JSON in examples, testCases, or starterCode fields.');
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
        hints:       form.hints.split('\n').map(h => h.trim()).filter(Boolean),
        examples,
        testCases,
        starterCode,
      };

      const isEdit  = editingId !== null;
      const url     = isEdit ? `/api/coding/questions/${form.slug}` : '/api/coding/questions';
      const method  = isEdit ? 'PUT' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Question "${data.question.title}" ${isEdit ? 'updated' : 'created'}!`);
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        fetchQuestions();
      } else {
        setError(data.error || `Failed to ${isEdit ? 'update' : 'create'} question`);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (q: Question) => {
    if (!confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
    setDeleting(q.id);
    try {
      const res = await fetch(`/api/coding/questions/${q.slug}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess(`"${q.title}" deleted.`);
        fetchQuestions();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors font-mono";
  const labelCls = "block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide";
  const isEdit   = editingId !== null;

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Coding Questions</h1>
          <p className="text-slate-500 mt-1">Manage the practice problem bank</p>
        </div>
        {!showForm && (
          <Button onClick={handleAddNew}>+ Add Question</Button>
        )}
      </div>

      {/* Success / Error banners */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
          <span>✅ {success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700 font-bold text-lg leading-none">×</button>
        </div>
      )}
      {error && !showForm && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <span>❌ {error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <Card variant="elevated" className="p-6 mb-8 bg-slate-900 text-white">
          {/* Form header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {isEdit ? `✏️ Edit: ${form.title}` : '➕ New Coding Question'}
            </h2>
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-white text-2xl leading-none font-bold"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Two Sum" required />
              </div>
              <div>
                <label className={labelCls}>Slug {isEdit ? '(read-only)' : '(auto)'} *</label>
                <input
                  className={`${inputCls} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={form.slug}
                  onChange={e => !isEdit && setForm(f => ({ ...f, slug: e.target.value }))}
                  readOnly={isEdit}
                  placeholder="two-sum"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Difficulty *</label>
                <select className={inputCls} value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Category *</label>
                <input className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Arrays, SQL, Strings..." required />
              </div>
              <div>
                <label className={labelCls}>Tags (comma separated)</label>
                <input className={inputCls} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Array, Hash Table, Two Pointers" />
              </div>
              <div>
                <label className={labelCls}>Order Index</label>
                <input className={inputCls} type="number" value={form.orderIndex} onChange={e => setForm(f => ({ ...f, orderIndex: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Description * (Markdown)</label>
              <textarea className={`${inputCls} h-40 resize-y`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={'## Problem\n\nGiven an array...'} required />
            </div>

            <div>
              <label className={labelCls}>Constraints</label>
              <textarea className={`${inputCls} h-20 resize-y`} value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))} placeholder={'• 1 <= n <= 10^5'} />
            </div>

            <div>
              <label className={labelCls}>Examples (JSON Array) *</label>
              <p className="text-xs text-slate-500 mb-1">{'[{"input":"...","output":"...","explanation":"..."}]'}</p>
              <textarea className={`${inputCls} h-28 resize-y`} value={form.examples} onChange={e => setForm(f => ({ ...f, examples: e.target.value }))} required />
            </div>

            <div>
              <label className={labelCls}>Test Cases (JSON Array) *</label>
              <p className="text-xs text-slate-500 mb-1">{'[{"input":"...","expectedOutput":"...","isHidden":false}]'} — use isHidden:true for secret cases</p>
              <textarea className={`${inputCls} h-32 resize-y`} value={form.testCases} onChange={e => setForm(f => ({ ...f, testCases: e.target.value }))} required />
            </div>

            <div>
              <label className={labelCls}>Starter Code (JSON) *</label>
              <p className="text-xs text-slate-500 mb-1">Keys: "c", "cpp", "sql"</p>
              <textarea className={`${inputCls} h-48 resize-y`} value={form.starterCode} onChange={e => setForm(f => ({ ...f, starterCode: e.target.value }))} required />
            </div>

            <div>
              <label className={labelCls}>Hints (one per line)</label>
              <textarea className={`${inputCls} h-20 resize-y`} value={form.hints} onChange={e => setForm(f => ({ ...f, hints: e.target.value }))} placeholder={'Use a hash map\nStore indices as values'} />
            </div>

            <div>
              <label className={labelCls}>Editorial / Solution (hidden from students)</label>
              <textarea className={`${inputCls} h-24 resize-y`} value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))} placeholder="Explain the optimal approach..." />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">{error}</div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving
                  ? (isEdit ? 'Saving...' : 'Creating...')
                  : (isEdit ? '💾 Save Changes' : '✅ Create Question')}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Questions Table ── */}
      <Card variant="elevated" className="p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          All Questions ({questions.length})
        </h2>

        {loading ? (
          <div className="text-center py-8 text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-5xl mb-3">📝</div>
            No questions yet. Add your first question above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold w-12">#</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">Title</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">Category</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">Difficulty</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">Slug</th>
                  <th className="text-right py-3 px-3 text-slate-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-400">{q.id}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{q.title}</td>
                    <td className="py-3 px-3 text-slate-600">{q.category}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        q.difficulty === 'EASY'   ? 'bg-emerald-100 text-emerald-700' :
                        q.difficulty === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-xs">{q.slug}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit button */}
                        <button
                          onClick={() => handleEdit(q)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(q)}
                          disabled={deleting === q.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deleting === q.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          {deleting === q.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}