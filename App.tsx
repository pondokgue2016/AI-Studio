
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { CONTENT_STYLES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_MULTIPLE_FILES, TTS_VOICES, SCRIPT_STYLES, LANGUAGES, ORIENTATIONS, APP_VERSION } from './constants';
import { ContentStyle, GeneratedContentState, ToastMessage, UploadedFile, UploadedFilesState, GeneratedImage, ScriptStyle, AppView, UserProfile } from './types';
import * as GeminiService from './services/geminiService';
import { Part } from '@google/genai';

// Type assertion for JSZip from CDN
declare const JSZip: any;
// Type assertion for AI Studio utilities
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    var aistudio: AIStudio;
    interface Window {
        wp_user?: {
            name: string;
            email: string;
        };
    }
}

// --- Icons ---
const SpinnerIcon = () => (
    <svg className="animate-spin h-6 w-6 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const PlaceholderIcon = () => (
    <svg className="mx-auto h-16 w-16 text-indigo-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6l.01.01M3 3h18v18H3V3z"></path></svg>
);

const CloseIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
);

const MenuIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
);

const DashboardIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
);

const MagicIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
);

const SettingsIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
);

const HelpIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
);

const DownloadIconSmall = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
);

const VideoIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
);

const CopyIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
);

// --- Child Components ---

