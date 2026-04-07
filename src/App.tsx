import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { FileText, Settings, Key, CheckCircle, AlertCircle, Loader2, Camera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

const SPREADSHEET_ID = '13AWOe_pbm8P-N0ua2hWI_siFEw90I3jFtE3Zd-7UIgI';
const EXTRACTION_PROMPT = `Extrae la siguiente información del documento:
1. DATOS DEL PROVEEDOR:
   - Proveedor: la persona o empresa que ofrece la cotización o precios.
   - Contacto: el nombre del trabajador que nos dio la cotización o precios.
   - Teléfono / Email: el teléfono y el email del contacto o proveedor, separados por un guion.
2. DETALLE DE PRODUCTOS:
   - CANTIDAD
   - DESCRIPCIÓN
   - PRECIO UNIT.
   - PRECIO TOTAL
3. TOTALES:
   - SUBTOTAL $
   - IVA (19)% $
   - TOTAL $

REGLA CRÍTICA: Extrae CADA producto como una fila separada en el array de productos. COPIA LOS VALORES EXACTAMENTE COMO APARECEN.`;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showSetup, setShowSetup] = useState(false);
  const [configStatus, setConfigStatus] = useState<{ configured: boolean; missing: string[]; clientEmail?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/config-check');
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          setConfigStatus(data);
        } else {
          console.error('El servidor no devolvió JSON. Asegúrate de que el backend (server.ts) esté en ejecución.');
        }
      } catch (err) {
        console.error('Failed to check config:', err);
      }
    };
    checkConfig();
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processFileAutomatically = async (selectedFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setProcessingStep('Analizando documento con IA...');
    
    try {
      const base64Data = await fileToBase64(selectedFile);
      
      let promptText = `Extrae la información solicitada de este documento. 
            Información solicitada: ${EXTRACTION_PROMPT}
            
            Devuelve un objeto JSON con las siguientes claves:
            1. "proveedor": string
            2. "contacto": string
            3. "telefonoEmail": string
            4. "productos": un array de objetos, cada uno con: "cantidad", "descripcion", "precioUnit", "precioTotal"
            5. "subtotal": string
            6. "iva": string
            7. "total": string
            
            REGLAS DE FORMATO:
            1. COPIA LOS VALORES EXACTAMENTE COMO ESTÁN EN EL DOCUMENTO.
            2. Si no encuentras un valor, devuelve un string vacío "".`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: selectedFile.type
            }
          },
          {
            text: promptText
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proveedor: { type: Type.STRING },
              contacto: { type: Type.STRING },
              telefonoEmail: { type: Type.STRING },
              productos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cantidad: { type: Type.STRING },
                    descripcion: { type: Type.STRING },
                    precioUnit: { type: Type.STRING },
                    precioTotal: { type: Type.STRING }
                  },
                  required: ['cantidad', 'descripcion', 'precioUnit', 'precioTotal']
                }
              },
              subtotal: { type: Type.STRING },
              iva: { type: Type.STRING },
              total: { type: Type.STRING }
            },
            required: ['proveedor', 'contacto', 'telefonoEmail', 'productos', 'subtotal', 'iva', 'total']
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No se pudo extraer la información del documento.");
      }

      const parsed = JSON.parse(resultText);
      
      // Get current date formatted as DD/MM/YYYY
      const today = new Date();
      const fecha = today.toLocaleDateString('es-CL');

      setProcessingStep('Guardando datos en Google Sheets...');

      const saveResponse = await fetch('/api/update-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: SPREADSHEET_ID,
          proveedor: parsed.proveedor || "",
          contacto: parsed.contacto || "",
          telefonoEmail: parsed.telefonoEmail || "",
          fecha: fecha,
          productos: parsed.productos || [],
          subtotal: parsed.subtotal || "",
          iva: parsed.iva || "",
          total: parsed.total || ""
        }),
      });
      
      const contentType = saveResponse.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await saveResponse.text();
        throw new Error("El servidor no respondió correctamente. ¿Subiste el proyecto a un hosting estático? Este proyecto requiere un servidor Node.js para funcionar.");
      }

      const saveData = await saveResponse.json();
      
      if (!saveResponse.ok) {
        let errorMessage = saveData.error || 'Error al guardar en Google Sheets';
        if (errorMessage.toLowerCase().includes('permission')) {
          errorMessage = "Permiso denegado: Asegúrate de haber compartido tu Google Sheet con el correo de la cuenta de servicio como 'Editor'.";
        }
        throw new Error(errorMessage);
      }
      
      setSuccess('¡Proceso completado! Los datos se han extraído y guardado en Google Sheets automáticamente.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error durante el procesamiento.");
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(null);
      
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      }
      
      processFileAutomatically(selectedFile);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-emerald-200">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Escáner Automático</h1>
          </div>
          <div className="flex items-center gap-4">
            {configStatus && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                configStatus.configured 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${configStatus.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {configStatus.configured ? 'Conectado a Sheets' : 'Sheets No Configurado'}
              </div>
            )}
            <button 
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configuración
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        
        <section className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-200 text-center">
          <h2 className="text-2xl font-semibold mb-2">Sube un documento</h2>
          <p className="text-neutral-500 mb-8">El sistema extraerá los datos y los guardará en Google Sheets automáticamente.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <button 
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center p-8 border-2 border-emerald-200 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-14 h-14 bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-7 h-7" />
              </div>
              <span className="font-medium text-emerald-900 text-lg">Tomar Foto</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-14 h-14 bg-neutral-100 text-neutral-500 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-7 h-7" />
              </div>
              <span className="font-medium text-neutral-900 text-lg">Subir Archivo</span>
            </button>
          </div>

          <input 
            type="file" 
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
          />
        </section>

        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-emerald-200 flex flex-col items-center justify-center text-center"
            >
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-1">Procesando Documento</h3>
              <p className="text-neutral-500">{processingStep}</p>
            </motion.section>
          )}

          {error && !isProcessing && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 rounded-2xl p-6 border border-red-100 flex items-start gap-4"
            >
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-medium mb-1">Error en el proceso</h3>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </motion.section>
          )}

          {success && !isProcessing && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4"
            >
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-emerald-800 font-medium mb-1">¡Éxito!</h3>
                <p className="text-emerald-600 text-sm">{success}</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {previewUrl && !isProcessing && !success && (
           <section className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex justify-center">
             <img src={previewUrl} alt="Preview" className="max-h-[300px] object-contain rounded-lg" />
           </section>
        )}

      </main>

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-600" />
                  Configuración de Google Sheets
                </h3>
                <button 
                  onClick={() => setShowSetup(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  &times;
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto text-sm text-neutral-600 space-y-4">
                <p>Para permitir que esta aplicación escriba en tu Google Sheet, necesitas configurar una Cuenta de Servicio de Google.</p>
                
                <ol className="list-decimal list-inside space-y-3">
                  <li>Ve a la <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">Consola de Google Cloud</a>.</li>
                  <li>Crea un nuevo proyecto o selecciona uno existente.</li>
                  <li>Habilita la <strong>Google Sheets API</strong> para tu proyecto.</li>
                  <li>Ve a <strong>IAM y administración &gt; Cuentas de servicio</strong> y crea una nueva cuenta de servicio.</li>
                  <li>Crea y descarga una nueva clave JSON para esta cuenta de servicio.</li>
                  <li>Abre el archivo JSON descargado. Necesitarás el <code>client_email</code> y la <code>private_key</code>.</li>
                  <li>En AI Studio, abre <strong>Settings &gt; Secrets</strong> y añade dos nuevos secretos:
                    <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-neutral-500 font-mono text-xs">
                      <li>GOOGLE_CLIENT_EMAIL</li>
                      <li>GOOGLE_PRIVATE_KEY</li>
                    </ul>
                  </li>
                  <li>Finalmente, abre tu Google Sheet y haz clic en <strong>Compartir</strong>. Compártelo con la dirección de <code>client_email</code>, dándole acceso de <strong>Editor</strong>.
                    {configStatus?.clientEmail && (
                      <div className="mt-2 p-2 bg-neutral-50 rounded border border-neutral-200 font-mono text-[10px] break-all">
                        {configStatus.clientEmail}
                      </div>
                    )}
                  </li>
                </ol>
                
                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-800">
                  <p className="font-medium mb-1">Nota Importante</p>
                  <p className="text-xs">La clave privada debe pegarse exactamente como aparece en el archivo JSON, incluyendo los caracteres <code>\n</code>.</p>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex justify-end">
                <button 
                  onClick={() => setShowSetup(false)}
                  className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
