import { GoogleGenAI, Modality, Part } from "@google/genai";
import { ContentStyle, UploadedFile, UploadedFilesState, CreativePlan } from '../types';
import { STORY_FLOWS } from '../constants';

// --- API Key Utility ---

const getApiKey = (): string => {
    // 1. Coba ambil dari process.env (Untuk Google IDX / Node environment)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // 2. Coba ambil dari Vite env (Untuk Local Development)
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

function buildCreativePlanPayload(style: ContentStyle, lang: string, description: string, scriptStyle: string, orientation: string) {
    let systemInstruction = "";
    let userQuery = `
        Deskripsi User: ${description || "Tidak ada deskripsi"}
        Bahasa Naskah: ${lang}
        Gaya Naskah: ${scriptStyle}
        Tugas: Hasilkan JSON rencana kreatif.
    `;
    let useGoogleSearch = false;
    const shots = (style === 'treadmill_fashion_show') 
        ? `1 shot base prompt` 
        : `${STORY_FLOWS[style].length} shots (${STORY_FLOWS[style].map(s => s.label).join(', ')})`;
    
    const imageQualityPrompt = `4K, ${orientation} aspect ratio, cinematic, hyper-realistic, detailed texture`;

    // Improved Instruction for Visual Consistency (The Visual Anchor)
    const baseSystemInstruction = `
        Anda adalah AI Creative Director. Tugas Anda adalah membuat rencana konten (storyboard) untuk affiliate marketing.
        
        ATURAN UTAMA (VISUAL CONSISTENCY IS KING):
        Masalah utama dalam AI video adalah model yang berubah-ubah. Anda HARUS memperbaikinya dengan teknik "VISUAL ANCHOR".
        
        1.  **ANALISIS:** Pertama, lihat 'Aset Utama' dan 'Foto Model' (jika ada). Ciptakan deskripsi visual yang SANGAT SPESIFIK untuk Karakter (Wajah, Rambut, Umur, Ras) dan Pakaian (Warna, Jenis, Tekstur).
        2.  **PENGULANGAN (WAJIB):** Anda HARUS menyalin-tempel deskripsi visual karakter dan pakaian tersebut ke DALAM SETIAP STRING di array 'shotPrompts'.
        3.  **STRUKTUR PROMPT:** Setiap prompt dalam 'shotPrompts' HARUS mengikuti struktur ini:
            "[Karakter Deskripsi Lengkap] wearing [Pakaian Deskripsi Lengkap] in [Lokasi Deskripsi], [Action/Pose specific to the shot], [Camera Angle], [Lighting]."
        
        CONTOH STRUKTUR YANG BENAR:
        "A 25yo Indonesian woman with long black wavy hair and soft makeup, wearing a beige linen blazer and white t-shirt, sitting in a modern bright living room, holding the serum bottle up to her cheek, close up shot, soft natural lighting."
        (Perhatikan bagaimana deskripsi wanita dan pakaian diulang secara eksplisit).

        ATURAN OUTPUT JSON:
        1.  Hasilkan HANYA satu blok JSON yang valid.
        2.  Struktur: { "masterScene": { "character": "...", "clothing": "...", "location": "...", "property": "...", "style": "..." }, "tiktokScript": "...", "shotPrompts": ["...", "..."], "tiktokMetadata": { "keywords": ["...", "..."], "description": "..." } }
        3.  Metadata 'keywords' (5-7 kata) & 'description' (judul pendek) harus dalam bahasa: ${lang}.
    `;

    switch (style) {
        case 'direct':
        case 'quick_review':
            systemInstruction = `${baseSystemInstruction}
                GAYA: DIRECT SELLING / REVIEW.
                
                INSTRUKSI KHUSUS:
                1. **KONSISTENSI KARAKTER & BAJU:** Jika user mengupload 'Foto Model', deskripsikan dia secara detil (misal: "Indonesian man with short buzz cut, wearing black hoodie"). Jika tidak, buat karakter generik. Deskripsi ini HARUS DIULANG di Shot 1, Shot 2, Shot 3, dst. Jangan pernah hanya menulis "The man" atau "He". Tulis deskripsi fisiknya lagi.
                2. **KONSISTENSI LOKASI:** Tentukan satu lokasi yang logis (misal: kamar tidur, dapur, kantor). Ulangi deskripsi lokasi ini di setiap shot.
                3. **FOKUS PRODUK:** Pastikan produk terlihat jelas.
                
                DETAIL NASKAH (tiktokScript): Buat naskah dalam ${lang} (40-60 kata) dengan gaya soft selling dan nuansa '${scriptStyle}'.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Ingat: Copy-paste deskripsi karakter & pakaian di setiap prompt. Akhiri setiap prompt dengan "${imageQualityPrompt}".`;
            break;
        case 'fashion_broll':
             systemInstruction = `${baseSystemInstruction}
                GAYA: FASHION B-ROLL.
                
                INSTRUKSI KHUSUS:
                1. **BAJU ADALAH RAJA:** 'Aset Utama' adalah pakaian. Deskripsikan pakaian itu dengan detail obsesif (Warna, jenis kain, bentuk kerah, panjang lengan). Deskripsi ini HARUS ADA di setiap shot.
                2. **KARAKTER:** Wajah dan gaya rambut model HARUS 100% konsisten. Tentukan gaya rambut (misal: "Loose curly hair", "High ponytail") dan kuncir itu untuk semua prompt.
                3. **BACKGROUND:** Gunakan deskripsi 'Gambar Latar' jika ada, atau buat studio minimalis. Background harus konsisten.
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan 5 prompt sesuai alur 'Fashion B-Roll'. Prompt hanya mengubah POSE dan ANGLE (misal: Walking towards camera, looking over shoulder, adjusting sleeve). Deskripsi fisik & baju TETAP SAMA. Akhiri dengan "${imageQualityPrompt}, fashion photography lighting".`;
            break;
        case 'treadmill_fashion_show':
             systemInstruction = `${baseSystemInstruction}
                GAYA: TREADMILL FASHION SHOW.
                
                INSTRUKSI KHUSUS:
                1. Konsistensi sangat mudah disini karena hanya 1 base prompt.
                2. Pastikan prompt mendeskripsikan: "Full body shot of [Character Description] walking confidently on a treadmill, facing forward."
                3. Lokasi: Studio atau Gym yang bersih dan estetik.
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan HANYA 1 prompt dasar yang sangat detail. Prompt ini akan digunakan berulang oleh sistem. Akhiri dengan "${imageQualityPrompt}".`;
            break;
        case 'travel':
            systemInstruction = `${baseSystemInstruction}
                GAYA: TRAVEL VLOG.
                
                INSTRUKSI KHUSUS:
                1. **LOKASI:** Prioritaskan akurasi visual lokasi berdasarkan 'Aset Utama' dan hasil Google Search.
                2. **KARAKTER:** Tambahkan "Back view of [Character]" atau "Wide shot of [Character]" untuk memberi skala pada pemandangan. Konsistensi pakaian karakter tetap wajib dijaga (misal: selalu pakai Topi Putih dan Dress Biru).
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata), gaya '${scriptStyle}'. Gunakan fakta lokasi.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Setiap prompt harus menggabungkan keindahan lokasi DAN kehadiran karakter yang konsisten. Akhiri dengan "${imageQualityPrompt}, natural sunlight".`;
            userQuery = `Gaya Konten: ${style}\n(Gunakan Google Search untuk menemukan info visual lokasi ini).\n${userQuery}`;
            useGoogleSearch = true;
            break;
        case 'property':
             systemInstruction = `${baseSystemInstruction}
                GAYA: PROMO PROPERTI.
                
                INSTRUKSI KHUSUS:
                1. **JANGAN UBAH PROPERTI:** Prompt harus fokus pada "A realistic photo of the provided room...".
                2. **MANUSIA:** Tambahkan manusia untuk skala. "A [Detailed Character] sitting on the sofa...". Pastikan karakter ini (baju/rambut) konsisten jika muncul di beberapa shot.
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata), gaya '${scriptStyle}'.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}. Setiap prompt dimulai dengan "Adding [Character] to the scene: ". Akhiri dengan "keep architecture unchanged. ${imageQualityPrompt}".`;
            userQuery = `Gaya Konten: ${style}\n(Gunakan Google Search untuk info properti).\n${userQuery}`;
            useGoogleSearch = true;
            break;
        case 'aesthetic_hands_on':
             systemInstruction = `${baseSystemInstruction}
                GAYA: AESTHETIC HANDS ON (POV).
                
                INSTRUKSI KHUSUS:
                1. **SHOT 1 ADALAH KUNCI (POV HOLDING):** Shot pertama WAJIB First Person Point of View (POV) melihat tangan sendiri memegang produk ke arah kamera (holding up the product).
                2. **SHOT 2-5 (VARIASI):** Shot selanjutnya TIDAK HARUS pose "holding up". Fokus pada interaksi tekstur, pemakaian (using), dan peletakan (placing) yang natural.
                3. **ESTETIKA TANGAN:** Deskripsikan tangan yang estetik (contoh: "Woman's hand with nude almond-shaped nails and rings").
                
                **STRUKTUR PROMPT:**
                   - Shot 1: "POV shot looking down at own hand holding the [Product] up to the camera against [Background]. Focus on the elegant grip and product details."
                   - Shot 2: "Close-up shot of hand touching/interacting with the texture of [Product]..."
                   - Shot 3: "Shot of hand using the [Product] functionality in a natural way..."
                   - Shot 4: "Shot showing the [Product] placed aesthetically next to related lifestyle items (pairing)..."
                   - Shot 5: "Wide angle shot of the [Product] in a lifestyle setting / experience..."
                
                DETAIL NASKAH (tiktokScript): String KOSONG ("").
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan 5 prompt. Prompt 1 WAJIB POV Holding. Prompt lain variasi estetik. Akhiri dengan "${imageQualityPrompt}, macro photography, soft ethereal lighting".`;
            break;
        case 'food_promo':
             systemInstruction = `${baseSystemInstruction}
                GAYA: FOOD VLOGGER (CINEMATIC COMMERCIAL).
                
                INSTRUKSI KHUSUS:
                1. **KARAKTER (VISUAL ANCHOR):** Tentukan deskripsi fisik Food Vlogger (Wajah, Rambut, Baju).
                
                2. **EVOLUSI MAKANAN (REALISME & PROGRESSION):**
                   - Shot 1: Makanan UTUH & PERFECT. Vlogger memegangnya.
                   - Shot 2: **SCENE IKLAN (COMMERCIAL):** HANYA MAKANAN (No Humans). Close-up super detail, seperti iklan TV. Lighting dramatis. Gunakan background jika ada.
                   - Shot 3: BIG BITE. Vlogger menggigit besar.
                   - Shot 4: BITE MARK. Makanan sudah tergigit. Tekstur dalam terlihat.
                   - Shot 5: HALF EATEN. Makanan tinggal setengah.
                
                DETAIL NASKAH (tiktokScript): Naskah ${lang} (40-60 kata), gaya '${scriptStyle}', menggugah selera.
                DETAIL PROMPT GAMBAR (shotPrompts): Hasilkan ${shots}.
                - Shot 1: "Medium shot of [Character Description] holding the WHOLE PERFECT [Food] up to the camera, in [Location]..."
                - Shot 2: "Cinematic Commercial Food Photography of the [Food] on a table. Extreme close-up, steam rising, water droplets, fresh ingredients visible. NO PEOPLE. Dramatic studio lighting. 8k resolution, advertising standard."
                - Shot 3: "Close up shot of [Character Description] taking a HUGE enthusiastic bite of the [Food], eyes closed in enjoyment..."
                - Shot 4: "Medium shot of [Character Description] holding the [Food] which now has a VISIBLE LARGE BITE MARK, showing the delicious filling/texture inside..."
                - Shot 5: "[Character Description] holding the HALF-EATEN [Food], giving a thumbs up..."
                Akhiri setiap prompt dengan "${imageQualityPrompt}, delicious, food porn".`;
            break;
    }
    return { systemInstruction, userQuery, useGoogleSearch };
}

export async function getCreativePlan(style: ContentStyle, files: UploadedFilesState, description: string, language: string, scriptStyle: string, orientation: string): Promise<CreativePlan> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key tidak ditemukan. Pastikan Anda telah memilih API Key atau mengatur VITE_API_KEY di .env untuk lokal.");
    
    const ai = new GoogleGenAI({ apiKey });
    const langTextMap: { [key: string]: string } = {
        'id-ID': 'Bahasa Indonesia',
        'ms-MY': 'Bahasa Melayu',
        'en-US': 'English'
    };
    const langText = langTextMap[language] || 'Bahasa Indonesia';
    const { systemInstruction, userQuery, useGoogleSearch } = buildCreativePlanPayload(style, langText, description, scriptStyle, orientation);
    
    const imageParts: Part[] = [];

    // Main Asset (Product for most, Locations for travel/property/food)
    if (files.product) imageParts.push({ text: "Aset Utama (Produk):" }, { inlineData: { mimeType: files.product.type, data: files.product.data }});
    files.locations.forEach((f, i) => imageParts.push({ text: `Aset Utama (Lokasi/Properti/Makanan) ${i+1}:` }, { inlineData: { mimeType: f.type, data: f.data }}));
    
    // Fashion items are also main assets for treadmill style
    files.fashionItems.forEach((f, i) => imageParts.push({ text: `Aset Utama (Item Fashion) ${i+1}:` }, { inlineData: { mimeType: f.type, data: f.data }}));

    // Common secondary assets
    if (files.model) imageParts.push({ text: "Foto Model (Referensi Wajib untuk Wajah/Rambut/Baju):" }, { inlineData: { mimeType: files.model.type, data: files.model.data }});
    if (files.background) imageParts.push({ text: "Gambar Latar:" }, { inlineData: { mimeType: files.background.type, data: files.background.data }});
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: userQuery }, ...imageParts] },
        config: {
            systemInstruction,
            ...(useGoogleSearch ? { tools: [{ googleSearch: {} }] } : { responseMimeType: 'application/json' })
        }
    });

    const textResponse = response.text.replace(/```json|```/g, "").trim();
    try {
        return JSON.parse(textResponse) as CreativePlan;
    } catch (e) {
        console.error("Failed to parse Creative Plan JSON", textResponse);
        throw new Error("Gagal membuat rencana kreatif. Silakan coba lagi.");
    }
}

