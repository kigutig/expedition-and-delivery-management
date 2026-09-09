import { createClient } from '@supabase/supabase-js';
import { uploadImageToCloudinary, UploadOptions } from './cloudinary';

// ─── Validacao obrigatoria de variaveis de ambiente ───────────────────────────
// NUNCA use fallback com credenciais reais. Se faltarem as vars, falhe explicito.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Security] Variaveis de ambiente obrigatorias nao configuradas: ' +
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidas no arquivo .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const storageBucket = 'delivery-photos';

export async function uploadDeliveryPhoto(
  deliveryId: string,
  file: File,
  _type: string,
  options: UploadOptions = {}
) {
  const folder = `deliveries/${deliveryId}`;
  const result = await uploadImageToCloudinary(file, folder, options);
  const path = `${folder}/${result.public_id}`;
  return { path, publicUrl: result.secure_url };
}
