/**
 * cloudinary.ts
 *
 * Upload para Cloudinary com assinatura segura via Supabase Edge Function.
 * O API Secret NUNCA toca o bundle do frontend.
 */

import { compressImage } from './imageCompressor';
import { supabase } from './supabase';

// ─── Configuracoes PUBLICAS apenas ────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_SIGN_URL =
  import.meta.env.VITE_CLOUDINARY_SIGN_URL || '/functions/v1/sign_cloudinary';

const CLOUDINARY_IMAGE_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const CLOUDINARY_VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

/**
 * Solicita assinatura segura a Supabase Edge Function sign_cloudinary.
 * O API Secret permanece exclusivamente no servidor.
 */
async function getCloudinarySignature(params: {
  folder: string;
  timestamp: number;
}): Promise<{ signature: string; timestamp: number; api_key: string; cloud_name: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}${CLOUDINARY_SIGN_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      apikey: supabaseAnonKey ?? '',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Falha ao obter assinatura Cloudinary: ${err}`);
  }

  return response.json();
}

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  url: string;
  original_filename: string;
  format: string;
};

export interface UploadOptions {
  onProgress?: (percent: number) => void;
}

export async function uploadImageToCloudinary(
  file: File,
  folder = 'expeditions',
  options: UploadOptions = {}
) {
  const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.82 });
  return uploadToCloudinary(compressed, folder, CLOUDINARY_IMAGE_UPLOAD_URL, options);
}

export async function uploadVideoToCloudinary(
  file: File,
  folder = 'expeditions',
  options: UploadOptions = {}
) {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(
      `O video e muito grande (${(file.size / 1024 / 1024).toFixed(0)} MB). O limite e 200 MB.`
    );
  }
  return uploadToCloudinary(file, folder, CLOUDINARY_VIDEO_UPLOAD_URL, options);
}

async function uploadToCloudinary(
  file: File,
  folder: string,
  uploadUrl: string,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Assinatura obtida do servidor - API Secret nunca exposto no frontend
  const { signature, api_key, cloud_name } = await getCloudinarySignature({ folder, timestamp });

  const effectiveCloudName = cloud_name || CLOUDINARY_CLOUD_NAME;
  const effectiveUrl = uploadUrl.replace(
    /\/v1_1\/[^/]+\//,
    `/v1_1/${effectiveCloudName}/`
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key || CLOUDINARY_API_KEY || '');
  formData.append('timestamp', timestamp.toString());
  formData.append('folder', folder);
  formData.append('signature', signature);

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
        } catch {
          reject(new Error('Resposta invalida do Cloudinary.'));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Falha de rede ao enviar arquivo.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado.')));

    xhr.open('POST', effectiveUrl);
    xhr.send(formData);
  });
}
