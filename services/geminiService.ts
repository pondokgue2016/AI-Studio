
import { GoogleGenAI, Modality, Part } from "@google/genai";
import { ContentStyle, UploadedFile, UploadedFilesState, CreativePlan, UserProfile, GeneratedImage } from '../types';
import { STORY_FLOWS } from '../constants';

// --- API Key Utility ---

let localApiKey = '';

export const setLocalApiKey = (key: string) => {
    localApiKey = key;
}

const getApiKey = (): string => {
    // 1. Prioritaskan Input Manual dari UI
    if (localApiKey) return localApiKey;

    // 2. Coba ambil dari process.env (Untuk Google IDX / Node environment)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // 3. Coba ambil dari Vite env (Untuk Local Development)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        return import.meta.env.VITE_API_KEY;
    }
    return '';
};

// --- File & Audio Utilities ---

/**
 * Reads a File object and returns its Base64 encoded string representation.
 */
export function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Converts a Base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Converts raw PCM audio data (Int16Array) to a WAV file Blob.
 */
function pcmToWav(pcmData: Int16Array, numChannels: number, sampleRate: number): Blob {
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * bytesPerSample;
    const fileSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset += 2) {
        view.setInt16(offset, pcmData[i], true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
}


// --- Gemini API Service ---

function buildCreativePlanPayload(style: ContentStyle, lang: string, description: string, scriptStyle: string, orientation: string, userProfile?: UserProfile) {
    // Construct Brand Persona Prompt Segment
    const brandPersonaPrompt = userProfile?.brandName ? `
        === BRAND PERSONA (WAJIB DIIKUTI) ===
        Brand Name: ${userProfile.brandName}
        Tone of Voice: ${userProfile.toneOfVoice || 'Professional & Trustworthy'}
        Target Audience: ${userProfile.targetAudience || 'General Audience'}
        
        INSTRUKSI NASKAH:
        Gunakan "Tone of Voice" di atas saat menulis 'tiktokScript'. Sesuaikan gaya bahasa agar relevan dengan 'Target Audience'.
        Sebutkan nama brand "${userProfile.brandName}" secara natural.
    ` : `
        === BRAND PERSONA ===
        Gunakan tone of voice yang sesuai dengan gaya naskah '${scriptStyle}'.
    `;

    let userQuery = `
        Deskripsi User: ${description || "Tidak ada deskripsi"}
        Bahasa Naskah: ${lang}
        Gaya Naskah: ${scriptStyle}
        Tugas: Hasilkan JSON rencana kreatif.
    `;
    let useGoogleSearch = false;
    
    const isPosterMode = style.startsWith('poster_');
    const shots = (style === 'treadmill_fashion_show') 
        ? `1 shot base prompt` 
        : `${STORY_FLOWS[style].length} shots (${STORY_FLOWS[style].map(s => s.label).join(', ')})`;
    
    const imageQualityPrompt = `4K, ${orientation} aspect ratio, cinematic, hyper-realistic, detailed texture`;

    // Improved Instruction for Visual Consistency (The Visual Anchor)
    const baseSystemInstruction = `
        Anda adalah AI Creative Director. Tugas Anda adalah membuat rencana konten (storyboard atau poster set) untuk affiliate marketing.
        
        ${brandPersonaPrompt}

        ATURAN OUTPUT JSON:
        1.  Hasilkan HANYA satu blok JSON yang valid.
        2.  Struktur: { "masterScene": { "character": "...", "clothing": "...", "location": "...", "property": "...", "style": "..." }, "tiktokScript": "...", "shotPrompts": ["...", "..."], "tiktokMetadata": { "keywords": ["...", "..."], "description": "..." } }
        3.  Metadata 'keywords' (5-7 kata) & 'description' (judul pendek) harus dalam bahasa: ${lang}.
    `;

    // --- POSTER LOGIC ---
    if (isPosterMode) {
        let posterVibe = "";
        switch (style) {
            case 'poster_food':
                posterVibe = "Appetite Appeal, Fresh, Steam/Water Droplets, Warm Lighting, Delicious.";
                break;
            case 'poster_beauty':
                posterVibe = "Elegant, Soft Lighting, Pastel Colors, Organic Textures (Water/Flowers), Pure.";
                break;
            case 'poster_tech':
                posterVibe = "Futuristic, Neon Rim Light, Dark Background, Floating Product, Sleek.";
                break;
            case 'poster_property':
                posterVibe = "Spacious, Natural Sunlight, Clean Lines, Cozy, Architectural Symmetry.";
                break;
        }

        const systemInstruction = `${baseSystemInstruction}
            GAYA: PHOTO STUDIO / POSTER MAKER (${posterVibe}).
            
            INSTRUKSI UTAMA (CLEAN BACKGROUND & TAGLINE):
            1. **BACKGROUND BERSIH:** User ingin membuat poster. Prompt gambar HARUS meminta "Minimalist Background" dan "Negative Space" (ruang kosong) di bagian atas atau samping agar user bisa menambahkan teks/logo dengan mudah. Hindari background yang terlalu ramai (cluttered).
            2. **TAGLINE GENERATOR:** Di field 'tiktokScript', JANGAN buat naskah video panjang. GANTI dengan format ini:
               "HEADLINE: [Buat Tagline Pendek & Catchy 3-5 Kata]
                CAPTION: [Buat Caption Instagram yang menarik]"
            
            INSTRUKSI SHOT PROMPTS (4 VARIASI):
            1. **Hero Shot:** Produk di tengah, lighting dramatis, background bersih.
            2. **Lifestyle:** Produk di lingkungan natural (misal: di meja makan, di wastafel, di tangan).
            3. **Creative:** Komposisi artistik (Floating, Flatlay, Geometris).
            4. **Detail:** Close-up texture shot (Macro).
            
            Akhiri setiap prompt dengan: "${imageQualityPrompt}, ${posterVibe}, clean composition, negative space for text".
        `;
        return { systemInstruction, userQuery, useGoogleSearch };
    }

    // --- VIDEO LOGIC (EXISTING) ---
    let systemInstruction = "";
    switch (style) {
        case 'direct':
        case 'quick_review':
            systemInstruction = `${baseSystemInstruction}
                GAYA: DIRECT SELLING / REVIEW.
                
                INSTRUKSI KHUSUS:
                1. **KONSISTENSI KARAKTER & BAJU:** Jika user mengupload 'Foto Model', deskripsikan dia secara detil. Ulangi deskripsi ini di setiap Shot.
                2. **KONSISTENSI LOKASI:** Tentukan satu lokasi yang logis.
                
                DETAIL NASKAH (tiktokScript): Buat naskah dalam ${lang} (40-60 kata) dengan gaya soft selling.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Akhiri dengan "${imageQualityPrompt}".`;
            break;
        case 'fashion_broll':
             systemInstruction = `${baseSystemInstruction}
                GAYA: FASHION B-ROLL.
                INSTRUKSI KHUSUS:
                1. **BAJU ADALAH RAJA:** Deskripsikan pakaian dengan detail obsesif.
                2. **KARAKTER:** Wajah dan gaya rambut model HARUS 100% konsisten.
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan 5 prompt variasi POSE dan ANGLE. Akhiri dengan "${imageQualityPrompt}, fashion photography lighting".`;
            break;
        case 'treadmill_fashion_show':
             systemInstruction = `${baseSystemInstruction}
                GAYA: TREADMILL FASHION SHOW.
                INSTRUKSI KHUSUS:
                1. Prompt mendeskripsikan: "Full body shot of [Character Description] walking confidently on a treadmill, facing forward."
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan HANYA 1 prompt dasar yang sangat detail. Akhiri dengan "${imageQualityPrompt}".`;
            break;
        case 'travel':
            systemInstruction = `${baseSystemInstruction}
                GAYA: TRAVEL VLOG.
                INSTRUKSI KHUSUS:
                1. **LOKASI:** Prioritaskan akurasi visual lokasi.
                2. **KARAKTER:** Tambahkan karakter untuk skala.
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata). Gunakan fakta lokasi.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Akhiri dengan "${imageQualityPrompt}, natural sunlight".`;
            userQuery = `Gaya Konten: ${style}\n(Gunakan Google Search untuk menemukan info visual lokasi ini).\n${userQuery}`;
            useGoogleSearch = true;
            break;
        case 'property':
             systemInstruction = `${baseSystemInstruction}
                GAYA: PROMO PROPERTI.
                INSTRUKSI KHUSUS:
                1. **JANGAN UBAH PROPERTI:** Prompt harus fokus pada "A realistic photo of the provided room...".
                2. **MANUSIA:** Tambahkan manusia untuk skala.
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata).
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Akhiri dengan "keep architecture unchanged. ${imageQualityPrompt}".`;
            userQuery = `Gaya Konten: ${style}\n(Gunakan Google Search untuk info properti).\n${userQuery}`;
            useGoogleSearch = true;
            break;
        case 'aesthetic_hands_on':
             systemInstruction = `${baseSystemInstruction}
                GAYA: AESTHETIC HANDS ON (POV).
                INSTRUKSI KHUSUS:
                1. **SHOT 1 ADALAH KUNCI (POV HOLDING):** Shot pertama WAJIB First Person Point of View (POV) tangan memegang produk dengan estetik.
                2. **VARIASI SHOT:** Shot berikutnya fokus pada tekstur, penggunaan, dan pairing.
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan 5 prompt. Akhiri dengan "${imageQualityPrompt}, pov photography".`;
            break;
        case 'food_promo':
             systemInstruction = `${baseSystemInstruction}
                GAYA: FOOD VLOGGER / REVIEW MAKANAN.
                INSTRUKSI KHUSUS:
                1. **APPETITE APPEAL:** Makanan harus terlihat sangat lezat, berminyak (jika relevan), uap panas, dll.
                2. **REAKSI:** Sertakan shot orang makan dengan ekspresi nikmat.
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata) gaya influencer lapar.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Akhiri dengan "${imageQualityPrompt}, food photography, macro depth of field".`;
            break;
    }

    return { systemInstruction, userQuery, useGoogleSearch };
}

export async function getCreativePlan(
    style: ContentStyle, 
    files: UploadedFilesState, 
    description: string, 
    lang: string, 
    scriptStyle: string,
    orientation: string,
    userProfile?: UserProfile
): Promise<CreativePlan> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // 1. Build Payload
    const { systemInstruction, userQuery, useGoogleSearch } = buildCreativePlanPayload(style, lang, description, scriptStyle, orientation, userProfile);

    // 2. Prepare visual context from uploaded files (Vision capabilities)
    // We send the first available image to help Gemini understand what the product looks like
    const contextParts: Part[] = [];
    contextParts.push({ text: userQuery });
    
    if (files.product) {
        contextParts.push({ text: "Ini adalah gambar produk utama:" });
        contextParts.push({ inlineData: { mimeType: files.product.type, data: files.product.data } });
    } else if (files.locations && files.locations.length > 0) {
        contextParts.push({ text: "Ini adalah gambar lokasi/properti/makanan:" });
        contextParts.push({ inlineData: { mimeType: files.locations[0].type, data: files.locations[0].data } });
    } else if (files.fashionItems && files.fashionItems.length > 0) {
        contextParts.push({ text: "Ini adalah item fashion utama:" });
        contextParts.push({ inlineData: { mimeType: files.fashionItems[0].type, data: files.fashionItems[0].data } });
    }

    // 3. Configure Model
    const modelId = useGoogleSearch ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
    const tools = useGoogleSearch ? [{ googleSearch: {} }] : [];

    const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: contextParts },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            tools: tools
        }
    });

    try {
        const text = response.text || "{}";
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const plan = JSON.parse(jsonStr) as CreativePlan;
        return plan;
    } catch (e) {
        console.error("Failed to parse Creative Plan JSON", e);
        throw new Error("Gagal membuat rencana kreatif. Silakan coba lagi.");
    }
}

