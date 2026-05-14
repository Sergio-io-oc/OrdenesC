import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Bus, Printer, TrendingUp, DollarSign, Calendar, Activity, Loader2, AlertCircle, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

// Color palette for the categories
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'];

interface MonthData {
  month: string;
  total: number;
  categories: { [key: string]: number };
}

interface CategoryTotal {
  name: string;
  value: number;
}

export default function App() {
  const [dashboardType, setDashboardType] = useState<'movilizacion' | 'impresiones'>('movilizacion');
  const [dataCache, setDataCache] = useState<Record<string, any[][]>>({});
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  
  const [data, setData] = useState<MonthData[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [totalAnnual, setTotalAnnual] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const handleAskGemini = async () => {
    if (!aiPrompt.trim() || !selectedSheet) return;
    setLoadingAi(true);
    setAiResult("");
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, contextData: dataCache[selectedSheet] })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error de la IA');
      setAiResult(resData.result);
    } catch (err: any) {
      setAiResult("**Error:** " + err.message + "\n\n(Asegúrate de configurar `GEMINI_API_KEY` en tu entorno si aún no lo has hecho)");
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchData = useCallback(async (isRefresh = false, type = dashboardType) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const response = await fetch(`/api/data?type=${type}`);
      if (!response.ok) throw new Error('Data fetch failed');
      const jsonData = await response.json();
      
      setDataCache(jsonData);
      
      const sheets = Object.keys(jsonData).filter(key => jsonData[key] && jsonData[key].length > 0);
      setAvailableSheets(sheets);
      
      if (sheets.length > 0) {
        // If selectedSheet is not in the new list, pick the first one
        if (!selectedSheet || !sheets.includes(selectedSheet)) {
          setSelectedSheet(sheets[0]);
        } else {
          // Manual re-trigger parse for selected sheet
          processSheet(jsonData[selectedSheet]);
        }
      } else {
        setError("No se encontraron hojas válidas en el documento.");
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSheet, dashboardType]);

  useEffect(() => {
    fetchData(false, dashboardType);
    const interval = setInterval(() => {
      fetchData(true, dashboardType);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, dashboardType]);

  useEffect(() => {
    if (selectedSheet && dataCache[selectedSheet]) {
      processSheet(dataCache[selectedSheet]);
    }
  }, [selectedSheet, dataCache]);

  const processSheet = (rows: any[][]) => {
    if (!rows || rows.length < 4) {
      setData([]);
      setCategoryTotals([]);
      setTotalAnnual(0);
      return;
    }
    
    // The headers are usually on row 2 (index 2)
    const rawHeaders = rows[2];
    const monthsData: MonthData[] = [];
    
    let computedAnnual = 0;
    const computedCategoryTotals: { [key: string]: number } = {};

    if (dashboardType === 'movilizacion') {
      // Parse rows (Row 3 to end, excluding TOTAL ANUAL)
      for (let i = 3; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const monthName = row[0] ? String(row[0]).trim() : '';
          if (!monthName || monthName.toUpperCase().includes('TOTAL')) continue;

          const monthData: MonthData = {
            month: monthName,
            total: 0,
            categories: {}
          };

          let monthTotal = 0;

          for (let j = 1; j < row.length; j++) {
              const header = rawHeaders[j] ? String(rawHeaders[j]).trim() : '';
              if (!header || header === 'TOTAL GASTO MENSUAL') continue;
              
              let val = 0;
              const cellValue = row[j];
              if (typeof cellValue === 'number') {
                  val = cellValue;
              } else if (typeof cellValue === 'string') {
                  const valStr = cellValue.replace(/\$|\./g, '').trim();
                  val = valStr && valStr !== '-' ? parseInt(valStr, 10) : 0;
              }
              
              if (isNaN(val)) val = 0;
              
              monthData.categories[header] = val;
              monthTotal += val;
              
              computedCategoryTotals[header] = (computedCategoryTotals[header] || 0) + val;
          }

          monthData.total = monthTotal;
          computedAnnual += monthTotal;
          monthsData.push(monthData);
      }
    } else {
      // IMPRESIONES format: Categories are rows, months are columns starting from index 4
      const monthStartIdx = 4;
      
      // Initialize months
      for (let m = monthStartIdx; m < rawHeaders.length; m++) {
        const monthName = rawHeaders[m] ? String(rawHeaders[m]).trim() : '';
        if (!monthName || monthName.toUpperCase().includes('TOTAL')) continue;
        monthsData.push({ month: monthName, total: 0, categories: {} });
      }

      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        let val0 = row[0] ? String(row[0]).trim() : '';
        let val3 = row[3] ? String(row[3]).trim() : '';
        let categoryName = val0 || val3 || `Impresora ${i}`;
        
        // Skip totals rows
        if (categoryName.toUpperCase().includes('TOTAL') || String(row[1]).toUpperCase().includes('TOTAL')) continue;

        let mIdx = 0;
        for (let m = monthStartIdx; m < rawHeaders.length; m++) {
          const monthName = rawHeaders[m] ? String(rawHeaders[m]).trim() : '';
          if (!monthName || monthName.toUpperCase().includes('TOTAL')) continue;
          
          let val = 0;
          const cellValue = row[m];
          if (typeof cellValue === 'number') {
              val = cellValue;
          } else if (typeof cellValue === 'string') {
              const valStr = cellValue.replace(/\$|\./g, '').trim();
              val = valStr && valStr !== '-' ? parseInt(valStr, 10) : 0;
          }
          if (isNaN(val)) val = 0;

          if (monthsData[mIdx]) {
            monthsData[mIdx].categories[categoryName] = val;
            monthsData[mIdx].total += val;
          }
          
          computedCategoryTotals[categoryName] = (computedCategoryTotals[categoryName] || 0) + val;
          computedAnnual += val;
          
          mIdx++;
        }
      }
    }

    const catTotalsArray = Object.keys(computedCategoryTotals)
      .map(name => ({ name, value: computedCategoryTotals[name] }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    setData(monthsData);
    setCategoryTotals(catTotalsArray);
    setTotalAnnual(computedAnnual);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-neutral-100">
          <p className="font-semibold text-neutral-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm mb-1">
              <span style={{ color: entry.color }} className="font-medium">
                {entry.name}:
              </span>
              <span className="text-neutral-700 font-semibold">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-emerald-600">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-medium">Cargando datos en tiempo real...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-red-50 p-6 rounded-3xl max-w-md w-full border border-red-100 flex items-start gap-4 shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <h2 className="text-red-800 font-semibold text-lg mb-1">Error de conexión</h2>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button 
              onClick={() => fetchData(false)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-calculate highest spending month
  const sortedByTotal = [...data].sort((a, b) => b.total - a.total);
  const highestMonth = sortedByTotal.length > 0 ? sortedByTotal[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-sm border ${
              dashboardType === 'movilizacion' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'
            }`}>
              {dashboardType === 'movilizacion' ? <Bus className="w-6 h-6" /> : <Printer className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">
                {dashboardType === 'movilizacion' ? 'Gastos Movilización' : 'Gastos de Impresiones'}
              </h1>
              <p className="text-sm text-slate-500 font-medium leading-none">
                {dashboardType === 'movilizacion' ? 'Buses Espinoza Dashboard' : 'Impresiones Dashboard'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Type Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setDashboardType('movilizacion')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  dashboardType === 'movilizacion' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Movilización
              </button>
              <button
                onClick={() => setDashboardType('impresiones')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  dashboardType === 'impresiones' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Impresiones
              </button>
            </div>

            {/* Year / Sheet Selector */}
            <div className="relative">
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="appearance-none bg-slate-100 hover:bg-slate-200 border-none text-slate-800 font-semibold py-2 pl-4 pr-10 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors"
                style={{ height: "36px" }}
              >
                {availableSheets.map(sheet => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 font-medium">Gasto Anual Acumulado</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalAnnual)}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 font-medium">Promedio Mensual</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(data.length ? totalAnnual / data.length : 0)}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-slate-500 font-medium">Mes con Mayor Gasto</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {highestMonth?.month || '-'}
            </p>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {highestMonth ? formatCurrency(highestMonth.total) : ''}
            </p>
          </motion.div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              Evolución Mensual
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(val) => `$${(val/1000000).toFixed(1)}M`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    name="Gasto Total"
                    dataKey="total" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-6">Desglose por Categoría (Total Anual)</h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              {categoryTotals.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryTotals.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right"
                      wrapperStyle={{ fontSize: '12px', color: '#475569' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm">Sin datos para mostrar</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Breakdown Bar Chart */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-800 mb-6">Gasto de Categorías por Mes</h3>
          <div className="h-[400px] w-full mt-4">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(val) => `$${(val/1000000).toFixed(0)}M`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                  {categoryTotals.map((cat, index) => (
                    <Bar 
                      key={cat.name} 
                      dataKey={`categories.${cat.name}`} 
                      name={cat.name}
                      stackId="a" 
                      fill={COLORS[index % COLORS.length]} 
                      radius={index === categoryTotals.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">Sin datos de desglose disponibles</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Gemini AI Integration */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-indigo-900">Análisis con Gemini AI</h3>
          </div>
          <p className="text-indigo-700 text-sm mb-4">Pregúntale a la inteligencia artificial sobre tus gastos en esta hoja. Hará los cálculos o comparaciones que le pidas.</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text" 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ej: ¿Cuál fue el mes de mayor gasto y por qué?"
              className="flex-1 px-4 py-3 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAskGemini(); }}
            />
            <button 
              onClick={handleAskGemini}
              disabled={loadingAi || !aiPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
            >
              {loadingAi ? <Loader2 className="h-5 w-5 animate-spin" /> : "Preguntar"}
            </button>
          </div>
          
          {aiResult && (
            <div className="mt-6 bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
              <div className="prose prose-sm prose-indigo max-w-none">
                <Markdown>{aiResult}</Markdown>
              </div>
            </div>
          )}
        </motion.div>

      </main>

    </div>
  );
}
