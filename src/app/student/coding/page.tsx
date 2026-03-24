'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Question {
  id: number;
  title: string;
  slug: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category: string;
  tags: string[];
  solved: boolean;
  attempted: boolean;
  submissions: number;
}

const DIFF_CONFIG = {
  EASY:   { label: 'Easy',   color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-400/20' },
  MEDIUM: { label: 'Medium', color: 'text-amber-600 dark:text-amber-300',   bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-400/20' },
  HARD:   { label: 'Hard',   color: 'text-red-600 dark:text-red-300',     bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-400/20' },
};

export default function CodingPracticePage() {
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [difficulty, setDifficulty] = useState('ALL');
  const [category, setCategory]     = useState('ALL');
  const [filter, setFilter]         = useState<'all' | 'solved' | 'unsolved'>('all');

  useEffect(() => { fetchQuestions(); }, [difficulty, category, search]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (difficulty !== 'ALL') params.set('difficulty', difficulty);
      if (category   !== 'ALL') params.set('category',   category);
      if (search)               params.set('search',     search);

      const res = await fetch(`/api/coding/questions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = questions.filter(q => {
    if (filter === 'solved')   return q.solved;
    if (filter === 'unsolved') return !q.solved;
    return true;
  });

  const stats = {
    total:  questions.length,
    solved: questions.filter(q => q.solved).length,
    easy:   questions.filter(q => q.difficulty === 'EASY').length,
    medium: questions.filter(q => q.difficulty === 'MEDIUM').length,
    hard:   questions.filter(q => q.difficulty === 'HARD').length,
  };

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-1">
          Coding Practice
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Sharpen your skills with C, C++ and SQL challenges</p>
      </div>

      {/* ── Stats row ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="theme-surface-card flex items-center gap-2 px-4 py-2 bg-white/98 dark:bg-slate-900/88 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm">
          <span className="text-xl font-bold text-indigo-600">{stats.solved}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/ {stats.total} Solved</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-400/20">
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{stats.easy}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Easy</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-500/10 dark:border-amber-400/20">
          <span className="text-sm font-bold text-amber-600 dark:text-amber-300">{stats.medium}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Medium</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl dark:bg-red-500/10 dark:border-red-400/20">
          <span className="text-sm font-bold text-red-600 dark:text-red-300">{stats.hard}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Hard</span>
        </div>
        {/* Progress bar */}
        <div className="flex-1 min-w-[180px] flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: stats.total > 0 ? `${(stats.solved / stats.total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
            {stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search problems..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="theme-surface-card w-full pl-10 pr-4 py-2.5 bg-white/98 dark:bg-slate-900/88 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Difficulty */}
        <select
          value={difficulty}
          onChange={e => setDifficulty(e.target.value)}
          className="theme-surface-card px-3 py-2.5 bg-white/98 dark:bg-slate-900/88 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 transition-colors"
        >
          <option value="ALL">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>

        {/* Category */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="theme-surface-card px-3 py-2.5 bg-white/98 dark:bg-slate-900/88 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 transition-colors"
        >
          <option value="ALL">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Status toggle */}
        <div className="theme-surface-card flex border border-slate-200 dark:border-white/10 bg-white/98 dark:bg-slate-900/88 rounded-xl overflow-hidden">
          {(['all', 'solved', 'unsolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Question Table ── */}
      <div className="theme-surface-card bg-white/98 dark:bg-slate-900/92 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="grid grid-cols-[48px_1fr_130px_130px_90px] bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 px-4 py-3">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">#</div>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Title</div>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</div>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Difficulty</div>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">Loading problems...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-slate-500 dark:text-slate-400">No problems found matching your filters.</p>
          </div>
        ) : (
          filtered.map((q) => {
            const diff = DIFF_CONFIG[q.difficulty];
            return (
              <Link key={q.id} href={`/student/coding/${q.slug}`}>
                <div className={`grid grid-cols-[48px_1fr_130px_130px_90px] px-4 py-4 border-b border-slate-100 dark:border-white/5 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-colors cursor-pointer group ${
                  q.solved ? 'bg-emerald-50/30 dark:bg-emerald-500/5' : ''
                }`}>

                  {/* # */}
                  <div className="flex items-center">
                    <span className="text-sm text-slate-400 dark:text-slate-500 font-mono">{q.id}</span>
                  </div>

                  {/* Title + tags */}
                  <div className="flex flex-col gap-1.5 pr-4 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate">
                      {q.title}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {q.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{q.category}</span>
                  </div>

                  {/* Difficulty */}
                  <div className="flex items-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${diff.color} ${diff.bg}`}>
                      {diff.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    {q.solved ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-400/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-300 font-medium hidden sm:inline">Solved</span>
                      </div>
                    ) : q.attempted ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-400/20 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </div>
                        <span className="text-xs text-amber-600 dark:text-amber-300 font-medium hidden sm:inline">Tried</span>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          Showing {filtered.length} of {questions.length} problems
        </p>
      )}
    </div>
  );
}
