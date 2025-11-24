
import { ContentStyle, ScriptStyle } from './types';

export const APP_VERSION = 'v2.1';

export const CONTENT_STYLES: { id: ContentStyle; name: string; description: string }[] = [
    { id: 'direct', name: 'Presentasi Produk', description: 'Fokus pada solusi & manfaat produk.' },
    { id: 'quick_review', name: 'Review Cepat', description: 'Testimoni singkat & padat.' },
    { id: 'treadmill_fashion_show', name: 'Treadmill Fashion', description: 'Model berjalan estetik.' },
    { id: 'fashion_broll', name: 'Fashion B-Roll', description: 'Pose variatif untuk outfit.' },
    { id: 'travel', name: 'Promo Travel', description: 'Eksplorasi lokasi & suasana.' },
    { id: 'property', name: 'Promo Properti', description: 'Tur ruangan & arsitektur.' },
    { id: 'aesthetic_hands_on', name: 'Aesthetic POV', description: 'Sudut pandang tangan (POV).' },
    { id: 'food_promo', name: 'Food Vlogger', description: 'Review makanan menggugah selera.' },
];

export const SCRIPT_STYLES: { id: ScriptStyle; name: string }[] = [
    { id: 'direct', name: 'Direct / Jelas' },
    { id: 'poetic', name: 'Puitis' },
    { id: 'humorous', name: 'Humoris / Lucu' },
    { id: 'informative', name: 'Informatif' },
    { id: 'mysterious', name: 'Misterius' },
    { id: 'absurd', name: 'Absurd' },
];

export const LANGUAGES: { id: string; name: string }[] = [
    { id: 'id-ID', name: 'Bahasa Indonesia' },
    { id: 'ms-MY', name: 'Bahasa Melayu' },
    { id: 'en-US', name: 'English' },
];

export const STORY_FLOWS: Record<ContentStyle, { id: string; label: string }[]> = {
    direct: [
        { id: "problem", label: "Masalah (Problem)" },
        { id: "reveal", label: "Produk (Reveal)" },
        { id: "action", label: "Cara Pakai (Action)" },
        { id: "result", label: "Hasil (Result)" },
        { id: "presenter", label: "Presenter/Model (CTA)" }
    ],
    quick_review: [
        { id: "hook", label: "Hook (Opening)" },
        { id: "closeup", label: "Close-up (Detail)" },
        { id: "solution1", label: "Fitur / Solusi 1" },
        { id: "solution2", label: "Fitur / Solusi 2" },
        { id: "result", label: "Hasil / CTA" }
    ],
    fashion_broll: [
        { id: "fisheye", label: "Fisheye High Angle" },
        { id: "coolpose", label: "Normal Angle - Cool Pose" },
        { id: "seated", label: "Seated Studio Pose" },
        { id: "halfbody", label: "Half Body Close-Up" },
        { id: "fabric", label: "Interacting with Fabric" }
    ],
    travel: [
        { id: "hook", label: "Pemandangan Ikonik" },
        { id: "detail", label: "Suasana & Detail" },
        { id: "activity", label: "Aktivitas Seru" },
        { id: "moment", label: "Momen Ajaib" },
        { id: "cta", label: "Ajakan (Invitation)" }
    ],
    property: [
        { id: "exterior", label: "Eksterior & Sambutan" },
        { id: "main_interior", label: "Interior Utama" },
        { id: "facility", label: "Fasilitas Unggulan" },
        { id: "detail", label: "Detail & Suasana" },
        { id: "lifestyle_cta", label: "Gaya Hidup & Ajakan" }
    ],
    treadmill_fashion_show: [
        { id: "treadmill", label: "Treadmill Base Prompt" }
    ],
    aesthetic_hands_on: [
        { id: 'grasp', label: '1. The Grasp (Emosi)' },
        { id: 'unveiling', label: '2. The Unveiling (Detail)' },
        { id: 'function', label: '3. The Function (Aksi)' },
        { id: 'pairing', label: '4. The Pairing (Gaya)' },
        { id: 'experience', label: '5. The Experience (Skala)' }
    ],
    food_promo: [
        { id: 'hook', label: 'Influencer Intro' },
        { id: 'reveal', label: 'Food Reveal (Beauty Shot)' },
        { id: 'action', label: 'Gigitan Pertama (Action)' },
        { id: 'reaction', label: 'Reaksi Emosional' },
        { id: 'cta', label: 'Ajakan & Produk (CTA)' }
    ]
};

export const TTS_VOICES: { value: string; label: string }[] = [
    { value: "Kore", label: "Suara Pria (Tegas)" },
    { value: "Puck", label: "Suara Pria (Ceria)" },
    { value: "Gacrux", label: "Suara Pria (Dewasa)" },
    { value: "Zephyr", label: "Suara Wanita (Cerah)" },
    { value: "Leda", label: "Suara Wanita (Muda)" },
    { value: "Aoede", label: "Suara Wanita (Ringan)" },
    { value: "Sulafat", label: "Suara Wanita (Hangat)" },
];

export const ORIENTATIONS: { id: string; name: string }[] = [
    { id: '9:16', name: 'Portrait (9:16)' },
    { id: '16:9', name: 'Landscape (16:9)' },
    { id: '1:1', name: 'Square (1:1)' },
];

export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_MULTIPLE_FILES = 6;