export async function generateSingleImage(prompt: string, referenceParts: Part[]): Promise<{ success: boolean; base64: string | null }> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    const ai = new GoogleGenAI({ apiKey });
    try {
        // Add specific instruction to the image model to respect the reference images strongly
        const strongPrompt = `${prompt} (Ensure high fidelity to the key features of the provided reference images. High quality, photorealistic, cinematic)`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: strongPrompt }, ...referenceParts] },
            config: { responseModalities: [Modality.IMAGE] },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return { success: true, base64: part.inlineData.data };
            }
        }
        return { success: false, base64: null };
    } catch (error) {
        console.error("Error generating single image:", error);
        return { success: false, base64: null };
    }
}

export async function getAnimationPrompt(imagePrompt: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Berdasarkan prompt gambar ini: "${imagePrompt}", berikan 1 (SATU) saran animasi video yang deskriptif dan sinematik (sekitar 6-10 kata). Kombinasikan SATU gerakan kamera (cth: Slow Dolly In, Fast Pan Left) DAN SATU gerakan objek/karakter (cth: Model tersenyum, Produk berputar). Contoh: "Slow dolly in pada karakter yang tersenyum."`,
        });
        return response.text.trim();
    } catch (error) {
        console.warn("Failed to get animation prompt:", error);
        return null;
    }
}

export async function translateScript(script: string, targetLangCode: string, scriptStyle: string): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    const ai = new GoogleGenAI({ apiKey });
    const langTextMap: { [key: string]: string } = {
        'id-ID': 'Bahasa Indonesia',
        'ms-MY': 'Bahasa Melayu',
        'en-US': 'English'
    };
    const targetLang = langTextMap[targetLangCode] || 'Bahasa Indonesia';
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Terjemahkan naskah berikut ke ${targetLang} (kode: ${targetLangCode}). Jaga agar tetap singkat (sekitar 40-60 kata) dengan gaya soft selling untuk TikTok dan pertahankan nuansa gaya '${scriptStyle}'. Naskah: "${script}"`,
    });
    return response.text.trim();
}

export async function generateTTSAudio(script: string, langCode: string, voiceName: string): Promise<Blob> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    const ai = new GoogleGenAI({ apiKey });
    const ttsPrompt = `Ucapkan dalam bahasa ${langCode}: "${script}"`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: ttsPrompt }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
        },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType; // e.g., audio/L16;rate=24000

    if (audioData && mimeType && mimeType.startsWith("audio/")) {
        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        if (!sampleRateMatch) throw new Error("Could not find sample rate in mimeType.");
        
        const sampleRate = parseInt(sampleRateMatch[1], 10);
        const pcmData = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmData);
        return pcmToWav(pcm16, 1, sampleRate);
    } else {
        throw new Error("Invalid audio response from API.");
    }
}