interface FileInputProps {
    id: string;
    label: string;
    files: UploadedFile | UploadedFile[] | null;
    onFilesChange: (id: string, newFiles: UploadedFile[]) => void;
    onFileRemove: (id: string, index: number) => void;
    multiple?: boolean;
    maxFiles?: number;
    accept?: string;
}
const FileInput: React.FC<FileInputProps> = ({ id, label, files, onFilesChange, onFileRemove, multiple = false, maxFiles = 1, accept = "image/png, image/jpeg, image/webp" }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileProcessing = useCallback(async (fileList: FileList) => {
        let filesToProcess = Array.from(fileList);
        const currentFiles = Array.isArray(files) ? files : (files ? [files] : []);

        if (multiple && (currentFiles.length + filesToProcess.length > (maxFiles ?? MAX_MULTIPLE_FILES))) {
            filesToProcess = filesToProcess.slice(0, (maxFiles ?? MAX_MULTIPLE_FILES) - currentFiles.length);
        }

        const newUploadedFiles: UploadedFile[] = [];
        for (const file of filesToProcess) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                continue;
            }
            try {
                const base64Url = await GeminiService.readFileAsBase64(file);
                newUploadedFiles.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64Url.split(',')[1],
                    previewUrl: base64Url
                });
            } catch (error) {
                console.error("Error reading file:", error);
            }
        }
        if (newUploadedFiles.length > 0) {
            onFilesChange(id, newUploadedFiles);
        }
    }, [files, multiple, maxFiles, onFilesChange, id]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleFileProcessing(e.dataTransfer.files);
    }, [handleFileProcessing]);

    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragOver(true);
        } else if (e.type === 'dragleave') {
            setIsDragOver(false);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileProcessing(e.target.files);
        }
        e.target.value = ''; // Reset to allow re-uploading the same file
    };

    const filesArray = useMemo(() => Array.isArray(files) ? files : (files ? [files] : []), [files]);

    return (
        <div className="space-y-2">
            <label className="block text-xs uppercase font-bold text-gray-500 tracking-wider">{label}</label>
            <div
                className={`group rounded-xl p-6 text-center cursor-pointer border border-dashed transition-all duration-300 ${
                    isDragOver 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
                }`}
                onDrop={handleDrop}
                onDragEnter={handleDragEvents}
                onDragOver={handleDragEvents}
                onDragLeave={handleDragEvents}
                onClick={() => document.getElementById(`file-input-${id}`)?.click()}
            >
                <div className="flex flex-col items-center justify-center space-y-2">
                    <svg className={`w-8 h-8 transition-colors ${isDragOver ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <span className="text-xs text-gray-500">Drag & drop atau <span className="text-indigo-600 font-semibold hover:underline">klik untuk upload</span></span>
                </div>
                <input type="file" id={`file-input-${id}`} className="hidden" accept={accept} multiple={multiple} onChange={handleInputChange} />
            </div>
            {filesArray.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                    {filesArray.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="relative w-20 h-20 bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 group hover:shadow-md transition-shadow" title={file.name}>
                            <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            <button
                                onClick={() => onFileRemove(id, index)}
                                className="absolute top-1 right-1 bg-white/90 text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-50 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    // --- State ---
    const [currentView, setCurrentView] = useState<AppView>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isStrategyMenuOpen, setIsStrategyMenuOpen] = useState(true);
    
    // User Profile State
    const [userProfile, setUserProfile] = useState<UserProfile>({
        name: 'Creator',
        plan: 'Pro',
        apiKey: ''
    });

    // Content State
    const [selectedStyle, setSelectedStyle] = useState<ContentStyle | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({ product: null, model: null, background: null, fashionItems: [], locations: [] });
    const [generatedContent, setGeneratedContent] = useState<GeneratedContentState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    // Form Inputs
    const [description, setDescription] = useState('');
    const [travelDescription, setTravelDescription] = useState('');
    const [language, setLanguage] = useState('id-ID');
    const [scriptStyle, setScriptStyle] = useState<ScriptStyle>('direct');
    const [ttsVoice, setTtsVoice] = useState('Kore');
    const [orientation, setOrientation] = useState('9:16');
    const [script, setScript] = useState('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    
    // Video Modal State
    const [videoModalData, setVideoModalData] = useState<{
        isOpen: boolean;
        imageUrl: string | null;
        prompt: string;
    }>({ isOpen: false, imageUrl: null, prompt: '' });

    // Prompt Lab State
    const [promptLabMode, setPromptLabMode] = useState<'expander' | 'scanner'>('expander');
    const [promptInput, setPromptInput] = useState('');
    const [promptResult, setPromptResult] = useState('');
    const [promptImage, setPromptImage] = useState<UploadedFile | null>(null);
    const [isPromptLoading, setIsPromptLoading] = useState(false);

    // --- Effects ---
    
    // Load User Profile from Local Storage
    useEffect(() => {
        const storedProfile = localStorage.getItem('engageProProfile');
        if (storedProfile) {
            const parsed = JSON.parse(storedProfile);
            setUserProfile(parsed);
            if (parsed.apiKey) GeminiService.setLocalApiKey(parsed.apiKey);
        } else {
            // Default check for environment vars if no local profile
             // @ts-ignore
             if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
                 // @ts-ignore
                GeminiService.setLocalApiKey(import.meta.env.VITE_API_KEY);
            }
        }
    }, []);

    // Check for WordPress User
    useEffect(() => {
        if (typeof window !== 'undefined' && window.wp_user) {
            setUserProfile(prev => ({
                ...prev,
                name: window.wp_user!.name || prev.name
            }));
        }
    }, []);

    // Save User Profile to Local Storage when it changes
    useEffect(() => {
        localStorage.setItem('engageProProfile', JSON.stringify(userProfile));
        if (userProfile.apiKey) GeminiService.setLocalApiKey(userProfile.apiKey);
    }, [userProfile]);

    useEffect(() => {
        setScript(generatedContent?.tiktokScript || '');
    }, [generatedContent?.tiktokScript]);

    // --- Callbacks & Handlers ---

    const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    }, []);

    const handleStyleSelect = useCallback((style: ContentStyle) => {
        setSelectedStyle(style);
        setCurrentView('dashboard');
        setGeneratedContent(null);
        setUploadedFiles({ product: null, model: null, background: null, fashionItems: [], locations: [] });
        // Close sidebar on mobile after selection
        if (window.innerWidth < 1024) setSidebarOpen(false);
    }, []);

    const handleFilesChange = useCallback((id: string, newFiles: UploadedFile[]) => {
        setUploadedFiles(prev => {
            const isMultiple = Array.isArray(prev[id as keyof UploadedFilesState]);
            if (isMultiple) {
                return { ...prev, [id]: [...(prev[id as keyof UploadedFilesState] as UploadedFile[]), ...newFiles] };
            } else {
                return { ...prev, [id]: newFiles[0] };
            }
        });
    }, []);
    
    const handleFileRemove = useCallback((id: string, index: number) => {
        setUploadedFiles(prev => {
            const isMultiple = Array.isArray(prev[id as keyof UploadedFilesState]);
            if (isMultiple) {
                const updatedFiles = [...(prev[id as keyof UploadedFilesState] as UploadedFile[])];
                updatedFiles.splice(index, 1);
                return { ...prev, [id]: updatedFiles };
            } else {
                return { ...prev, [id]: null };
            }
        });
    }, []);

    const resetUI = () => {
        setGeneratedContent(null);
        setAudioUrl(null);
    };

    const isApiKeyAvailable = useMemo(() => {
        // @ts-ignore
        const hasViteKey = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY;
        return !!(userProfile.apiKey || hasViteKey);
    }, [userProfile.apiKey]);

    // --- Prompt Lab Handlers ---

    const handleMagicPrompt = async () => {
        if (!promptInput.trim()) return showToast("Masukkan ide teks terlebih dahulu.", 'warning');
        setIsPromptLoading(true);
        try {
            const result = await GeminiService.generateMagicPrompt(promptInput);
            setPromptResult(result);
            showToast("Magic Prompt berhasil dibuat!", 'success');
        } catch (error: any) {
            showToast(`Gagal membuat prompt: ${error.message}`, 'error');
        } finally {
            setIsPromptLoading(false);
        }
    };

    const handleImageAnalysis = async () => {
        if (!promptImage) return showToast("Upload gambar referensi terlebih dahulu.", 'warning');
        setIsPromptLoading(true);
        try {
            const result = await GeminiService.analyzeImageToPrompt(promptImage);
            setPromptResult(result);
            showToast("Analisis gambar selesai!", 'success');
        } catch (error: any) {
            showToast(`Gagal menganalisis: ${error.message}`, 'error');
        } finally {
            setIsPromptLoading(false);
        }
    };

    const handleCopyPrompt = () => {
        if (!promptResult) return;
        navigator.clipboard.writeText(promptResult);
        showToast("Prompt disalin ke clipboard!", 'success');
    };

    // --- Content Generation Handlers ---

    const startGenerationProcess = useCallback(async () => {
        if (!isApiKeyAvailable) {
             showToast("API Key belum diatur. Silakan ke menu Pengaturan.", 'error');
             setCurrentView('settings');
             return;
        }

        if (!selectedStyle) {
            showToast("Silakan pilih gaya konten terlebih dahulu.", 'error');
            return;
        }

        const descriptionlessStyles: ContentStyle[] = ['fashion_broll', 'treadmill_fashion_show', 'aesthetic_hands_on'];
        const currentDescription = ['travel', 'property'].includes(selectedStyle) ? travelDescription : description;
        if (!currentDescription && !descriptionlessStyles.includes(selectedStyle)) {
             showToast("Harap masukkan Deskripsi Teks.", 'error');
             return;
        }
        
        setIsLoading(true);
        resetUI();
        
        try {
            setLoadingMessage("Menganalisis & merancang rencana kreatif...");
            const plan = await GeminiService.getCreativePlan(selectedStyle, uploadedFiles, currentDescription, language, scriptStyle, orientation);
            
            const promptsToGenerate = plan.shotPrompts;
            
            // --- NEW: Sequential Logic for Free Tier Safety ---
            // Instead of Promise.all, we use a loop with delay.
            
            const images: GeneratedImage[] = [];
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            if (selectedStyle === 'treadmill_fashion_show') {
                if (uploadedFiles.fashionItems.length === 0) {
                    throw new Error("Silakan unggah setidaknya satu 'Fashion Item'.");
                }
                
                for (let i = 0; i < uploadedFiles.fashionItems.length; i++) {
                    const item = uploadedFiles.fashionItems[i];
                    setLoadingMessage(`Membuat gambar ${i + 1} dari ${uploadedFiles.fashionItems.length} (Antrian Aman)...`);

                    const referenceParts: Part[] = [{ text: `Aset Utama (Item Fashion):` }, { inlineData: { mimeType: item.type, data: item.data }}];
                    if (uploadedFiles.background) referenceParts.push({ text: "Gambar Latar:" }, { inlineData: { mimeType: uploadedFiles.background.type, data: uploadedFiles.background.data }});
                    if (uploadedFiles.model) referenceParts.push({ text: "Foto Model (Referensi Pose/Orang):" }, { inlineData: { mimeType: uploadedFiles.model.type, data: uploadedFiles.model.data }});
                    
                    try {
                        const result = await GeminiService.generateSingleImage(promptsToGenerate[0], referenceParts);
                        images.push({ ...result, prompt: promptsToGenerate[0] });
                    } catch (e) {
                         images.push({ success: false, base64: null, prompt: promptsToGenerate[0], error: "Generation failed" });
                    }

                    // Delay to prevent Rate Limit (429) on Free Tier
                    if (i < uploadedFiles.fashionItems.length - 1) await delay(3000); 
                }

            } else {
                 for (let i = 0; i < promptsToGenerate.length; i++) {
                    const prompt = promptsToGenerate[i];
                    setLoadingMessage(`Membuat gambar ${i + 1} dari ${promptsToGenerate.length} (Antrian Aman)...`);

                    const referenceParts: Part[] = []; 
                    if (uploadedFiles.product) referenceParts.push({ text: "Aset Utama (Produk):" }, { inlineData: { mimeType: uploadedFiles.product.type, data: uploadedFiles.product.data }});
                    uploadedFiles.locations.forEach(l => referenceParts.push({ text: `Aset Utama (Lokasi/Properti/Makanan):` }, { inlineData: { mimeType: l.type, data: l.data }}));
                    
                    const isFoodShot2 = selectedStyle === 'food_promo' && i === 1;
                    if (!isFoodShot2 && uploadedFiles.model) {
                         referenceParts.push({ text: "Foto Model (Referensi Pose/Orang):" }, { inlineData: { mimeType: uploadedFiles.model.type, data: uploadedFiles.model.data }});
                    }
                    if (uploadedFiles.background) referenceParts.push({ text: "Gambar Latar:" }, { inlineData: { mimeType: uploadedFiles.background.type, data: uploadedFiles.background.data }});

                    try {
                        const result = await GeminiService.generateSingleImage(prompt, referenceParts);
                        images.push({ ...result, prompt });
                    } catch (e) {
                         images.push({ success: false, base64: null, prompt, error: "Generation failed" });
                    }

                    // Delay to prevent Rate Limit (429) on Free Tier
                    if (i < promptsToGenerate.length - 1) await delay(3000);
                }
            }
            
            const failure = images.find(img => !img.success);
            if (failure && failure.error) {
                if (failure.error.includes("403") || failure.error.includes("API Key")) {
                    throw new Error("API Key tidak valid atau kedaluwarsa. Periksa pengaturan.");
                }
            }

            const successfulImages = images.filter(img => img.success);
            if (successfulImages.length === 0) {
                 const firstError = failure?.error || "Unknown Error";
                throw new Error(`Gagal membuat semua gambar. Detail: ${firstError}`);
            }

            setLoadingMessage("Membuat saran animasi...");
            
            const animationPromises = images.map(image => {
                if (image.success) {
                    return GeminiService.getAnimationPrompt(image.prompt);
                } else {
                    return Promise.resolve(null);
                }
            });
            
            const animationPrompts = await Promise.all(animationPromises);

            setGeneratedContent({
                tiktokScript: plan.tiktokScript,
                shotPrompts: plan.shotPrompts,
                generatedImages: images,
                animationPrompts,
                audioBlob: null,
                tiktokMetadata: plan.tiktokMetadata,
            });
            
            showToast("Konten berhasil dibuat!", 'success');
            if (images.some(img => !img.success)) {
                showToast("Beberapa gambar gagal dibuat.", 'warning');
            }

        } catch (error: any) {
            console.error("Kesalahan pada proses generasi:", error);
            const errorMessage = error.message || "Terjadi kesalahan yang tidak diketahui.";
             if (errorMessage.includes("permission denied") || errorMessage.includes("API Key")) {
                showToast("Masalah API Key. Silakan cek menu Pengaturan.", 'error');
            } else {
                showToast(`Error: ${errorMessage}`, 'error');
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [selectedStyle, uploadedFiles, description, travelDescription, language, scriptStyle, orientation, showToast, isApiKeyAvailable]);
    
    const handleTranslate = async () => {
        if (!script) return;
        setIsLoading(true);
        setLoadingMessage("Menerjemahkan naskah...");
        try {
            const translated = await GeminiService.translateScript(script, language, scriptStyle);
            setScript(translated);
            showToast('Naskah berhasil diterjemahkan.', 'success');
        } catch (error: any) {
            showToast(`Gagal menerjemahkan: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTts = async () => {
        if (!script) return;
        setIsLoading(true);
        setLoadingMessage("Membuat audio...");
        try {
            const blob = await GeminiService.generateTTSAudio(script, language, ttsVoice);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setGeneratedContent(prev => prev ? { ...prev, audioBlob: blob } : null);
            showToast('Audio berhasil dibuat.', 'success');
        } catch (error: any) {
            showToast(`Gagal membuat audio: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadSingleImage = (base64Data: string, index: number) => {
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${base64Data}`;
        link.download = `engagepro_shot_${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenVideoModal = (index: number) => {
        if (!generatedContent) return;
        const img = generatedContent.generatedImages[index];
        const animPrompt = generatedContent.animationPrompts[index] || "Cinematic movement, high quality, 4k";

        if (img.base64) {
            // Auto copy prompt to clipboard
            navigator.clipboard.writeText(animPrompt).then(() => {
                showToast("Prompt animasi disalin ke clipboard!", 'success');
            }).catch(() => {
                showToast("Prompt siap disalin di modal.", 'info');
            });

            setVideoModalData({
                isOpen: true,
                imageUrl: `data:image/png;base64,${img.base64}`,
                prompt: animPrompt
            });
        }
    };

    const handleDownloadAudio = () => {
        if (!audioUrl) return;
        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = `engagepro_audio.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownload = async () => {
        if (!generatedContent || generatedContent.generatedImages.filter(i => i.success).length === 0) {
            showToast("Tidak ada aset untuk diunduh.", 'warning');
            return;
        }
        showToast("Mempersiapkan file ZIP...", 'info');
        try {
            const zip = new JSZip();

            let scriptContent = "";
            if (generatedContent.tiktokMetadata) {
                scriptContent += `Deskripsi TikTok:\n${generatedContent.tiktokMetadata.description}\n\n`;
                scriptContent += `Keywords:\n${generatedContent.tiktokMetadata.keywords.join(", ")}\n\n`;
                scriptContent += "====================\n\n";
            }
            if (generatedContent.tiktokScript) {
                scriptContent += `Naskah Video:\n${generatedContent.tiktokScript}`;
            }

            if (scriptContent) {
                zip.file("Naskah_dan_Metadata.txt", scriptContent);
            }
            
            if (generatedContent.audioBlob) zip.file("audio.wav", generatedContent.audioBlob);
            
            const imgFolder = zip.folder("Gambar_Storyboard");
            let animationSuggestions = "SARAN ANIMASI:\n\n";
            let imageCount = 0;

            generatedContent.generatedImages.forEach((image, index) => {
                if (image.success && image.base64) {
                    imageCount++;
                    imgFolder.file(`gambar_${imageCount}.png`, image.base64, { base64: true });
                    const anim = generatedContent.animationPrompts[index];
                    if (anim) animationSuggestions += `Gambar ${imageCount}: ${anim}\n`;
                }
            });

            if (generatedContent.animationPrompts.some(a => a)) {
                zip.file("Saran_Animasi.txt", animationSuggestions);
            }
            
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `EngagePro_Assets_${selectedStyle}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("File ZIP berhasil diunduh!", 'success');
        } catch (error: any) {
             showToast(`Gagal membuat ZIP: ${error.message}`, 'error');
        }
    };

    // --- Derived State for Logic ---
    const scriptlessStyles: ContentStyle[] = useMemo(() => ['fashion_broll', 'treadmill_fashion_show', 'aesthetic_hands_on'], []);
    const showScriptSection = selectedStyle && !scriptlessStyles.includes(selectedStyle);
    const mainAssetConfig = useMemo(() => {
        if (!selectedStyle) return null;
        switch (selectedStyle) {
            case 'direct':
            case 'quick_review':
            case 'fashion_broll':
            case 'aesthetic_hands_on':
                return { id: 'product', label: 'Gambar Produk Utama (Wajib, 1)', multiple: false, maxFiles: 1, files: uploadedFiles.product };
            case 'travel':
            case 'property':
                return { id: 'locations', label: 'Foto Properti/Lokasi Utama (Wajib, Maks 6)', multiple: true, maxFiles: MAX_MULTIPLE_FILES, files: uploadedFiles.locations };
            case 'food_promo':
                 return { id: 'locations', label: `Unggah Foto Makanan/Minuman (Wajib, Maks ${MAX_MULTIPLE_FILES})`, multiple: true, maxFiles: MAX_MULTIPLE_FILES, files: uploadedFiles.locations };
            case 'treadmill_fashion_show':
                return { id: 'fashionItems', label: `Item Fashion (Wajib, Maks ${MAX_MULTIPLE_FILES})`, multiple: true, maxFiles: MAX_MULTIPLE_FILES, files: uploadedFiles.fashionItems };
            default:
                return null;
        }
    }, [selectedStyle, uploadedFiles]);

    const stylesRequiringDescription: (ContentStyle | null)[] = useMemo(() => ['direct', 'quick_review', 'food_promo'], []);
    const stylesRequiringTravelDesc: (ContentStyle | null)[] = useMemo(() => ['travel', 'property'], []);
    const currentStyleName = selectedStyle ? CONTENT_STYLES.find(s => s.id === selectedStyle)?.name : '';
    const currentStyleDesc = selectedStyle ? CONTENT_STYLES.find(s => s.id === selectedStyle)?.description : '';

    // --- RENDERERS ---

    const renderSidebar = () => (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#111827] text-gray-100 transition-transform duration-300 transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                         <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-1.5 rounded-lg shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <div>
                             <h1 className="text-lg font-bold tracking-tight">EngagePro</h1>
                             <span className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded ml-1">{APP_VERSION}</span>
                        </div>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {/* Content Strategy Accordion */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsStrategyMenuOpen(!isStrategyMenuOpen)}
                            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <div className="flex items-center">
                                <DashboardIcon />
                                <span className="font-medium">Strategi Konten</span>
                            </div>
                            <ChevronDownIcon className={`transform transition-transform ${isStrategyMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isStrategyMenuOpen && (
                            <div className="pl-11 space-y-1 animate-toastIn">
                                {CONTENT_STYLES.map((style) => (
                                    <button
                                        key={style.id}
                                        onClick={() => handleStyleSelect(style.id)}
                                        className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${selectedStyle === style.id && currentView === 'dashboard' ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
                                    >
                                        {style.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-800">
                        <button
                            onClick={() => { setCurrentView('prompt_lab'); setSidebarOpen(false); }}
                            className={`flex items-center w-full px-4 py-3 rounded-lg transition-all ${currentView === 'prompt_lab' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <MagicIcon />
                            <span className="font-medium">Prompt Lab</span>
                        </button>
                        <button
                            onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }}
                            className={`flex items-center w-full px-4 py-3 rounded-lg transition-all ${currentView === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <SettingsIcon />
                            <span className="font-medium">Pengaturan</span>
                        </button>
                        <button
                            onClick={() => { setCurrentView('help'); setSidebarOpen(false); }}
                            className={`flex items-center w-full px-4 py-3 rounded-lg transition-all ${currentView === 'help' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                            <HelpIcon />
                            <span className="font-medium">Bantuan</span>
                        </button>
                    </div>
                </nav>

                {/* User Profile Footer */}
                <div className="p-4 border-t border-gray-800 bg-[#0d121f]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                            {userProfile.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">{userProfile.name}</p>
                            <p className="text-xs text-indigo-400">Creator</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );

    const renderPromptLab = () => (
        <div className="max-w-4xl mx-auto animate-toastIn h-full flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-6">
                <button 
                    onClick={() => { setPromptLabMode('expander'); setPromptResult(''); }}
                    className={`pb-4 px-6 text-sm font-medium transition-all relative ${promptLabMode === 'expander' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Magic Prompt Expander
                </button>
                <button 
                    onClick={() => { setPromptLabMode('scanner'); setPromptResult(''); }}
                    className={`pb-4 px-6 text-sm font-medium transition-all relative ${promptLabMode === 'scanner' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Image Scanner (Reverse Engineering)
                </button>
            </div>

            {/* Content Area */}
            <div className="grid lg:grid-cols-2 gap-8 flex-1">
                {/* Input Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit">
                    {promptLabMode === 'expander' ? (
                        <>
                            <h3 className="font-bold text-gray-900 mb-2">Ide Sederhana</h3>
                            <p className="text-xs text-gray-500 mb-4">Masukkan ide singkat, AI akan mengubahnya menjadi prompt detail.</p>
                            <textarea 
                                value={promptInput}
                                onChange={(e) => setPromptInput(e.target.value)}
                                placeholder='Contoh: "Sepatu lari warna merah di jalan aspal saat hujan"'
                                className="w-full h-40 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4"
                            ></textarea>
                            <button 
                                onClick={handleMagicPrompt}
                                disabled={isPromptLoading}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {isPromptLoading ? <SpinnerIcon /> : <><MagicIcon /> Expand Magic Prompt</>}
                            </button>
                        </>
                    ) : (
                        <>
                            <h3 className="font-bold text-gray-900 mb-2">Upload Referensi</h3>
                            <p className="text-xs text-gray-500 mb-4">Upload gambar viral/keren, AI akan membuatkan prompt untuk menirunya.</p>
                            <FileInput 
                                id="promptImage" 
                                label="Gambar Referensi" 
                                files={promptImage} 
                                onFilesChange={(id, files) => setPromptImage(files[0])} 
                                onFileRemove={() => setPromptImage(null)} 
                            />
                            <button 
                                onClick={handleImageAnalysis}
                                disabled={isPromptLoading}
                                className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {isPromptLoading ? <SpinnerIcon /> : <><MagicIcon /> Scan & Generate Prompt</>}
                            </button>
                        </>
                    )}
                </div>

                {/* Output Section */}
                <div className="bg-gray-900 text-gray-100 p-6 rounded-2xl shadow-lg flex flex-col h-full min-h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-sm">Hasil Prompt (English)</h3>
                        <button 
                            onClick={handleCopyPrompt}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors"
                        >
                            <CopyIcon /> Copy
                        </button>
                    </div>
                    
                    <div className="flex-1 bg-gray-800/50 rounded-xl p-4 border border-gray-700 font-mono text-sm leading-relaxed overflow-y-auto custom-scrollbar">
                        {promptResult ? (
                            promptResult
                        ) : (
                            <span className="text-gray-500 italic">
                                {isPromptLoading ? "Sedang memproses..." : "Hasil prompt akan muncul di sini..."}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">Cocok untuk: Midjourney, Stable Diffusion, Flux, Dreamina.</p>
                </div>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="animate-toastIn h-full">
            {!selectedStyle ? (
                // Welcome / Empty State
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
                    <div className="bg-white p-8 rounded-full shadow-lg mb-6 ring-4 ring-indigo-50">
                        <svg className="w-16 h-16 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Selamat Datang di EngagePro Studio</h2>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">Pilih strategi konten dari menu di sebelah kiri untuk mulai membuat aset marketing viral Anda.</p>
                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg">Buka Menu</button>
                </div>
            ) : (
                // Workspace Layout
                <div className="lg:grid lg:grid-cols-3 lg:gap-8 h-full">
                    {/* Left Column: Config */}
                    <div className="lg:col-span-1 space-y-6">
                        <section>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">{currentStyleName}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{currentStyleDesc}</p>
                                    </div>
                                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-bold shrink-0 ml-2">Langkah 1</span>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Upload Assets */}
                                    {mainAssetConfig && <FileInput {...mainAssetConfig} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}
                                    {selectedStyle && !['aesthetic_hands_on'].includes(selectedStyle) && <FileInput id="model" label="Foto Model (Opsional)" files={uploadedFiles.model} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}
                                    {selectedStyle && ['fashion_broll', 'treadmill_fashion_show', 'aesthetic_hands_on', 'food_promo'].includes(selectedStyle) && <FileInput id="background" label="Foto Latar (Opsional)" files={uploadedFiles.background} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}
                                
                                    <hr className="border-gray-100 my-4"/>

                                    {/* Configuration */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Orientasi</label>
                                            <select value={orientation} onChange={e => setOrientation(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none">
                                                {ORIENTATIONS.map(orient => <option key={orient.id} value={orient.id}>{orient.name}</option>)}
                                            </select>
                                        </div>
                                        {/* Added Language Selector */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Bahasa</label>
                                            <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none">
                                                {LANGUAGES.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
                                            </select>
                                        </div>
                                        {showScriptSection && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Gaya Naskah</label>
                                                <select value={scriptStyle} onChange={e => setScriptStyle(e.target.value as ScriptStyle)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none">
                                                    {SCRIPT_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* Descriptions */}
                                    <div className="mt-4">
                                        {stylesRequiringDescription.includes(selectedStyle) && <div className="space-y-1"><label className="block text-xs font-medium text-gray-500">Deskripsi Konten</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Jelaskan produk anda..."></textarea></div>}
                                        {stylesRequiringTravelDesc.includes(selectedStyle) && <div className="space-y-1"><label className="block text-xs font-medium text-gray-500">Deskripsi Lokasi</label><textarea rows={3} value={travelDescription} onChange={e => setTravelDescription(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Jelaskan lokasi/properti..."></textarea></div>}
                                    </div>
                                </div>

                                <button onClick={startGenerationProcess} disabled={isLoading} className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl text-md transition-all shadow-md flex items-center justify-center gap-2">
                                    {isLoading && generatedContent === null ? (
                                        <><div className='animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full'></div> Proses...</>
                                    ) : (
                                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Generate Magic</>
                                    )}
                                </button>
                            </div>
                        </section>
                    </div>
                    
                    {/* Right Column: Results */}
                    <div className="lg:col-span-2 mt-8 lg:mt-0">
                        {!generatedContent ? (
                            <div className="h-full min-h-[400px] flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-2xl">
                                <div className="text-center p-8">
                                    <PlaceholderIcon />
                                    <p className="mt-4 text-gray-500 text-sm">Hasil kreatif Anda akan muncul di sini.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Visuals */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-bold uppercase text-gray-700">Visual Storyboard</h3>
                                        <button onClick={handleDownload} className="text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-100 flex items-center gap-1">
                                            <DownloadIconSmall /> Download All
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {generatedContent.generatedImages.map((image, index) => (
                                            <div key={index} className="flex flex-col gap-2">
                                                <div className='bg-gray-50 rounded-lg overflow-hidden relative border border-gray-100 aspect-[9/16] group'>
                                                    {image.success && image.base64 ? (
                                                        <>
                                                            <img src={`data:image/png;base64,${image.base64}`} alt={`Shot ${index + 1}`} className="w-full h-full object-cover" />
                                                            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">Shot {index+1}</div>
                                                            
                                                            {/* Individual Image Buttons */}
                                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleOpenVideoModal(index)}
                                                                    className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors backdrop-blur-sm"
                                                                    title="Buat Video AI"
                                                                >
                                                                    <VideoIcon />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDownloadSingleImage(image.base64!, index)}
                                                                    className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors backdrop-blur-sm"
                                                                    title="Download Gambar Ini"
                                                                >
                                                                    <DownloadIconSmall />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full text-red-400 text-xs">Gagal Load</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Script & Audio */}
                                {showScriptSection && generatedContent.tiktokScript && (
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold uppercase text-gray-700">Naskah & Audio</h3>
                                            <div className="flex gap-2">
                                                <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1 outline-none">
                                                    {TTS_VOICES.map(voice => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                                                </select>
                                                <button onClick={handleTts} disabled={isLoading} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1">
                                                    {audioUrl ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                                                    Generate Audio
                                                </button>
                                            </div>
                                        </div>
                                        <textarea rows={4} value={script} onChange={e => setScript(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed"></textarea>
                                        
                                        {audioUrl && (
                                            <div className="flex items-center gap-2 mt-3">
                                                <audio controls src={audioUrl} className="w-full h-8 flex-1"></audio>
                                                <button 
                                                    onClick={handleDownloadAudio}
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors border border-gray-200"
                                                    title="Download Audio (.wav)"
                                                >
                                                    <DownloadIconSmall />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderSettings = () => (
        <div className="max-w-2xl mx-auto animate-toastIn">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Pengaturan Akun</h2>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nama Pengguna</label>
                        <input 
                            type="text" 
                            value={userProfile.name} 
                            onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                        <input 
                            type="password" 
                            value={userProfile.apiKey} 
                            onChange={(e) => setUserProfile(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                        />
                         <p className="text-xs text-gray-500 mt-2">
                            Dapatkan API Key di <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline">Google AI Studio</a>. Key disimpan secara lokal di browser Anda.
                        </p>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end">
                    <button onClick={() => showToast("Pengaturan tersimpan!", 'success')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    );

    const renderHelp = () => (
         <div className="max-w-3xl mx-auto animate-toastIn pb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Pusat Bantuan</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Ambil API Key</h3>
                    <p className="text-gray-500 text-sm">Dapatkan Google Gemini API Key secara gratis di sini untuk mulai membuat konten.</p>
                </a>

                <a href="https://www.youtube.com/watch?v=ne3SLfF_gk0" target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Tutorial Video</h3>
                    <p className="text-gray-500 text-sm">Tonton panduan langkah demi langkah cara membuat API Key di YouTube.</p>
                </a>

                <a href="https://chat.whatsapp.com/Eizt8X0XsSr9fsRObnOWTM" target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Komunitas WhatsApp</h3>
                    <p className="text-gray-500 text-sm">Bergabung dengan kreator lain dan dapatkan update terbaru.</p>
                </a>
                 
                <a href="mailto:info@pondokgue.digital" className="col-span-1 md:col-span-2 bg-indigo-50 p-6 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all text-center">
                    <p className="text-indigo-800 font-medium">Butuh bantuan teknis? <span className="font-bold underline">Hubungi Admin via Email</span></p>
                </a>
            </div>

            {/* Text Tutorial Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Panduan Lengkap: Cara Membuat API Key</h3>
                
                <div className="space-y-8 text-sm text-gray-600">
                    <section>
                        <p className="mb-4">
                            Google Gemini API Key adalah kunci rahasia yang memungkinkan EngagePro AI Studio terhubung dengan otak kecerdasan buatan Google. 
                            Ikuti langkah mudah berikut untuk mendapatkannya secara gratis:
                        </p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-900 text-base mb-2 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                            Masuk ke Google AI Studio
                        </h4>
                        <ul className="list-disc pl-10 space-y-1 marker:text-gray-400">
                            <li>Buka browser dan kunjungi <a href="https://aistudio.google.com" target="_blank" className="text-indigo-600 hover:underline font-medium">Google AI Studio (aistudio.google.com)</a>.</li>
                            <li>Klik tombol <strong>Sign In</strong> dan masuk menggunakan akun Google (Gmail) Anda.</li>
                            <li>Jika muncul persetujuan syarat & ketentuan, klik setuju/accept.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-900 text-base mb-2 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                            Buat Project Baru
                        </h4>
                        <ul className="list-disc pl-10 space-y-1 marker:text-gray-400">
                            <li>Di halaman utama, cari tombol <strong>"Get API key"</strong> di menu sebelah kiri atas.</li>
                            <li>Klik tombol biru bertuliskan <strong>"Create API key"</strong>.</li>
                            <li>Pilih opsi <strong>"Create API key in new project"</strong>.</li>
                            <li>Tunggu beberapa detik hingga proses selesai.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-900 text-base mb-2 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">3</span>
                            Salin & Tempel Kunci
                        </h4>
                        <ul className="list-disc pl-10 space-y-1 marker:text-gray-400">
                            <li>Akan muncul kode acak yang panjang (Dimulai dengan "AIza...").</li>
                            <li>Klik tombol <strong>Copy</strong> di sebelahnya.</li>
                            <li>Kembali ke aplikasi EngagePro AI Studio ini.</li>
                            <li>Masuk ke menu <strong>Pengaturan</strong> di sidebar kiri.</li>
                            <li>Tempel (Paste) kode tersebut ke dalam kolom "Google Gemini API Key".</li>
                            <li>Klik <strong>Simpan Perubahan</strong>. Selesai!</li>
                        </ul>
                    </section>

                    {/* FAQ Box */}
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mt-6">
                        <h4 className="font-bold text-gray-900 text-base mb-4">FAQ (Pertanyaan Umum)</h4>
                        <div className="space-y-4">
                            <div>
                                <p className="font-bold text-gray-800 text-xs uppercase mb-1">Apakah ini berbayar?</p>
                                <p>Tidak. Anda bisa menggunakan <strong>Free Tier</strong> dari Google tanpa perlu memasukkan kartu kredit. Free tier sudah cukup untuk penggunaan normal aplikasi ini.</p>
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-xs uppercase mb-1">Apa itu Error 429 (Too Many Requests)?</p>
                                <p>Jika Anda menggunakan akun gratis, Google membatasi kecepatan pembuatan. EngagePro sudah memiliki sistem antrian otomatis untuk mencegah hal ini, namun jika terjadi, cukup tunggu 1 menit lalu coba lagi.</p>
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-xs uppercase mb-1">Apakah kunci saya aman?</p>
                                <p>Ya. EngagePro menyimpan API Key Anda di dalam browser Anda sendiri (Local Storage). Kunci tidak dikirim ke server kami, melainkan langsung ke Google saat Anda menekan tombol Generate.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- Main Render Structure ---

    return (
        <div className="bg-gray-50 min-h-screen font-sans text-gray-900 flex">
            {/* Sidebar */}
            {renderSidebar()}
            
            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col lg:ml-64 min-h-screen transition-all duration-300">
                
                {/* Mobile Header (Hamburger) */}
                <header className="bg-white border-b border-gray-200 lg:hidden sticky top-0 z-40">
                    <div className="px-4 py-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <div className="bg-indigo-600 text-white p-1 rounded shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            </div>
                            <span className="font-bold text-gray-900">EngagePro AI</span>
                        </div>
                        <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-indigo-600 p-1">
                            <MenuIcon />
                        </button>
                    </div>
                </header>

                {/* Dashboard Header (Desktop) */}
                <div className="hidden lg:flex items-center justify-between px-8 py-6 bg-white border-b border-gray-200">
                     <div>
                        <h2 className="text-xl font-bold text-gray-900 capitalize">
                            {currentView === 'dashboard' ? (currentStyleName || 'Content Studio') : 
                             currentView === 'prompt_lab' ? 'Prompt Lab' :
                             currentView}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {currentView === 'dashboard' ? 'Buat aset visual dan naskah dengan AI.' : 
                             currentView === 'prompt_lab' ? 'Eksperimen dengan prompt AI Art.' :
                             currentView === 'settings' ? 'Kelola preferensi dan API Key Anda.' : 'Pusat bantuan dan tutorial.'}
                        </p>
                    </div>
                    
                    {/* Dynamic API Status */}
                    <button 
                        onClick={() => !isApiKeyAvailable && setCurrentView('settings')}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${!isApiKeyAvailable ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                    >
                        <span className="flex h-3 w-3 relative">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isApiKeyAvailable ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${isApiKeyAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </span>
                        <span className={`text-sm font-medium ${isApiKeyAvailable ? 'text-gray-500' : 'text-red-500'}`}>
                            {isApiKeyAvailable ? 'API Ready' : 'Set API Key'}
                        </span>
                    </button>
                </div>

                {/* Main Viewport */}
                <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center">
                                <SpinnerIcon />
                                <p className="mt-4 text-gray-800 font-medium animate-pulse">{loadingMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Toast Notification Container */}
                    <div className="fixed bottom-6 right-6 z-50 space-y-2 w-full max-w-sm pointer-events-none">
                        {toasts.map(toast => (
                            <div key={toast.id} className={`pointer-events-auto bg-white border-l-4 ${toast.type === 'error' ? 'border-red-500' : toast.type === 'success' ? 'border-green-500' : 'border-blue-500'} shadow-lg rounded-r-lg p-4 flex items-center animate-toastIn`}>
                                <div className="flex-1 text-sm font-medium text-gray-900">{toast.message}</div>
                            </div>
                        ))}
                    </div>

                    {/* Views */}
                    {currentView === 'dashboard' && renderDashboard()}
                    {currentView === 'prompt_lab' && renderPromptLab()}
                    {currentView === 'settings' && renderSettings()}
                    {currentView === 'help' && renderHelp()}
                </main>
            </div>

            {/* Video Modal (Global) */}
            {videoModalData.isOpen && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                     <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative flex flex-col max-h-[90vh]">
                        <button onClick={() => setVideoModalData({ ...videoModalData, isOpen: false })} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                            <CloseIcon />
                        </button>
                        
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Buat Video AI</h2>
                            <p className="text-xs text-gray-500">Gambar dan prompt telah siap.</p>
                        </div>

                        <div className="overflow-y-auto pr-1 custom-scrollbar">
                            {/* Selected Image Preview */}
                            {videoModalData.imageUrl && (
                                <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 relative group">
                                    <img src={videoModalData.imageUrl} alt="Reference" className="w-full h-48 object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <a 
                                            href={videoModalData.imageUrl} 
                                            download="reference_image.png"
                                            className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg hover:bg-gray-100"
                                         >
                                            Download Gambar
                                         </a>
                                    </div>
                                </div>
                            )}

                            {/* Prompt Box */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Prompt Animasi (Tersalin Otomatis)</label>
                                <div className="relative">
                                    <textarea 
                                        readOnly 
                                        value={videoModalData.prompt} 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 h-20 resize-none outline-none focus:ring-1 focus:ring-indigo-500"
                                    ></textarea>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(videoModalData.prompt);
                                            showToast("Prompt disalin!", 'success');
                                        }}
                                        className="absolute top-2 right-2 text-gray-400 hover:text-indigo-600 bg-white rounded p-1 shadow-sm border border-gray-100"
                                        title="Salin lagi"
                                    >
                                        <CopyIcon />
                                    </button>
                                </div>
                            </div>
                            
                            <hr className="border-gray-100 mb-6" />

                            <div className="space-y-3">
                                <p className="text-center text-sm font-medium text-gray-800 mb-2">Pilih Tools Video AI:</p>
                                <a href="https://www.meta.ai/" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 px-4 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-1.07 3.97-2.1 5.39z"/></svg>
                                    Buka Meta AI
                                </a>
                                <a href="https://dreamina.capcut.com/ai-tool/home" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gray-50 hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-xl border border-gray-200 transition-colors">Buka Dreamina (CapCut)</a>
                                <div className="grid grid-cols-2 gap-3">
                                    <a href="https://runwayml.com/" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium py-2 px-2 rounded-lg border border-gray-200 transition-colors">RunwayML</a>
                                    <a href="https://klingai.com/" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium py-2 px-2 rounded-lg border border-gray-200 transition-colors">Kling AI</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
