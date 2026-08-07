import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bus, 
  Clock, 
  MapPin, 
  LogOut, 
  CheckCircle2, 
  Search, 
  Download, 
  Trash2, 
  Plus, 
  Car,
  Users,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  X,
  User,
  Hash,
  ExternalLink,
  Copy,
  Check,
  FileCode,
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';

export interface TripRecord {
  id: string;
  vehicleType: 'Bus' | 'Van';
  plate: string;
  driver?: string;
  passengers?: number;
  arrivalTime: string; // ISO string or formatted
  arrivalTimestamp: number;
  returnTime?: string;
  returnTimestamp?: number;
  status: 'active' | 'returned';
  notes?: string;
}

// Custom Bus & Van SVG Drawing Components
const BusDrawing: React.FC<{ plate: string; className?: string }> = ({ plate, className = "w-24 h-20" }) => (
  <div className={`relative flex flex-col items-center select-none ${className}`}>
    <svg viewBox="0 0 120 90" className="w-full h-full drop-shadow-md">
      {/* Bus Body */}
      <rect x="10" y="15" width="100" height="52" rx="10" fill="#2563eb" />
      {/* Top Roof outline */}
      <rect x="15" y="10" width="90" height="8" rx="4" fill="#1d4ed8" />
      {/* Front windshield */}
      <rect x="82" y="20" width="22" height="22" rx="4" fill="#93c5fd" />
      {/* Side Windows */}
      <rect x="18" y="22" width="16" height="16" rx="2" fill="#bfdbfe" />
      <rect x="38" y="22" width="16" height="16" rx="2" fill="#bfdbfe" />
      <rect x="58" y="22" width="16" height="16" rx="2" fill="#bfdbfe" />
      {/* Bus Stripe */}
      <rect x="10" y="44" width="100" height="6" fill="#fbbf24" />
      {/* Headlight */}
      <circle cx="104" cy="52" r="3" fill="#fef08a" />
      {/* Bumper */}
      <rect x="8" y="60" width="104" height="6" rx="2" fill="#475569" />
      {/* Wheels */}
      <circle cx="32" cy="66" r="10" fill="#1e293b" />
      <circle cx="32" cy="66" r="5" fill="#94a3b8" />
      <circle cx="88" cy="66" r="10" fill="#1e293b" />
      <circle cx="88" cy="66" r="5" fill="#94a3b8" />
    </svg>
    {/* License Plate Badge */}
    <div className="absolute -bottom-1 bg-amber-300 text-slate-900 border border-slate-800 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow-sm tracking-wider uppercase">
      {plate}
    </div>
  </div>
);

const VanDrawing: React.FC<{ plate: string; className?: string }> = ({ plate, className = "w-24 h-20" }) => (
  <div className={`relative flex flex-col items-center select-none ${className}`}>
    <svg viewBox="0 0 120 90" className="w-full h-full drop-shadow-md">
      {/* Van Main Body */}
      <path d="M 15 30 Q 20 20 35 20 L 75 20 Q 95 20 102 38 L 105 60 L 15 60 Z" fill="#10b981" />
      <rect x="15" y="45" width="90" height="18" fill="#059669" />
      {/* Windshield */}
      <path d="M 75 24 L 92 24 Q 98 32 98 38 L 75 38 Z" fill="#a7f3d0" />
      {/* Side Window */}
      <rect x="30" y="24" width="20" height="14" rx="2" fill="#a7f3d0" />
      <rect x="53" y="24" width="18" height="14" rx="2" fill="#a7f3d0" />
      {/* Door detail */}
      <line x1="72" y1="20" x2="72" y2="60" stroke="#047857" strokeWidth="1.5" />
      {/* Bumper */}
      <rect x="12" y="58" width="96" height="5" rx="2" fill="#334155" />
      {/* Wheels */}
      <circle cx="35" cy="64" r="9" fill="#1e293b" />
      <circle cx="35" cy="64" r="4.5" fill="#cbd5e1" />
      <circle cx="85" cy="64" r="9" fill="#1e293b" />
      <circle cx="85" cy="64" r="4.5" fill="#cbd5e1" />
    </svg>
    {/* License Plate Badge */}
    <div className="absolute -bottom-1 bg-amber-300 text-slate-900 border border-slate-800 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow-sm tracking-wider uppercase">
      {plate}
    </div>
  </div>
);

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxlU4ONYyqT1glK9E5zkZMFH9w-9ALGIRZzItzRndmBhcPUq-d59JdZemVCewATTSdeUA/exec';

