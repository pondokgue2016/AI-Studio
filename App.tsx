import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CONTENT_STYLES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_MULTIPLE_FILES, TTS_VOICES, SCRIPT_STYLES, LANGUAGES, ORIENTATIONS } from './constants';
import { ContentStyle, GeneratedContentState, ToastMessage, UploadedFile, UploadedFilesState, GeneratedImage, ScriptStyle } from './types';
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
}

// --- SVG Icons (Clean & Modern) ---
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

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H5v-2H3v-2H1v-4a6 6 0 0110.257-4.257M15 7A2 2 0 0013 5M15 7a2 2 0 012 2m0 0A2 2 0 0115 9m2-2a2 2 0 00-2-2" />
    </svg>
);


// --- Child Components ---

interface StyleCardProps {
  styleInfo: { id: ContentStyle; name: string };
  isSelected: boolean;
  onSelect: (style: ContentStyle) => void;
}
const StyleCard: React.FC<StyleCardProps> = ({ styleInfo, isSelected, onSelect }) => (
    <div
        className={`p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
            isSelected 
            ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500 transform scale-[1.02]' 
            : 'bg-white/80 border-gray-200 hover:border-indigo-300 hover:bg-white hover:shadow-md'
        }`}
        onClick={() => onSelect(styleInfo.id)}
    >
        <div className={`w-full h-2 rounded-full mb-3 ${isSelected ? 'bg-gradient-to-r from-indigo-500 to-blue-500' : 'bg-gray-100'}`}></div>
        <h3 className={`font-semibold text-center ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{styleInfo.name}</h3>
    </div>
);

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
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div
                className={`group rounded-xl p-8 text-center cursor-pointer border-2 border-dashed transition-all duration-300 ${
                    isDragOver 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 bg-gray-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-sm'
                }`}
                onDrop={handleDrop}
                onDragEnter={handleDragEvents}
                onDragOver={handleDragEvents}
                onDragLeave={handleDragEvents}
                onClick={() => document.getElementById(`file-input-${id}`)?.click()}
            >
                <div className="flex flex-col items-center justify-center space-y-3">
                    <div className={`p-3 rounded-full transition-colors ${isDragOver ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-400 shadow-sm group-hover:text-indigo-500 group-hover:scale-110 transform duration-300'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    </div>
                    <span className="text-sm text-gray-500">Drag & drop atau <span className="text-indigo-600 font-semibold hover:underline">klik untuk upload</span></span>
                </div>
                <input type="file" id={`file-input-${id}`} className="hidden" accept={accept} multiple={multiple} onChange={handleInputChange} />
            </div>
            {filesArray.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                    {filesArray.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="relative w-24 h-24 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 group hover:shadow-md transition-shadow" title={file.name}>
                            <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            <button
                                onClick={() => onFileRemove(id, index)}
                                className="absolute top-1 right-1 bg-white/90 text-red-500 rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-50 shadow-sm transition-all opacity-0 group-hover:opacity-100"
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
    const [selectedStyle, setSelectedStyle] = useState<ContentStyle | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({ product: null, model: null, background: null, fashionItems: [], locations: [] });
    const [generatedContent, setGeneratedContent] = useState<GeneratedContentState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [travelDescription, setTravelDescription] = useState('');
    const [language, setLanguage] = useState('id-ID');
    const [scriptStyle, setScriptStyle] = useState<ScriptStyle>('direct');
    const [ttsVoice, setTtsVoice] = useState('Kore');
    const [orientation, setOrientation] = useState('9:16');
    const [script, setScript] = useState('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isVideoModalOpen, setVideoModalOpen] = useState(false);
    const [videoPlatform, setVideoPlatform] = useState<'desktop' | 'mobile'>('desktop');
    const [isKeySelected, setIsKeySelected] = useState(false);
    const [isCheckingKey, setIsCheckingKey] = useState(true);
    const [manualKeyInput, setManualKeyInput] = useState('');

    // --- Effects ---
    const checkApiKeyStatus = useCallback(async () => {
        try {
            // Checks if the app is running in the Project IDX / Google AI Studio environment
            if (typeof window !== 'undefined' && window.aistudio) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsKeySelected(hasKey);
            } else {
                // For Local Dev: Check if VITE_API_KEY is defined in env
                // @ts-ignore
                const hasLocalKey = typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.VITE_API_KEY;
                // If not found in env, we still allow entry if user manually inputs key later, 
                // but strictly speaking we mark as 'not selected' initially unless found.
                // However, the original logic passed 'true' to skip blocking. 
                // Now we want to BLOCK if no key found, to show the input screen.
                setIsKeySelected(!!hasLocalKey); 
            }
        } catch (error) {
            console.error("Error checking API key status:", error);
            setIsKeySelected(false);
        } finally {
            setIsCheckingKey(false);
        }
    }, []);

    useEffect(() => {
        checkApiKeyStatus();
        if (!localStorage.getItem('aiDirectorVisited')) {
            setWelcomeModalOpen(true);
            localStorage.setItem('aiDirectorVisited', 'true');
        }
    }, [checkApiKeyStatus]);

    useEffect(() => {
        setScript(generatedContent?.tiktokScript || '');
    }, [generatedContent?.tiktokScript]);

    // --- Callbacks & Handlers ---
    const handleSelectKey = async () => {
        try {
            if (window.aistudio) {
                await window.aistudio.openSelectKey();
                setIsKeySelected(true);
            }
        } catch (error) {
            console.error("Failed to open select key dialog:", error);
            showToast("Gagal membuka dialog pemilihan kunci.", "error");
        }
    };
    
    const handleManualKeySubmit = () => {
        if (manualKeyInput.trim().length < 10) {
            showToast("Format API Key tidak valid.", 'error');
            return;
        }
        GeminiService.setLocalApiKey(manualKeyInput.trim());
        setIsKeySelected(true);
        showToast("API Key berhasil disimpan.", 'success');
    };

    const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    }, []);

    const handleStyleSelect = useCallback((style: ContentStyle) => {
        setSelectedStyle(style);
        setGeneratedContent(null);
        setUploadedFiles({ product: null, model: null, background: null, fashionItems: [], locations: [] });
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

    const startGenerationProcess = useCallback(async () => {
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
            
            setLoadingMessage(`Membuat semua gambar secara paralel...`);
            
            let imagePromises: Promise<GeneratedImage>[];

            if (selectedStyle === 'treadmill_fashion_show') {
                if (uploadedFiles.fashionItems.length === 0) {
                    throw new Error("Silakan unggah setidaknya satu 'Fashion Item'.");
                }
                imagePromises = uploadedFiles.fashionItems.map(async (item) => {
                    const referenceParts: Part[] = [{ text: `Aset Utama (Item Fashion):` }, { inlineData: { mimeType: item.type, data: item.data }}];
                    if (uploadedFiles.background) referenceParts.push({ text: "Gambar Latar:" }, { inlineData: { mimeType: uploadedFiles.background.type, data: uploadedFiles.background.data }});
                    if (uploadedFiles.model) referenceParts.push({ text: "Foto Model (Referensi Pose/Orang):" }, { inlineData: { mimeType: uploadedFiles.model.type, data: uploadedFiles.model.data }});
                    
                    const result = await GeminiService.generateSingleImage(promptsToGenerate[0], referenceParts);
                    return { ...result, prompt: promptsToGenerate[0] };
                });

            } else {
                 imagePromises = promptsToGenerate.map(async (prompt, index) => {
                    const referenceParts: Part[] = []; 
                    if (uploadedFiles.product) referenceParts.push({ text: "Aset Utama (Produk):" }, { inlineData: { mimeType: uploadedFiles.product.type, data: uploadedFiles.product.data }});
                    uploadedFiles.locations.forEach(l => referenceParts.push({ text: `Aset Utama (Lokasi/Properti/Makanan):` }, { inlineData: { mimeType: l.type, data: l.data }}));
                    const isFoodShot2 = selectedStyle === 'food_promo' && index === 1;
                    if (!isFoodShot2 && uploadedFiles.model) {
                         referenceParts.push({ text: "Foto Model (Referensi Pose/Orang):" }, { inlineData: { mimeType: uploadedFiles.model.type, data: uploadedFiles.model.data }});
                    }
                    if (uploadedFiles.background) referenceParts.push({ text: "Gambar Latar:" }, { inlineData: { mimeType: uploadedFiles.background.type, data: uploadedFiles.background.data }});

                    const result = await GeminiService.generateSingleImage(prompt, referenceParts);
                    return { ...result, prompt };
                });
            }
            
            const images = await Promise.all(imagePromises);
            
            // Check for specific API errors
            const failure = images.find(img => !img.success);
            if (failure && failure.error) {
                // If the error seems critical (auth), rethrow it
                if (failure.error.includes("403") || failure.error.includes("API Key")) {
                    throw new Error("API Key tidak valid atau kedaluwarsa.");
                }
            }

            const successfulImages = images.filter(img => img.success);
            if (successfulImages.length === 0) {
                 const firstError = failure?.error || "Unknown Error";
                throw new Error(`Gagal membuat semua gambar. Detail: ${firstError}`);
            }

            setLoadingMessage("Membuat saran animasi secara paralel...");
            
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
             if (errorMessage.includes("permission denied") || errorMessage.includes("Requested entity was not found") || errorMessage.includes("API Key")) {
                showToast("Kunci API tidak valid atau izin ditolak. Silakan cek Key Anda.", 'error');
                setIsKeySelected(false);
            } else {
                showToast(`Error: ${errorMessage}`, 'error');
            }
            resetUI();
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [selectedStyle, uploadedFiles, description, travelDescription, language, scriptStyle, orientation, showToast]);
    
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

    // --- Render Logic ---
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

    if (isCheckingKey) {
        return (
            <div className="bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center justify-center">
                    <SpinnerIcon />
                    <p className="text-gray-600 text-lg font-medium mt-6">Memeriksa status API Key...</p>
                </div>
            </div>
        );
    }
    
    if (!isKeySelected) {
        return (
            <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 min-h-screen flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
                    <KeyIcon />
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">API Key Diperlukan</h2>
                    <p className="text-gray-600 mb-6 text-sm">
                        Untuk menggunakan fitur canggih seperti pembuatan gambar dan audio (TTS), Anda perlu API Key.
                    </p>
                    
                    {/* Google IDX Logic */}
                     {typeof window !== 'undefined' && window.aistudio ? (
                        <button 
                            onClick={handleSelectKey}
                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg text-lg transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg mb-4"
                        >
                            Pilih API Key (Google Account)
                        </button>
                    ) : (
                        /* Localhost Logic */
                        <div className="space-y-4">
                            <div className="text-left">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Input Manual (Localhost)</label>
                                <input 
                                    type="password" 
                                    value={manualKeyInput}
                                    onChange={(e) => setManualKeyInput(e.target.value)}
                                    placeholder="Paste Gemini API Key Anda disini..."
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={handleManualKeySubmit}
                                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg text-lg transition-all shadow-md"
                            >
                                Simpan Key
                            </button>
                             <p className="text-xs text-gray-400 mt-2">Key hanya disimpan sementara di browser Anda.</p>
                        </div>
                    )}
                    
                     <p className="text-xs text-gray-500 mt-6 border-t pt-4 border-gray-100">
                        Dengan melanjutkan, Anda setuju pada <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">ketentuan penagihan Google AI</a>.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-gray-900 font-sans antialiased min-h-screen selection:bg-indigo-100 selection:text-indigo-700">
            {isLoading && <div id="loading-overlay" className="fixed inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-50 transition-all">
                <SpinnerIcon />
                <p id="loading-message" className="text-gray-800 text-lg font-medium mt-6 text-center px-4 animate-pulse tracking-wide">{loadingMessage}</p>
            </div>}
            
            <div id="toast-container" className="fixed bottom-6 right-6 z-50 space-y-3 w-full max-w-sm">
                 {toasts.map(toast => (
                    <div key={toast.id} className={`toast-content w-full bg-white border-l-4 ${toast.type === 'error' ? 'border-red-500' : toast.type === 'success' ? 'border-green-500' : 'border-blue-500'} shadow-xl rounded-r-lg pointer-events-auto overflow-hidden animate-toastIn ring-1 ring-black/5`}>
                        <div className="p-4">
                            <div className="flex items-start">
                                <div className="ml-3 w-0 flex-1 pt-0.5">
                                    <p className="text-sm font-medium text-gray-900">{toast.message}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                 ))}
            </div>

            {isWelcomeModalOpen && <div id="welcome-modal-overlay" className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
                <div id="welcome-modal-content" className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative border border-gray-100">
                    <button onClick={() => setWelcomeModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                       <CloseIcon />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Selamat Datang di EngagePro AI!</h2>
                    <p className="text-gray-600 mb-6 leading-relaxed">Aplikasi ini membantu Anda membuat aset konten marketing profesional dengan cepat dan mudah.</p>
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                             <a href="https://youtu.be/VLf_9JVS_6I" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm border border-indigo-100">Tutorial (Desktop)</a>
                             <a href="https://youtu.be/BtZdJQkF-Ro" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm border border-indigo-100">Tutorial (HP)</a>
                        </div>
                         <a href="https://chat.whatsapp.com/FkY95eKqcaQ7PdpE2H8thY?mode=wwt" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-green-50 text-green-700 hover:bg-green-100 font-semibold py-2.5 px-4 rounded-lg transition-colors border border-green-100">Masuk Grup WA</a>
                         <a href="https://wa.me/6288985584050" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 px-4 rounded-lg transition-colors">Kontak Admin</a>
                    </div>
                </div>
            </div>}

            {isVideoModalOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative border border-gray-100">
                        <button onClick={() => setVideoModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                            <CloseIcon />
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Hasilkan Video</h2>
                        <p className="text-gray-600 mb-6">Pilih platform Anda. Gunakan prompt animasi yang disarankan sebagai dasar pembuatan video.</p>
                        
                        <div className="flex border-b border-gray-200 mb-6">
                            <button 
                                onClick={() => setVideoPlatform('desktop')}
                                className={`px-6 py-3 text-sm font-medium transition-colors relative ${videoPlatform === 'desktop' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Desktop
                                {videoPlatform === 'desktop' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
                            </button>
                            <button 
                                onClick={() => setVideoPlatform('mobile')}
                                className={`px-6 py-3 text-sm font-medium transition-colors relative ${videoPlatform === 'mobile' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Handphone
                                {videoPlatform === 'mobile' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
                            </button>
                        </div>

                        {videoPlatform === 'desktop' && (
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-2">Versi Web Browser</h3>
                                 <a href="https://www.meta.ai/" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-indigo-700 border border-gray-300 font-medium py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow-md">Buka Meta AI (Web)</a>
                                 <a href="https://dreamina.capcut.com/ai-tool/home" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-indigo-700 border border-gray-300 font-medium py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow-md">Buka Dreamina (Web)</a>
                            </div>
                        )}

                        {videoPlatform === 'mobile' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-3">Aplikasi Mobile</h3>
                                    <div className="space-y-3">
                                        <a href="https://play.google.com/store/apps/details?id=com.facebook.stella" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-indigo-700 border border-gray-300 font-medium py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow-md">Buka Meta AI (App)</a>
                                        <a href="https://play.google.com/store/apps/details?id=com.lemon.dreamina" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-white hover:bg-gray-50 text-indigo-700 border border-gray-300 font-medium py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow-md">Buka Dreamina (App)</a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <header className="bg-white/80 backdrop-blur-md border-b border-white/40 shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">EngagePro AI Studio</h1>
                                <p className="text-xs text-gray-500 font-medium">AI Creative Suite for High-Conversion Content</p>
                            </div>
                        </div>
                        <div className="hidden md:block text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 font-semibold shadow-sm">
                            v1.0.0 PRO
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="lg:grid lg:grid-cols-3 lg:gap-8">
                    <div className="lg:col-span-1 space-y-8">
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-bold shadow-md">1</span>
                                Pilih Gaya Konten
                            </h2>
                            <p className="text-sm text-gray-500 mb-4 ml-11">Pilih visual style yang cocok untuk produk Anda.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                                {CONTENT_STYLES.map(styleInfo => (
                                    <StyleCard key={styleInfo.id} styleInfo={styleInfo} isSelected={selectedStyle === styleInfo.id} onSelect={handleStyleSelect} />
                                ))}
                            </div>
                        </section>
                        
                        {selectedStyle && (
                            <section className="animate-toastIn">
                                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3 mt-8 pt-8 border-t border-gray-200 lg:border-none lg:pt-0 lg:mt-0">
                                    <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-bold shadow-md">2</span>
                                    Input Aset & Konfigurasi
                                </h2>
                                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                                    {mainAssetConfig && <FileInput {...mainAssetConfig} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}
                                    
                                    {selectedStyle && !['aesthetic_hands_on'].includes(selectedStyle) && <FileInput id="model" label={selectedStyle === 'food_promo' ? "Foto Model/Influencer (Opsional, 1)" : "Foto Model (Opsional, 1)"} files={uploadedFiles.model} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}
                                    
                                    {selectedStyle && ['fashion_broll', 'treadmill_fashion_show', 'aesthetic_hands_on', 'food_promo'].includes(selectedStyle) && <FileInput id="background" label="Foto Latar (Opsional, 1)" files={uploadedFiles.background} onFilesChange={handleFilesChange} onFileRemove={handleFileRemove} />}

                                    {stylesRequiringDescription.includes(selectedStyle) && <div className="space-y-2"><label htmlFor="text-description" className="block text-sm font-medium text-gray-700">{selectedStyle === 'food_promo' ? "Deskripsi Makanan/Lokasi (Wajib)" : "Deskripsi Teks (Wajib)"}</label><textarea id="text-description" rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder={selectedStyle === 'food_promo' ? "Contoh: Burger Keju Lumer di Kafe Senja..." : "Contoh: Sepatu lari terbaru..."}></textarea></div>}
                                    {stylesRequiringTravelDesc.includes(selectedStyle) && <div className="space-y-2"><label htmlFor="text-description-travel" className="block text-sm font-medium text-gray-700">Deskripsi Teks (Wajib)</label><textarea id="text-description-travel" rows={4} value={travelDescription} onChange={e => setTravelDescription(e.target.value)} className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm" placeholder="Contoh: Villa mewah 3 kamar..."></textarea></div>}

                                    <hr className="border-gray-100 my-4"/>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="orientation-select" className="block text-sm font-medium text-gray-700 mb-1.5">Orientasi Gambar</label>
                                            <div className="relative">
                                                <select id="orientation-select" value={orientation} onChange={e => setOrientation(e.target.value)} className="appearance-none w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm cursor-pointer hover:border-indigo-300">
                                                    {ORIENTATIONS.map(orient => <option key={orient.id} value={orient.id}>{orient.name}</option>)}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                        </div>
                                         <div>
                                            <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-1.5">Bahasa Naskah</label>
                                            <div className="relative">
                                                <select id="language-select" value={language} onChange={e => setLanguage(e.target.value)} className="appearance-none w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm cursor-pointer hover:border-indigo-300">
                                                    {LANGUAGES.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                        </div>
                                         {showScriptSection && <div className="sm:col-span-2">
                                            <label htmlFor="script-style-select" className="block text-sm font-medium text-gray-700 mb-1.5">Gaya Naskah</label>
                                            <div className="relative">
                                                <select id="script-style-select" value={scriptStyle} onChange={e => setScriptStyle(e.target.value as ScriptStyle)} className="appearance-none w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm cursor-pointer hover:border-indigo-300">
                                                    {SCRIPT_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                        </div>}
                                    </div>
                                    
                                    <button onClick={startGenerationProcess} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-lg transition-all transform hover:scale-[1.01] shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                                        {isLoading && generatedContent === null ? <div className='flex items-center justify-center gap-3'><span className='animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full'></span><span>Memproses...</span></div> : <span>Generate Konten</span>}
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>
                    
                    <div className="lg:col-span-2 space-y-8 mt-8 lg:mt-0">
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                                <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-bold shadow-md">3</span>
                                Hasil Konten
                            </h2>
                            {!generatedContent ? (
                                <div className="flex items-center justify-center h-[500px] bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-dashed border-gray-300">
                                    <div className="text-center p-8 max-w-md">
                                        <PlaceholderIcon />
                                        <h3 className="mt-4 text-lg font-semibold text-gray-900">Area Preview Kosong</h3>
                                        <p className="mt-2 text-sm text-gray-500">Lengkapi langkah 1 & 2 di sebelah kiri, lalu klik tombol Generate. Hasil kreatif Anda akan muncul di sini.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-toastIn">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button onClick={handleDownload} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl text-lg transition-all transform hover:scale-[1.01] shadow-lg shadow-green-200 flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                            Unduh Aset (.zip)
                                        </button>
                                        <a href="https://www.emailondeck.com" target="_blank" rel="noopener noreferrer" className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl text-lg transition-all shadow-sm hover:shadow text-center flex items-center justify-center">Buka EmailOnDeck</a>
                                    </div>
                                    
                                    <section>
                                        <h3 className="text-base uppercase tracking-wide text-gray-500 font-semibold mb-4">Visual Storyboard</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {generatedContent.generatedImages.map((image, index) => (
                                                <div key={index} className="flex flex-col gap-2 group">
                                                    <div className='bg-white rounded-xl shadow-md overflow-hidden relative border border-gray-100 ring-1 ring-black/5 hover:shadow-xl transition-all duration-300' style={{ aspectRatio: orientation.replace(':', '/') }}>
                                                        {image.success && image.base64 ? (
                                                            <>
                                                                <img src={`data:image/png;base64,${image.base64}`} alt={`Storyboard shot ${index + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                                {generatedContent.animationPrompts[index] && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8"><p className="text-white text-xs font-medium leading-tight line-clamp-3">🎥 {generatedContent.animationPrompts[index]}</p></div>}
                                                            </>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-red-300 bg-red-50 text-center text-red-500 p-2">
                                                                <span className="font-bold text-xs mb-1">Gagal</span>
                                                                <span className="text-[10px] leading-tight px-1">{image.error || "Unknown error"}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {image.success && (
                                                        <button 
                                                            onClick={() => setVideoModalOpen(true)} 
                                                            className="w-full bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 font-medium py-2 px-3 rounded-lg text-sm transition-all shadow-sm"
                                                        >
                                                            Hasilkan Video
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                    
                                    {showScriptSection && generatedContent.tiktokScript && (
                                        <section>
                                            <h3 className="text-base uppercase tracking-wide text-gray-500 font-semibold mb-4">Naskah & Audio</h3>
                                            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                                                {generatedContent.tiktokMetadata && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Metadata</label>
                                                        <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-200 space-y-3">
                                                            <p className="text-sm text-gray-800 font-medium leading-relaxed">{generatedContent.tiktokMetadata.description}</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {generatedContent.tiktokMetadata.keywords.map((kw, i) => (
                                                                    <span key={i} className="bg-white border border-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">#{kw}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <label htmlFor="generated-script" className="block text-sm font-medium text-gray-700 mb-1.5">Naskah (Edit & Terjemahkan)</label>
                                                    <textarea id="generated-script" rows={8} value={script} onChange={e => setScript(e.target.value)} className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm leading-relaxed hover:border-indigo-300"></textarea>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <button onClick={handleTranslate} disabled={isLoading} className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 border border-gray-300 shadow-sm">Terjemahkan Naskah</button>
                                                    <div className="relative">
                                                        <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} className="appearance-none w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm cursor-pointer hover:border-indigo-300">
                                                            {TTS_VOICES.map(voice => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={handleTts} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all disabled:opacity-50 shadow-md hover:shadow-lg shadow-indigo-200">Buat Audio Narasi (TTS)</button>
                                                {audioUrl && <audio controls src={audioUrl} className="w-full mt-2 rounded-lg border border-gray-200 shadow-sm"></audio>}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}