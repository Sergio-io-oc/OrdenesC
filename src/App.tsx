import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Bus, Printer, TrendingUp, DollarSign, Calendar, Activity, Loader2, AlertCircle, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { Chart } from "react-google-charts";

// Color palette for the categories
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'];

interface MonthData {
  month: string;
  total: number;
  categories: { [key: string]: number };
  machines: { [key: string]: number };
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
  const [machineTotals, setMachineTotals] = useState<CategoryTotal[]>([]);
  const [totalAnnual, setTotalAnnual] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pieMonthFilter, setPieMonthFilter] = useState<string>('anual');
  const [pieCenterFilter, setPieCenterFilter] = useState<string>('Todos');
  const [activeIndexMachine, setActiveIndexMachine] = useState<number | undefined>();
  const [activeIndexCategory, setActiveIndexCategory] = useState<number | undefined>();
  const [machineCenterMap, setMachineCenterMap] = useState<Record<string, string>>({});

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
    const computedMachineTotals: { [key: string]: number } = {};
    const computedMachineCenterMap: Record<string, string> = {};

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
            categories: {},
            machines: {}
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
        monthsData.push({ month: monthName, total: 0, categories: {}, machines: {} });
      }

      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        let val0 = row[0] ? String(row[0]).trim() : '';
        let val3 = row[3] ? String(row[3]).trim() : '';
        
        // Skip totals rows
        if (val0.toUpperCase().includes('TOTAL') || String(row[1]).toUpperCase().includes('TOTAL') || val3.toUpperCase().includes('TOTAL')) continue;

        let categoryName = val0 || val3 || `Impresora ${i}`;
        let machineName = val3 || `Impresora ${i}`;
        const machineUpper = val3.toUpperCase();

        if (
            machineUpper.includes('TASKALFA 8003I') || 
            machineUpper.includes('PRO 8200S') || 
            machineUpper.includes('IMC 8300S')
        ) {
            categoryName = 'Centro Copiado Marcos Zuñiga';
        } else if (
            machineUpper.includes('TASKALFA 5054CI') || 
            machineUpper.includes('ECOSYS MA4000CIX') || 
            machineUpper.includes('IM 2500')
        ) {
            categoryName = 'Centro Copiado Patricia Castañeda';
        } else if (
            machineUpper.includes('IMC 2000') || 
            machineUpper.includes('MP 2555')
        ) {
            categoryName = 'Centro Copiado Biblioteca Central';
        } else if (val0) {
            if (val0.toUpperCase().includes('MARCOS ZUÑIGA')) categoryName = 'Centro Copiado Marcos Zuñiga';
            else if (val0.toUpperCase().includes('PATRICIA CASTAÑEDA')) categoryName = 'Centro Copiado Patricia Castañeda';
            else if (val0.toUpperCase().includes('BIBLIOTECA')) categoryName = 'Centro Copiado Biblioteca Central';
            else categoryName = val0;
        } else {
            categoryName = val3;
        }

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
            monthsData[mIdx].categories[categoryName] = (monthsData[mIdx].categories[categoryName] || 0) + val;
            monthsData[mIdx].machines[machineName] = (monthsData[mIdx].machines[machineName] || 0) + val;
            monthsData[mIdx].total += val;
          }
          
          computedCategoryTotals[categoryName] = (computedCategoryTotals[categoryName] || 0) + val;
          computedMachineTotals[machineName] = (computedMachineTotals[machineName] || 0) + val;
          computedMachineCenterMap[machineName] = categoryName;
          computedAnnual += val;
          
          mIdx++;
        }
      }
    }

    const catTotalsArray = Object.keys(computedCategoryTotals)
      .map(name => ({ name, value: computedCategoryTotals[name] }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const machTotalsArray = Object.keys(computedMachineTotals)
      .map(name => ({ name, value: computedMachineTotals[name] }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    setData(monthsData);
    setCategoryTotals(catTotalsArray);
    setMachineTotals(machTotalsArray);
    setMachineCenterMap(computedMachineCenterMap);
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

  // Calculate dynamic pie data based on month filter
  let displayMachineTotals = machineTotals;
  let displayCategoryTotals = categoryTotals;
  
  if (pieMonthFilter !== 'anual') {
    const selectedMonthData = data.find(m => m.month === pieMonthFilter);
    if (selectedMonthData) {
      displayMachineTotals = Object.keys(selectedMonthData.machines)
        .map(name => ({ name, value: selectedMonthData.machines[name] }))
        .filter(c => c.value > 0);
      
      displayCategoryTotals = Object.keys(selectedMonthData.categories)
        .map(name => ({ name, value: selectedMonthData.categories[name] }))
        .filter(c => c.value > 0)
        .sort((a, b) => b.value - a.value);
    } else {
      displayMachineTotals = [];
      displayCategoryTotals = [];
    }
  }

  if (pieCenterFilter !== 'Todos') {
    displayMachineTotals = displayMachineTotals.filter(m => machineCenterMap[m.name] === pieCenterFilter);
  }
  displayMachineTotals.sort((a, b) => b.value - a.value);

  const availableCenters = Array.from(new Set(Object.values(machineCenterMap))).filter(Boolean).sort();

  const preparePieData = (dataArray: {name: string, value: number}[]) => {
    if (!dataArray || dataArray.length === 0) return [];
    return [
      ["Nombre", "Gasto"],
      ...dataArray.map(item => [item.name, item.value])
    ];
  };

  const getPieOptions = (dataLength: number, activeIndex?: number) => ({
    is3D: true,
    backgroundColor: 'transparent',
    legend: 'none',
    tooltip: { trigger: 'none' },
    enableInteractivity: false,
    animation: {
      duration: 1000,
      easing: 'out',
      startup: true,
    },
    colors: COLORS,
    chartArea: { width: '85%', height: '85%' },
    slices: (activeIndex !== undefined && dataLength > 1) ? { [activeIndex]: { offset: 0.15 } } : {}
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ebf4f5] to-[#f5f7fa] font-sans text-slate-900 pb-12">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-4 shadow-sm">
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

        {/* Breakdown Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="col-span-1 lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              Gasto Total Mensual
            </h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(val) => `$${(val/1000000).toFixed(1)}M`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }} />
                  <Bar 
                    dataKey="total" 
                    name="Gasto Total"
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {dashboardType === 'impresiones' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="col-span-1 lg:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-slate-400" />
                  Desglose por Máquina {pieMonthFilter !== 'anual' ? `(${pieMonthFilter})` : '(Total Anual)'}
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={pieCenterFilter}
                    onChange={(e) => setPieCenterFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Todos">Todos los Centros</option>
                    {availableCenters.map(center => (
                      <option key={center} value={center}>{center}</option>
                    ))}
                  </select>
                  <select
                    value={pieMonthFilter}
                    onChange={(e) => setPieMonthFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="anual">Anual</option>
                    {data.map(m => (
                      <option key={m.month} value={m.month}>{m.month}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="min-h-[350px] w-full flex items-center justify-center relative">
                {displayMachineTotals.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center w-full h-full">
                    <div className="w-full sm:w-[55%] h-full pb-4 sm:pb-0">
                      <Chart
                        chartType="PieChart"
                        data={preparePieData(displayMachineTotals)}
                        options={getPieOptions(displayMachineTotals.length, activeIndexMachine)}
                        width="100%"
                        height="100%"
                      />
                    </div>
                    <div className="w-full sm:w-[45%] h-[200px] sm:h-full overflow-y-auto px-2 py-4">
                      <ul className="text-sm text-slate-600 space-y-1">
                        {displayMachineTotals.map((item, index) => (
                          <li 
                            key={item.name} 
                            className={`flex items-center justify-between cursor-pointer rounded-lg p-2 transition-colors duration-300 ${activeIndexMachine === index ? 'bg-slate-100 font-medium text-slate-900 shadow-sm' : 'hover:bg-slate-50'}`}
                            onMouseEnter={() => setActiveIndexMachine(index)}
                            onMouseLeave={() => setActiveIndexMachine(undefined)}
                            title={`Gasto: $${item.value.toLocaleString('es-CL')}`}
                          >
                            <div className="flex items-start gap-2 w-full">
                              <div className="pt-1">
                                <span className="block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                              </div>
                              <span className="flex-1 break-words leading-tight">{item.name.replace('IMPRESORA ', '')}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Sin datos para mostrar</p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="col-span-1 lg:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-slate-800">Desglose por Categoría {pieMonthFilter !== 'anual' ? `(${pieMonthFilter})` : '(Total Anual)'}</h3>
                <select
                  value={pieMonthFilter}
                  onChange={(e) => setPieMonthFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="anual">Anual</option>
                  {data.map(m => (
                    <option key={m.month} value={m.month}>{m.month}</option>
                  ))}
                </select>
              </div>
              <div className="min-h-[350px] w-full flex items-center justify-center relative">
                {displayCategoryTotals.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center w-full h-full">
                    <div className="w-full sm:w-[55%] h-full pb-4 sm:pb-0">
                      <Chart
                        chartType="PieChart"
                        data={preparePieData(displayCategoryTotals)}
                        options={getPieOptions(displayCategoryTotals.length, activeIndexCategory)}
                        width="100%"
                        height="100%"
                      />
                    </div>
                    <div className="w-full sm:w-[45%] h-[200px] sm:h-full overflow-y-auto px-2 py-4">
                      <ul className="text-sm text-slate-600 space-y-1">
                        {displayCategoryTotals.map((item, index) => (
                          <li 
                            key={item.name} 
                            className={`flex items-center justify-between cursor-pointer rounded-lg p-2 transition-colors duration-300 ${activeIndexCategory === index ? 'bg-slate-100 font-medium text-slate-900 shadow-sm' : 'hover:bg-slate-50'}`}
                            onMouseEnter={() => setActiveIndexCategory(index)}
                            onMouseLeave={() => setActiveIndexCategory(undefined)}
                            title={`Gasto: $${item.value.toLocaleString('es-CL')}`}
                          >
                            <div className="flex items-start gap-2 w-full">
                              <div className="pt-1">
                                <span className="block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                              </div>
                              <span className="flex-1 break-words leading-tight">{item.name.replace('CENTRO DE COPIADO ', '')}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Sin datos para mostrar</p>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Breakdown Stacked Bar Chart */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-800 mb-6">
            Gasto por {dashboardType === 'impresiones' ? 'Centro de Copiado' : 'Categorías'} por Mes
          </h3>
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
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', lineHeight: '18px' }} />
                  {categoryTotals.map((cat, index) => (
                    <Bar 
                      key={cat.name} 
                      dataKey={`categories.${cat.name}`} 
                      name={cat.name}
                      stackId="a" 
                      fill={COLORS[index % COLORS.length]} 
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

      </main>

    </div>
  );
}
