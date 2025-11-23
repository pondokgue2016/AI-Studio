export type ContentStyle = 'direct' | 'quick_review' | 'fashion_broll' | 'travel' | 'property' | 'treadmill_fashion_show' | 'aesthetic_hands_on' | 'food_promo';
export type ScriptStyle = 'direct' | 'poetic' | 'absurd' | 'informative' | 'humorous' | 'mysterious';

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data without prefix
  previewUrl: string; // full data URL for <img> src
}

export interface UploadedFilesState {
  product: UploadedFile | null;
  model: UploadedFile | null;
  background: UploadedFile | null;
  fashionItems: UploadedFile[];
  locations: UploadedFile[];
}

export interface GeneratedImage {
  success: boolean;
  base64: string | null;
  prompt: string;
  error?: string;
}

export interface GeneratedContentState {
  tiktokScript: string;
  shotPrompts: string[];
  generatedImages: GeneratedImage[];
  animationPrompts: (string | null)[];
  audioBlob: Blob | null;
  tiktokMetadata: {
      keywords: string[];
      description: string;
  } | null;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface CreativePlan {
    masterScene: {
        character: string;
        clothing?: string;
        location: string;
        property?: string;
        style: string;
    };
    tiktokScript: string;
    shotPrompts: string[];
    tiktokMetadata: {
        keywords: string[];
        description: string;
    };
}