export async function generateSingleImage(prompt: string, referenceParts: Part[], orientation: string): Promise<GeneratedImage> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const parts: Part[] = [...referenceParts];
    parts.push({ text: `Generate a photorealistic image based on this prompt: ${prompt}` });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Nano Banana for image gen
            contents: { parts: parts },
        });

        // Extract image
        // The guidelines say: iterate through parts.
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return {
                        success: true,
                        base64: part.inlineData.data,
                        prompt: prompt
                    };
                }
            }
        }
        return { success: false, base64: null, prompt, error: "No image data in response" };

    } catch (e: any) {
        console.error("Image Gen Error", e);
        return { success: false, base64: null, prompt, error: e.message || "Unknown error" };
    }
}

export async function getAnimationPrompt(imagePrompt: string): Promise<string> {
    // Generate a prompt for video generators (Runway/Kling) based on the image prompt
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a concise motion prompt for an AI video generator based on this image description: "${imagePrompt}". 
        Focus on camera movement (pan, zoom) and subject motion. Max 15 words. Example: "Slow pan right, subtle dust particles floating, cinematic lighting."`,
    });
    return response.text?.trim() || "Cinematic slow motion";
}

export async function generateTTSAudio(text: string, lang: string, voiceName: string): Promise<Blob> {
     const ai = new GoogleGenAI({ apiKey: getApiKey() });
     
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName }
                }
            }
        }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Gagal generate audio");
    
    // Convert to WAV/Blob
    const audioBuffer = base64ToArrayBuffer(base64Audio);
    // The raw output is PCM. We need to wrap it in WAV container.
    const pcmData = new Int16Array(audioBuffer);
    return pcmToWav(pcmData, 1, 24000);
}

export async function translateScript(script: string, targetLang: string, style: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate and adapt the following script to ${targetLang} with a ${style} style. Keep it concise for TikTok:\n\n"${script}"`
    });
    return response.text?.trim() || script;
}

// --- Prompt Lab Functions ---

export async function generateMagicPrompt(input: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a Prompt Engineer. Expand this short idea into a detailed, high-quality image generation prompt (Midjourney/Flux style). 
        Include: Subject details, Lighting, Camera Angle, Art Style, and Render quality (4k, 8k).
        
        Input: "${input}"
        
        Output (Prompt Only):`
    });
    return response.text?.trim() || "";
}

export async function generateVideoPrompt(input: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a Video Director. Convert this idea into a prompt for AI Video Generators (Sora, Veo, Kling).
        Focus on: Physics, Camera Movement (Pan/Zoom/Truck), Lighting consistency, and Action.
        
        Input: "${input}"
        
        Output (Prompt Only):`
    });
    return response.text?.trim() || "";
}

export async function analyzeImageToPrompt(file: UploadedFile): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { text: "Analyze this image and write a detailed prompt to recreate it using AI. Describe the subject, composition, lighting, style, and camera settings." },
                { inlineData: { mimeType: file.type, data: file.data } }
            ]
        }
    });
    return response.text?.trim() || "";
}
