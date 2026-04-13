'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Wand2, 
  Image as ImageIcon, 
  Sparkles, 
  Paintbrush, 
  SlidersHorizontal, 
  Download,
  Upload,
  Trash2,
  Loader2,
  Eraser,
  Zap,
  Undo2,
  Redo2,
  Eye
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'generar' | 'editar' | 'mejorar' | 'analizar' | 'dibujar' | 'filtros';
type EnhancementLevel = 'basico' | 'avanzado' | 'ultra';

export default function NanoBananEditor() {
  const [activeTab, setActiveTab] = useState<Tab>('generar');
  const [enhancementLevel, setEnhancementLevel] = useState<EnhancementLevel>('basico');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  
  // History state for Undo/Redo
  const [historyState, setHistoryState] = useState({
    history: [] as string[],
    index: -1
  });
  const [showOriginal, setShowOriginal] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set initial canvas size to fit container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#18181b'; // zinc-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Save initial blank state to history
      setTimeout(() => {
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        setHistoryState({
          history: [base64],
          index: 0
        });
      }, 100);
    }
  }, []);

  const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  };

  const getCanvasBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1]; // Return base64 without prefix
  };

  const saveHistoryState = () => {
    const base64 = getCanvasBase64();
    if (!base64) return;
    
    setHistoryState(prev => {
      const newHistory = prev.history.slice(0, prev.index + 1);
      newHistory.push(base64);
      if (newHistory.length > 20) {
        newHistory.shift();
      }
      return {
        history: newHistory,
        index: newHistory.length - 1
      };
    });
  };

  const handleUndo = () => {
    if (historyState.index <= 0) return;
    const newIndex = historyState.index - 1;
    setHistoryState(prev => ({ ...prev, index: newIndex }));
    
    const base64 = historyState.history[newIndex];
    drawImageToCanvas(`data:image/png;base64,${base64}`, false);
  };

  const handleRedo = () => {
    if (historyState.index >= historyState.history.length - 1) return;
    const newIndex = historyState.index + 1;
    setHistoryState(prev => ({ ...prev, index: newIndex }));
    
    const base64 = historyState.history[newIndex];
    drawImageToCanvas(`data:image/png;base64,${base64}`, false);
  };

  const drawImageToCanvas = (src: string, saveToHistory = true) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const container = containerRef.current;
    if (!canvas || !ctx || !container) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Resize canvas to match image dimensions (up to container size)
      const maxWidth = container.clientWidth - 64; // 32px padding
      const maxHeight = container.clientHeight - 64;
      
      let width = img.width;
      let height = img.height;
      
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = width * scale;
      height = height * scale;
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      if (saveToHistory) {
        saveHistoryState();
      }
    };
    img.src = src;
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsProcessing(true);
    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          drawImageToCanvas(imageUrl);
          break;
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Error al generar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!prompt) return;
    const base64Data = getCanvasBase64();
    if (!base64Data) return;

    setIsProcessing(true);
    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          drawImageToCanvas(imageUrl);
          break;
        }
      }
    } catch (error) {
      console.error('Edit failed:', error);
      alert('Error al editar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnhance = async () => {
    const base64Data = getCanvasBase64();
    if (!base64Data) return;

    setIsProcessing(true);
    try {
      const ai = getAiClient();
      
      let enhancePrompt = '';
      switch (enhancementLevel) {
        case 'basico':
          enhancePrompt = 'Mejora ligeramente la calidad de esta imagen, ajustando el contraste y la nitidez básica. Mantén el contenido original.';
          break;
        case 'avanzado':
          enhancePrompt = 'Mejora significativamente la calidad de esta imagen. Aumenta la resolución, corrige la iluminación, mejora los colores y haz que los detalles sean más nítidos y profesionales.';
          break;
        case 'ultra':
          enhancePrompt = 'Transforma esta imagen a calidad ultra realista 4K. Maximiza los detalles, aplica iluminación de estudio profesional, texturas hiperrealistas y calidad cinematográfica. El resultado debe ser impecable.';
          break;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: enhancePrompt,
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          drawImageToCanvas(imageUrl);
          break;
        }
      }
    } catch (error) {
      console.error('Enhance failed:', error);
      alert('Error al mejorar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    const base64Data = getCanvasBase64();
    if (!base64Data) return;

    setIsProcessing(true);
    setAnalysisResult(null);
    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: 'Analiza esta imagen en detalle. Describe su estilo, contenido y cualquier característica única. Mantén un tono profesional y descriptivo, y responde en español.',
            },
          ],
        },
      });

      setAnalysisResult(response.text || 'No hay análisis disponible.');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Error al analizar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'dibujar') return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      saveHistoryState();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTab !== 'dibujar') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Calculate scale factor since canvas might be styled differently than its actual size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    
    if (isEraser) {
      ctx.strokeStyle = '#18181b'; // Draw with background color to simulate erasing
    } else {
      ctx.strokeStyle = brushColor;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const applyFilter = (filterStr: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // To apply filter to existing canvas content, we need to draw it to a temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(canvas, 0, 0);

    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply filter and draw back
    ctx.filter = filterStr;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none'; // Reset filter
    
    saveHistoryState();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        drawImageToCanvas(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'nano-banan-pro.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const container = containerRef.current;
    if (!canvas || !ctx || !container) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistoryState();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
              <ImageIcon className="w-5 h-5" />
            </span>
            Nano Banan Pro
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 p-4 border-b border-zinc-800 bg-zinc-950/50">
          {[
            { id: 'generar', icon: Wand2, label: 'Generar' },
            { id: 'editar', icon: ImageIcon, label: 'Editar' },
            { id: 'mejorar', icon: Zap, label: 'Mejorar' },
            { id: 'analizar', icon: Sparkles, label: 'Analizar' },
            { id: 'dibujar', icon: Paintbrush, label: 'Dibujar' },
            { id: 'filtros', icon: SlidersHorizontal, label: 'Filtros' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all flex-1 justify-center",
                activeTab === tab.id 
                  ? "bg-blue-500 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tools Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {activeTab === 'generar' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Descripción (Prompt)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Un paisaje futurista con montañas de neón..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Relación de Aspecto</label>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '4:3', '16:9', '3:4', '9:16'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        "py-2 rounded-md text-xs font-medium border transition-colors",
                        aspectRatio === ratio 
                          ? "bg-blue-500/10 border-blue-500 text-blue-400" 
                          : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isProcessing || !prompt}
                className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generar Imagen
              </button>
            </div>
          )}

          {activeTab === 'editar' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Instrucciones de Edición</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Cambia el fondo a un atardecer..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={handleEdit}
                disabled={isProcessing || !prompt}
                className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Aplicar Edición
              </button>
            </div>
          )}

          {activeTab === 'mejorar' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg shadow-inner">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Mejora de Calidad</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Utiliza IA para aumentar la nitidez, los detalles y la calidad general de la imagen actual.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Nivel de Mejora</label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'basico', label: 'Básico', desc: 'Contraste y nitidez' },
                    { id: 'avanzado', label: 'Avanzado', desc: 'Colores e iluminación' },
                    { id: 'ultra', label: 'Ultra Detalle', desc: 'Calidad 4K hiperrealista' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setEnhancementLevel(level.id as EnhancementLevel)}
                      className={cn(
                        "p-3 rounded-lg text-left border transition-all",
                        enhancementLevel === level.id 
                          ? "bg-blue-500/10 border-blue-500" 
                          : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        enhancementLevel === level.id ? "text-blue-400" : "text-zinc-300"
                      )}>
                        {level.label}
                      </div>
                      <div className="text-xs text-zinc-500">{level.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleEnhance}
                disabled={isProcessing}
                className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Mejorar Calidad
              </button>
            </div>
          )}

          {activeTab === 'analizar' && (
            <div className="space-y-6">
              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className="w-full py-2.5 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-zinc-700"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analizar Imagen
              </button>
              
              {analysisResult && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg shadow-inner">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Resultado del Análisis</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {analysisResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dibujar' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Herramienta</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEraser(false)}
                    className={cn(
                      "flex-1 py-2 rounded-md text-xs font-medium border flex items-center justify-center gap-2 transition-colors",
                      !isEraser ? "bg-blue-500/10 border-blue-500 text-blue-400" : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <Paintbrush className="w-4 h-4" /> Pincel
                  </button>
                  <button
                    onClick={() => setIsEraser(true)}
                    className={cn(
                      "flex-1 py-2 rounded-md text-xs font-medium border flex items-center justify-center gap-2 transition-colors",
                      isEraser ? "bg-blue-500/10 border-blue-500 text-blue-400" : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <Eraser className="w-4 h-4" /> Borrador
                  </button>
                </div>
              </div>

              {!isEraser && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Color</label>
                  <div className="flex flex-wrap gap-3">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBrushColor(color)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-transform",
                          brushColor === color ? "border-white scale-125 shadow-md" : "border-transparent hover:scale-110"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  Tamaño: {brushSize}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'filtros' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Filtros Rápidos</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Escala de grises', filter: 'grayscale(100%)' },
                  { name: 'Sepia', filter: 'sepia(100%)' },
                  { name: 'Invertir', filter: 'invert(100%)' },
                  { name: 'Desenfocar', filter: 'blur(4px)' },
                  { name: 'Contraste +', filter: 'contrast(150%)' },
                  { name: 'Brillo +', filter: 'brightness(130%)' },
                  { name: 'Saturación +', filter: 'saturate(200%)' },
                  { name: 'Tono 90°', filter: 'hue-rotate(90deg)' },
                ].map((f) => (
                  <button
                    key={f.name}
                    onClick={() => applyFilter(f.filter)}
                    className="w-full py-2.5 bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-blue-500 hover:text-blue-400 rounded-md font-medium text-xs transition-colors"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Global Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 grid grid-cols-2 gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="col-span-2 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-md font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700"
          >
            <Upload className="w-3.5 h-3.5" />
            Subir Imagen
          </button>
          <button
            onClick={downloadImage}
            className="py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-md font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700"
          >
            <Download className="w-3.5 h-3.5" />
            Guardar
          </button>
          <button
            onClick={clearCanvas}
            className="py-2 bg-zinc-800 text-red-400 hover:bg-red-900/30 hover:border-red-900/50 rounded-md font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
        {/* Top Toolbar */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleUndo} 
              disabled={historyState.index <= 0}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
              title="Deshacer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleRedo} 
              disabled={historyState.index >= historyState.history.length - 1}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
              title="Rehacer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              disabled={historyState.index <= 0}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Ver Original
            </button>
          </div>
        </div>

        <div 
          className="flex-1 p-8 flex items-center justify-center relative"
          ref={containerRef}
        >
          {/* Professional subtle grid background */}
          <div className="absolute inset-0 pointer-events-none" 
               style={{ 
                 backgroundImage: 'linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)', 
                 backgroundSize: '40px 40px',
                 opacity: 0.2
               }} />
          
          <div className="relative shadow-2xl rounded-sm overflow-hidden border border-zinc-800 bg-zinc-900">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={cn(
                "block transition-all",
                activeTab === 'dibujar' ? (isEraser ? "cursor-cell" : "cursor-crosshair") : "cursor-default",
                showOriginal ? "opacity-0" : "opacity-100"
              )}
              style={{ touchAction: 'none' }}
            />
            {showOriginal && historyState.history.length > 0 && (
              <img 
                src={`data:image/png;base64,${historyState.history[0]}`} 
                alt="Original" 
                className="absolute inset-0 w-full h-full object-contain bg-zinc-900 pointer-events-none"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
