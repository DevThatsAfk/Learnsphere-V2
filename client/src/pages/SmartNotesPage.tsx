/**
 * SmartNotesPage — AI-powered study assistant (Feature 5).
 *
 * Capabilities:
 *  - Rebranded from "Summarizer" to "Smart Notes Booster".
 *  - Supports manual text entry OR file upload (.txt, .md).
 *  - Custom prompts: "Summarize," "Extract Key Topics," "Exam-important points."
 *  - Strict grounding in input text.
 */
import { useState, useRef } from 'react';
import { summarizeApi, ApiError } from '../lib/api';
import type { AIFlashcard, AIQuizQuestion } from '../types/api';
import { TOKEN_KEY } from '../lib/api';

// ─── Character / word count helpers ────────────────────────────────
function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ─── Copy Button ───────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    async function handleCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (
        <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
            {copied ? '✓ Copied' : 'Copy'}
        </button>
    );
}

// ─── FileUploadGenerator ───────────────────────────────────────────
function FileUploadGenerator() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [flashcards, setFlashcards] = useState<AIFlashcard[] | null>(null);
    const [quiz, setQuiz] = useState<AIQuizQuestion[] | null>(null);

    const MAX_MB = 10;
    const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,.txt';

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > MAX_MB * 1024 * 1024) {
            setError(`File too large. Maximum is ${MAX_MB}MB.`);
            return;
        }
        setFile(f);
        setError(null);
        setFlashcards(null);
        setQuiz(null);
    };

    const handleGenerate = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'both');
            formData.append('flashcardCount', '5');
            formData.append('quizCount', '3');

            const BASE_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001/api';
            const token = localStorage.getItem(TOKEN_KEY);
            const res = await fetch(`${BASE_URL}/upload/generate`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data?.error ?? 'Upload failed.');
            }
            const data = await res.json();
            setFlashcards(data.flashcards ?? null);
            setQuiz(data.quiz ?? null);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = () => {
        if (!file) return '📎';
        if (file.type === 'application/pdf') return '📄';
        if (file.type.startsWith('image/')) return '🖼️';
        return '📝';
    };

    return (
        <div className="card p-6 space-y-4 border-indigo-100">
            <div>
                <h2 className="text-lg font-bold text-slate-800">Generate from File</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                    Upload a PDF, image, or text file. AI generates flashcards &amp; quiz{' '}
                    <strong>strictly from your content</strong> — no hallucination.
                </p>
            </div>

            {/* Drop zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
                <span className="text-3xl">{getFileIcon()}</span>
                {file ? (
                    <div className="text-center">
                        <p className="font-semibold text-slate-700">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="font-semibold text-slate-600">Click to upload</p>
                        <p className="text-xs text-slate-400">PDF, JPG, PNG, WebP, TXT · Max {MAX_MB}MB</p>
                    </div>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED}
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
                    <span>⚠</span> {error}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={!file || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? '✨ Generating (10–20s)…' : 'Generate Flashcards & Quiz'}
            </button>

            {/* Flashcard results */}
            {flashcards && flashcards.length > 0 && (
                <div className="space-y-2">
                    <p className="font-semibold text-slate-700">✅ {flashcards.length} Flashcards Generated</p>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                        {flashcards.map((card, i) => (
                            <div key={i} className="bg-indigo-50 rounded-lg p-3 text-sm border border-indigo-100">
                                <p className="font-semibold text-indigo-800">Q: {card.question}</p>
                                <p className="text-slate-600 mt-1">A: {card.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quiz results */}
            {quiz && quiz.length > 0 && (
                <div className="space-y-2">
                    <p className="font-semibold text-slate-700">✅ {quiz.length} Quiz Questions Generated</p>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                        {quiz.map((q, i) => (
                            <div key={i} className="bg-emerald-50 rounded-lg p-3 text-sm border border-emerald-100">
                                <p className="font-semibold text-emerald-800">Q{i + 1}: {q.question}</p>
                                <ul className="mt-2 space-y-1">
                                    {q.options.map((opt, j) => (
                                        <li
                                            key={j}
                                            className={`px-2 py-1 rounded ${j === q.correctAnswer
                                                ? 'bg-emerald-200 font-semibold text-emerald-900'
                                                : 'text-slate-600'
                                                }`}
                                        >
                                            {String.fromCharCode(65 + j)}. {opt}{j === q.correctAnswer ? ' ✓' : ''}
                                        </li>
                                    ))}
                                </ul>
                                {q.explanation && (
                                    <p className="mt-2 text-xs text-slate-500 italic">{q.explanation}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SmartNotesPage() {
    const [inputText, setInputText] = useState('');
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notConfigured, setNotConfigured] = useState(false);
    const [activePrompt, setActivePrompt] = useState('summarize');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const _inputWords = wordCount(inputText);
    const MAX_CHARS = 20_000;
    const tooShort = inputText.trim().length > 0 && inputText.trim().length < 30;
    const tooLong = inputText.length > MAX_CHARS;

    const PROMPTS = [
        { id: 'summarize', label: 'Summarize', desc: 'Concise summary of key points.' },
        { id: 'topics', label: 'Key Topics', desc: 'Bullet points of main headers.' },
        { id: 'exam', label: 'Exam Focus', desc: 'Focus on facts, dates & formulas.' },
    ];

    async function handleProcess(e: React.FormEvent) {
        e.preventDefault();
        if (!inputText.trim() || tooShort || tooLong) return;
        setSummary(''); setError(null); setNotConfigured(false);
        setLoading(true);

        // Inject the prompt modifier based on selection
        const modifiers: Record<string, string> = {
            summarize: "Provide a concise summary of the key points.",
            topics: "List the most important topics and sub-topics as bullet points.",
            exam: "Extract only the most important facts, dates, definitions, and formulas for an exam.",
        };
        const textToProcess = `${modifiers[activePrompt]}\n\nTEXT:\n${inputText.trim()}`;

        try {
            const result = await summarizeApi.summarize(textToProcess);
            setSummary(result.summary);
        } catch (err) {
            if (err instanceof ApiError && err.code === 'SUMMARIZER_NOT_CONFIGURED') {
                setNotConfigured(true);
            } else {
                setError(err instanceof ApiError ? err.message : 'Processing failed. Try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // PDFs and images are binary — reading them as text produces garbled output.
        // The "Generate from File" section below handles PDF/image files correctly
        // by sending them as multipart FormData to the AI upload endpoint.
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        if (isPdf || isImage) {
            setError('📄 PDFs and images cannot be pasted as text. Use the "Generate from File" section below — it handles PDFs and images directly via AI.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError('File is too large (max 2MB).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                setInputText(content.slice(0, 20000)); // cap at 20k chars
                setError(null);
            }
        };
        reader.onerror = () => setError('Could not read file.');
        reader.readAsText(file, 'UTF-8');
    };

    return (
        <div className="animate-slide-up max-w-3xl pb-20">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-indigo-200 shadow-lg">
                        <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
                            <path d="M12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">Smart Notes Booster</h1>
                </div>
                <p className="text-slate-500 max-w-lg">
                    Turn messy textbooks, lecture notes, or files into perfectly structured study material instantly.
                </p>
            </div>

            {/* Error Banners */}
            {notConfigured && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6">
                    <p className="text-sm font-semibold text-amber-800">Summarizer not configured</p>
                    <p className="text-xs text-amber-700 mt-1">
                        Add <code>GEMINI_API_KEY</code> to <code>server/.env</code> to enable AI features.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Left: Input (3 columns) */}
                <div className="md:col-span-3 flex flex-col gap-4">
                    <div className="card shadow-card border-indigo-100 flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-slate-700">Source Material</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tooLong ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {inputText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                                >
                                    Upload File
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".txt,.md,.pdf"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <textarea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="Paste text here or upload a file..."
                            className="flex-1 w-full bg-slate-50/50 rounded-xl border-none outline-none p-4 text-sm leading-relaxed text-slate-800 placeholder:text-slate-300 resize-none font-mono"
                        />

                        {error && <p className="text-xs text-red-500 mt-3">⚠ {error}</p>}
                    </div>
                </div>

                {/* Right: Controls & Prompt (2 columns) */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="card shadow-card border-emerald-50 bg-emerald-50/20">
                        <p className="text-sm font-bold text-slate-700 mb-4">Select Focus</p>
                        <div className="flex flex-col gap-2">
                            {PROMPTS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setActivePrompt(p.id)}
                                    className={`text-left p-3 rounded-xl border transition-all ${activePrompt === p.id
                                        ? 'bg-white border-indigo-300 shadow-sm'
                                        : 'bg-transparent border-transparent hover:border-slate-200 grayscale opacity-60'
                                        }`}
                                >
                                    <p className="text-sm font-bold text-indigo-700">{p.label}</p>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{p.desc}</p>
                                </button>
                            ))}
                        </div>

                        <button
                            id="btn-summarize"
                            onClick={handleProcess}
                            disabled={loading || !inputText.trim() || tooShort || tooLong}
                            className="btn-primary w-full mt-6 py-3.5 shadow-indigo-200 shadow-lg flex items-center justify-center gap-2"
                        >
                            {loading ? 'Processing...' : 'Boost My Notes ✨'}
                        </button>
                    </div>

                    {/* Output (shown inline if space allows, or below) */}
                    {summary && (
                        <div className="card shadow-card-md border-indigo-200 bg-white animate-scale-in">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-bold text-indigo-800">Smart Output</span>
                                <CopyButton text={summary} />
                            </div>
                            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                                {summary}
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 italic">
                                Note: Outputs are grounded in input text. Verify and append to your records.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* File Upload Generator — Phase 2 */}
            <div className="mt-6">
                <FileUploadGenerator />
            </div>
        </div>
    );
}









































































































































































































































































































































































































































































































































































































