export const EstadioMaristaControl: React.FC = () => {
  const [vehicleType, setVehicleType] = useState<'Bus' | 'Van'>('Bus');
  const [plate, setPlate] = useState<string>('');
  const [driver, setDriver] = useState<string>('');
  const [passengers, setPassengers] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string>(() => localStorage.getItem('estadio_webhook_url') || DEFAULT_WEBHOOK_URL);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialMount = useRef(true);
  
  const [trips, setTrips] = useState<TripRecord[]>(() => {
    const saved = localStorage.getItem('estadio_marista_trips');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: '1',
        vehicleType: 'Bus',
        plate: 'ABCD12',
        driver: 'Carlos Mendoza',
        passengers: 35,
        arrivalTime: new Date(Date.now() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        arrivalTimestamp: Date.now() - 45 * 60000,
        status: 'active',
        notes: 'Delegación Basquetbol'
      },
      {
        id: '2',
        vehicleType: 'Van',
        plate: 'XY9900',
        driver: 'Juan Pérez',
        passengers: 8,
        arrivalTime: new Date(Date.now() - 20 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        arrivalTimestamp: Date.now() - 20 * 60000,
        status: 'active',
        notes: 'Profesorado y Apoyos'
      }
    ];
  });

  const [selectedVehicle, setSelectedVehicle] = useState<TripRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'returned'>('all');
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar datos en vivo desde la planilla Google Sheets pública
  const loadTripsFromSheet = useCallback(async () => {
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/10fBagqN02_xqo_wvrPx5WlqzJOpBF3YZ6sTeenRlfjA/gviz/tq?tqx=out:csv&gid=0';
    setIsSyncing(true);
    try {
      const res = await fetch(GOOGLE_SHEET_CSV_URL);
      if (!res.ok) throw new Error('Error al conectar con Google Sheets CSV');
      const text = await res.text();
      
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 1) {
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim().replace(/^"|"$/g, ''));
          return result;
        };

        const fetchedTrips: TripRecord[] = [];
        // Ignorar encabezados (línea 0)
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 3) continue;

          // Col 0: Valor ($150.000, $137.500)
          // Col 1: Tipo Vehículo (Bus, Van)
          // Col 2: Patente
          // Col 3: Profesor a Cargo
          // Col 4: Pasajeros
          // Col 5: Fecha y Hora Llegada
          // Col 6: Fecha y Hora Regreso
          // Col 7: Estado
          // Col 8: Observaciones

          const vehicleTypeRaw = cols[1] || '';
          if (!vehicleTypeRaw || vehicleTypeRaw.toLowerCase().includes('tipo')) continue;

          const vehicleType: 'Bus' | 'Van' = vehicleTypeRaw.toLowerCase().includes('van') ? 'Van' : 'Bus';
          const plate = cols[2] || '';
          if (!plate || plate.toLowerCase() === 'patente') continue;

          const driver = cols[3] || '';
          const passengers = parseInt(cols[4], 10) || 0;
          const arrivalTime = cols[5] || '';
          const returnTime = cols[6] || '';
          const estadoRaw = cols[7] || '';
          
          const status: 'active' | 'returned' = (
            estadoRaw.toLowerCase().includes('estadio') || 
            estadoRaw.toLowerCase().includes('active') || 
            (!returnTime && !estadoRaw.toLowerCase().includes('regres'))
          ) ? 'active' : 'returned';

          const notes = cols[8] || '';

          fetchedTrips.push({
            id: `sheet-${i}-${plate}`,
            vehicleType,
            plate: plate.toUpperCase(),
            driver,
            passengers,
            arrivalTime: arrivalTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            arrivalTimestamp: Date.now() - (lines.length - i) * 60000,
            returnTime: returnTime || undefined,
            returnTimestamp: returnTime ? Date.now() : undefined,
            status,
            notes
          });
        }

        if (fetchedTrips.length > 0) {
          setTrips(fetchedTrips);
          localStorage.setItem('estadio_marista_trips', JSON.stringify(fetchedTrips));
          setSyncStatus(`Cargado (${fetchedTrips.length} de Google Sheets)`);
          return;
        }
      }
    } catch (e) {
      console.warn('Carga directa de CSV falló o sin datos:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Carga inicial y actualización en tiempo real cada 10 segundos
  useEffect(() => {
    loadTripsFromSheet();
    const interval = setInterval(() => {
      loadTripsFromSheet();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadTripsFromSheet]);

  const sendSyncToSheet = async (dataToSync: TripRecord[]) => {
    const targetUrl = DEFAULT_WEBHOOK_URL;
    setIsSyncing(true);
    try {
      const formattedData = dataToSync.map(t => {
        const valorNum = t.vehicleType === 'Van' ? 137500 : 150000;
        const valorText = `$${valorNum.toLocaleString('es-CL')}`;
        return {
          valor: valorNum,
          Valor: valorNum,
          VALOR: valorNum,
          valorTexto: valorText,
          id: valorNum,
          ID: valorNum,
          Id: valorNum,
          monto: valorNum,
          Monto: valorNum,
          precio: valorNum,
          value: valorNum,
          tipoVehiculo: t.vehicleType,
          TipoVehiculo: t.vehicleType,
          tipo_vehiculo: t.vehicleType,
          vehicleType: t.vehicleType,
          patente: t.plate,
          Patente: t.plate,
          plate: t.plate,
          profesorACargo: t.driver || '',
          ProfesorACargo: t.driver || '',
          profesor_a_cargo: t.driver || '',
          driver: t.driver || '',
          pasajeros: t.passengers || 0,
          Pasajeros: t.passengers || 0,
          passengers: t.passengers || 0,
          fechaHoraLlegada: t.arrivalTime,
          FechaHoraLlegada: t.arrivalTime,
          fecha_hora_llegada: t.arrivalTime,
          arrivalTime: t.arrivalTime,
          fechaHoraRegreso: t.returnTime || '',
          FechaHoraRegreso: t.returnTime || '',
          fecha_hora_regreso: t.returnTime || '',
          returnTime: t.returnTime || '',
          estado: t.status === 'active' ? 'En Estadio Marista' : 'Regresó al Colegio',
          Estado: t.status === 'active' ? 'En Estadio Marista' : 'Regresó al Colegio',
          status: t.status === 'active' ? 'En Estadio Marista' : 'Regresó al Colegio',
          observaciones: t.notes || '',
          Observaciones: t.notes || '',
          notes: t.notes || ''
        };
      });

      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(formattedData),
        mode: 'no-cors'
      });
      setSyncStatus('Sincronizado');
    } catch (err: any) {
      console.error('Error enviando a Google Sheets:', err);
      setSyncStatus('Error al sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('estadio_marista_trips', JSON.stringify(trips));
  }, [trips]);

  const handleArrival = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) {
      setFormError('Por favor ingrese la patente del vehículo.');
      return;
    }

    const cleanPlate = plate.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (cleanPlate.length < 4) {
      setFormError('La patente debe tener al menos 4 caracteres.');
      return;
    }

    // Check if vehicle is already currently active at Estadio
    const isAlreadyActive = trips.some(
      t => t.status === 'active' && t.plate.replace(/[^A-Z0-9]/g, '') === cleanPlate.replace(/[^A-Z0-9]/g, '')
    );

    if (isAlreadyActive) {
      setFormError(`El vehículo con patente ${cleanPlate} ya se encuentra registrado en el Estadio Marista.`);
      return;
    }

    setFormError(null);
    const now = new Date();
    const parsedPassengers = passengers ? parseInt(passengers, 10) : undefined;

    const newTrip: TripRecord = {
      id: Date.now().toString(),
      vehicleType,
      plate: cleanPlate,
      driver: driver.trim() || undefined,
      passengers: parsedPassengers && !isNaN(parsedPassengers) ? parsedPassengers : undefined,
      arrivalTime: `${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
      arrivalTimestamp: now.getTime(),
      status: 'active',
      notes: notes.trim() || undefined
    };

    const updatedTrips = [newTrip, ...trips];
    setTrips(updatedTrips);
    sendSyncToSheet(updatedTrips);
    setPlate('');
    setDriver('');
    setPassengers('');
    setNotes('');
  };

  const handleReturn = (id: string) => {
    const now = new Date();
    const returnFormatted = `${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    
    const updatedTrips = trips.map(trip => {
      if (trip.id === id) {
        return {
          ...trip,
          status: 'returned' as const,
          returnTime: returnFormatted,
          returnTimestamp: now.getTime()
        };
      }
      return trip;
    });

    setTrips(updatedTrips);
    sendSyncToSheet(updatedTrips);

    if (selectedVehicle?.id === id) {
      setSelectedVehicle(null);
    }
  };

  const handleDelete = (id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id));
    if (selectedVehicle?.id === id) {
      setSelectedVehicle(null);
    }
  };

  const activeVehicles = trips.filter(t => t.status === 'active');

  const filteredTrips = trips.filter(t => {
    const matchesSearch = t.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driver && t.driver.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.passengers && t.passengers.toString().includes(searchTerm));
    
    if (filterStatus === 'active') return matchesSearch && t.status === 'active';
    if (filterStatus === 'returned') return matchesSearch && t.status === 'returned';
    return matchesSearch;
  });

  const getTimeElapsed = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min${diffMins > 1 ? 's' : ''}`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `Hace ${hours}h ${mins}m`;
  };

  const googleSheetUrl = "https://docs.google.com/spreadsheets/d/10fBagqN02_xqo_wvrPx5WlqzJOpBF3YZ6sTeenRlfjA/edit?gid=0#gid=0";

  const exportToCSV = () => {
    const headers = ['Valor', 'Tipo', 'Patente', 'Profesor a Cargo', 'Pasajeros', 'Fecha y Hora Llegada', 'Fecha y Hora Regreso', 'Estado', 'Notas'];
    const rows = trips.map(t => [
      t.vehicleType === 'Van' ? 137500 : 150000,
      t.vehicleType,
      t.plate,
      t.driver || '',
      t.passengers || '',
      t.arrivalTime,
      t.returnTime || '',
      t.status === 'active' ? 'En Estadio Marista' : 'Regresó al Colegio',
      t.notes || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Control_Estadio_Marista_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const formattedData = trips.map(t => ({
      valor: t.vehicleType === 'Van' ? 137500 : 150000,
      tipoVehiculo: t.vehicleType,
      patente: t.plate,
      profesorACargo: t.driver || '',
      pasajeros: t.passengers || 0,
      fechaHoraLlegada: t.arrivalTime,
      fechaHoraRegreso: t.returnTime || '',
      estado: t.status === 'active' ? 'En Estadio Marista' : 'Regresó al Colegio',
      observaciones: t.notes || ''
    }));

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(formattedData, null, 2))}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `Control_Estadio_Marista_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualSync = async () => {
    await sendSyncToSheet(trips);
  };

  const appsScriptCode = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Si la hoja está vacía, coloca los encabezados requeridos
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID", 
        "Tipo Vehículo", 
        "Patente", 
        "Profesor a Cargo", 
        "Pasajeros", 
        "Fecha y Hora Llegada", 
        "Fecha y Hora Regreso", 
        "Estado", 
        "Observaciones"
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#dbeafe");
    }
    
    // Si recibe el listado completo, sincroniza las filas
    if (Array.isArray(data)) {
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).clearContent();
      }
      data.forEach(function(row) {
        sheet.appendRow([
          row.id || "",
          row.tipoVehiculo || row.vehicleType || "",
          row.patente || row.plate || "",
          row.profesorACargo || row.driver || "",
          row.pasajeros || row.passengers || "",
          row.fechaHoraLlegada || row.arrivalTime || "",
          row.fechaHoraRegreso || row.returnTime || "",
          row.estado || "",
          row.observaciones || row.notes || ""
        ]);
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="space-y-8">
      {/* Banner / Title Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-emerald-700 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider mb-1.5">
              <MapPin className="w-3 h-3" /> Estadio Marista
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Control de Llegadas y Regresos
            </h2>
            <p className="text-blue-100 text-xs mt-0.5 max-w-lg leading-relaxed">
              Registro en tiempo real de Buses y Vans que ingresan al Estadio Marista y posterior confirmación de regreso.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 shrink-0">
            <div className="text-center px-2.5 border-r border-white/20">
              <span className="block text-lg font-black leading-none">{activeVehicles.length}</span>
              <span className="text-[10px] text-blue-100 uppercase tracking-wider font-semibold">En Estadio</span>
            </div>
            <div className="text-center px-2.5">
              <span className="block text-lg font-black leading-none">{trips.filter(t => t.status === 'returned').length}</span>
              <span className="text-[10px] text-blue-100 uppercase tracking-wider font-semibold">Regresaron</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Entry Form + Parking Lot Visual Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Card: Register Arrival */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                Registrar Llegada
              </h3>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                Nuevo Ingreso
              </span>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleArrival} className="space-y-5">
              {/* Vehicle Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                  Tipo de Vehículo
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVehicleType('Bus')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                      vehicleType === 'Bus'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Bus className="w-5 h-5" />
                    Bus
                  </button>

                  <button
                    type="button"
                    onClick={() => setVehicleType('Van')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                      vehicleType === 'Van'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Car className="w-5 h-5" />
                    Van
                  </button>
                </div>
              </div>

              {/* License Plate / Patente */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Patente del Vehículo *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder=""
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={10}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold tracking-wider text-slate-800 uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Driver / Profesor a cargo */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Profesor a Cargo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    placeholder="Nombre del profesor a cargo"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Number of Passengers */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Número de Pasajeros
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    value={passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                    placeholder="Cantidad de pasajeros"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notes / Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Observaciones / Motivo
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Delegación Fútbol 2° Medio"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <CheckCircle2 className="w-5 h-5" />
                Registrar Llegada
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>Servicio Estadio Marista</span>
            <span className="font-medium text-slate-500">Auto-guardado activo</span>
          </div>
        </div>

        {/* Parking Lot Field / Active Vehicles View */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Vehículos Presentes en Estadio Marista
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Haz clic en la imagen de cualquier vehículo para ver detalles o registrar su <strong className="text-amber-600">Regreso</strong>.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {activeVehicles.length} {activeVehicles.length === 1 ? 'Vehículo' : 'Vehículos'}
            </span>
          </div>

          {/* Simulated Park Area */}
          <div className="flex-1 min-h-[320px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            {/* Field Header / Marking */}
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/80 pb-2 mb-4">
              <span>Sector Estacionamiento</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                En Sitio
              </span>
            </div>

            {activeVehicles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3">
                  <Bus className="w-8 h-8" />
                </div>
                <h4 className="text-slate-600 font-bold text-sm">No hay vehículos en el Estadio Marista</h4>
                <p className="text-slate-400 text-xs max-w-xs mt-1">
                  Ingresa la patente a la izquierda y presiona "Llegada" para registrar un bus o van.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 my-auto py-2">
                <AnimatePresence>
                  {activeVehicles.map((vehicle) => (
                    <motion.div
                      key={vehicle.id}
                      initial={{ scale: 0.7, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0, x: 100 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className="group cursor-pointer bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all flex flex-col items-center relative"
                    >
                      {/* Vehicle Drawing */}
                      <div className="py-2 transform group-hover:scale-105 transition-transform">
                        {vehicle.vehicleType === 'Bus' ? (
                          <BusDrawing plate={vehicle.plate} className="w-28 h-20" />
                        ) : (
                          <VanDrawing plate={vehicle.plate} className="w-28 h-20" />
                        )}
                      </div>

                      <div className="mt-4 text-center w-full pt-2 border-t border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Llegó {vehicle.arrivalTime.split(' ')[1] || vehicle.arrivalTime}
                        </span>
                        <div className="text-xs font-semibold text-blue-600 flex items-center justify-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {getTimeElapsed(vehicle.arrivalTimestamp)}
                        </div>
                      </div>

                      {/* Quick Action Overlay on Hover */}
                      <div className="absolute inset-0 bg-blue-900/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow">
                          Ver / Regreso
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Field Footer */}
            <div className="mt-4 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Punto de control Estadio</span>
              <span>Regreso automático al registrar la salida</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail & Regreso Modal */}
      <AnimatePresence>
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative"
            >
              <button
                onClick={() => setSelectedVehicle(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full uppercase tracking-wider mb-2">
                  {selectedVehicle.vehicleType} en Estadio Marista
                </span>

                <div className="my-4 my-2">
                  {selectedVehicle.vehicleType === 'Bus' ? (
                    <BusDrawing plate={selectedVehicle.plate} className="w-36 h-28" />
                  ) : (
                    <VanDrawing plate={selectedVehicle.plate} className="w-36 h-28" />
                  )}
                </div>

                <h3 className="text-2xl font-black text-slate-800 tracking-wider font-mono mt-2">
                  {selectedVehicle.plate}
                </h3>

                <div className="w-full bg-slate-50 rounded-2xl p-4 my-5 space-y-2 text-left text-sm text-slate-600 border border-slate-100">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Hora de Llegada:</span>
                    <span className="font-bold text-slate-800">{selectedVehicle.arrivalTime}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Permanencia:</span>
                    <span className="font-bold text-blue-600">{getTimeElapsed(selectedVehicle.arrivalTimestamp)}</span>
                  </div>

                  {selectedVehicle.driver && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Profesor a Cargo:</span>
                      <span className="font-semibold text-slate-800">{selectedVehicle.driver}</span>
                    </div>
                  )}

                  {selectedVehicle.passengers && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Pasajeros:</span>
                      <span className="font-semibold text-slate-800">{selectedVehicle.passengers} personas</span>
                    </div>
                  )}

                  {selectedVehicle.notes && (
                    <div className="py-1">
                      <span className="text-xs text-slate-400 uppercase font-semibold block mb-0.5">Observaciones:</span>
                      <p className="text-xs italic text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60">
                        "{selectedVehicle.notes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => handleReturn(selectedVehicle.id)}
                    className="flex-1 py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <LogOut className="w-5 h-5" />
                    Registrar Regreso
                  </button>

                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Historial de Viajes Table */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              Historial de Registro de Viajes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro completo de llegadas al Estadio Marista y salidas de regreso al colegio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar patente o profesor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-48 transition-all"
              />
            </div>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">En Estadio Marista</option>
              <option value="returned">Regresaron al Colegio</option>
            </select>

            {/* Live Google Sheets Sync Status Badge */}
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isSyncing ? 'Sincronizando...' : (syncStatus || 'Sincronizado en tiempo real')}</span>
            </div>

            {/* Export CSV */}
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3.5 rounded-l-xl">Valor</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Patente</th>
                <th className="p-3.5">Profesor a Cargo</th>
                <th className="p-3.5">Pasajeros</th>
                <th className="p-3.5">Fecha y Hora Llegada</th>
                <th className="p-3.5">Fecha y Hora Regreso</th>
                <th className="p-3.5 rounded-r-xl">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                    No se encontraron registros de viajes.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-emerald-800">
                      ${(trip.vehicleType === 'Van' ? 137500 : 150000).toLocaleString('es-CL')}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg ${
                        trip.vehicleType === 'Bus' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {trip.vehicleType === 'Bus' ? <Bus className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                        {trip.vehicleType}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {trip.plate}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {trip.driver || '-'}
                    </td>
                    <td className="p-3.5 text-slate-700 font-semibold">
                      {trip.passengers ? `${trip.passengers}` : '-'}
                    </td>
                    <td className="p-3.5">
                      {trip.arrivalTime}
                    </td>
                    <td className="p-3.5">
                      {trip.returnTime ? (
                        <span className="text-slate-700 font-semibold">{trip.returnTime}</span>
                      ) : (
                        <span className="text-slate-400 italic">Pendiente de regreso</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {trip.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          En Estadio Marista
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-slate-500" />
                          Regresó al Colegio
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
