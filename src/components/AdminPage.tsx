import React, { useState, useEffect } from 'react';
import { MultiuserService, AppInstance } from '../services/multiuserService.ts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, KeyRound, Upload, CheckCircle, AlertCircle, FileSpreadsheet, Download,
  Trash2, ShieldCheck, RefreshCw, Power, ExternalLink, Columns, ChevronDown, Check, Eye, Cloud
} from 'lucide-react';
import Papa from 'papaparse';

export const AdminPage: React.FC<{ 
  appId?: string;
  initialTab?: 'UPLOAD' | 'AKTIVASI';
  role: 'ADMIN' | 'SADMIN' | null;
  onRoleChange: (role: 'ADMIN' | 'SADMIN' | null) => void;
}> = ({ 
  appId = "master", 
  initialTab = "UPLOAD",
  role,
  onRoleChange
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // App Selection for File Upload
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(appId);
  
  // Sheet states for upload
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, string>>({});
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, { headers: string[], rows: any[][] }>>({});
  const [showPreviewModal, setShowPreviewModal] = useState<string | null>(null);
  const [syncingState, setSyncingState] = useState<Record<string, 'idle' | 'syncing' | 'success' | 'error'>>({});
  const [syncMessage, setSyncMessage] = useState<Record<string, string>>({});
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // New unit manually added form states (Sadmin features)
  const [showAddUnitForm, setShowAddUnitForm] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitSheetId, setNewUnitSheetId] = useState("");
  const [newUnitGasUrl, setNewUnitGasUrl] = useState("");
  const [addUnitError, setAddUnitError] = useState<string | null>(null);
  const [addUnitSuccess, setAddUnitSuccess] = useState<string | null>(null);

  const downloadCsvTemplate = (sheetName: string) => {
    const templates: Record<string, string> = {
      CCTV_DATA: "No,Nama CCTV,Unit,Tipe,Status\n1,CCTV POSKO GADUT,UL BUKITTINGGI,IP CAMERA,ONLINE",
      WO: "No Laporan,Tgl Lapor,Nama Petugas,ULP,Posko,Nama Regu,APKT Status,RPT,RCT,Durasi WO,CCTV,Source,Rating,Check In Petugas,Tgl Penugasan Regu,Tgl Dalam Perjalanan,Tgl Nyala,Check Out Petugas,Shift\nL12345,08/06/2026 08:00:00,AHMAD,ULP BUKITTINGGI,POSKO BUKITTINGGI,BUKITTINGGI,SELESAI,15,30,45,CCTV AKTIF,PLN MOBILE,5,08/06/2026 08:05:00,08/06/2026 08:01:00,08/06/2026 08:10:00,08/06/2026 08:25:00,08/06/2026 08:35:00,PAGI",
      PO: "No Tugas,Tgl,Nama Petugas,ULP,Posko,Nama Regu,CCTV\nT98765,08/06/2026 09:15:00,BUDI,ULP PADANG PANJANG,POSKO PADANG PANJANG,PADANGPANJANG,CCTV AKTIF",
      POSKO: "id,name\np1,POSKO ULP BUKITTINGGI\np2,POSKO ULP PADANG PANJANG",
      PETUGAS: "id,name,ulpId\nk1,13226_AZWARDI,u1\nk2,AHMAD,u1\nk3,BUDI,u2",
      ULP: "id,name,poskoId\nu1,BUKITTINGGI,p1\nu2,PADANG PANJANG,p2"
    };

    const csvContent = templates[sheetName] || "";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TEMPLATE_CSV_${sheetName.toUpperCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    // Load registered apps periodically (4 sec interval) for instant sync of newly registered apps
    const syncApps = async () => {
      const registered = await MultiuserService.fetchRemoteApplications();
      if (role === 'SADMIN' && appId === "master") {
        setApps(registered);
      } else if (appId !== "master") {
        setApps(registered.filter(app => app.id === appId));
        setSelectedAppId(appId);
      } else {
        setApps(registered);
      }
    };

    syncApps();
    const interval = setInterval(syncApps, 4000);
    return () => clearInterval(interval);
  }, [role, appId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "Admind") {
      onRoleChange('ADMIN'); // File Upload role
      setError(null);
    } else if (password === "Sadmin" && appId === "master") {
      onRoleChange('SADMIN'); // Sadmin / Access Activation role
      setError(null);
    } else if (password === "Sadmin") {
      setError("Kata sandi Super Admin hanya dapat digunakan di Aplikasi Master!");
    } else {
      setError("Password salah! Silakan coba lagi.");
    }
  };

  const handleLogout = () => {
    onRoleChange(null);
    setPassword("");
    setUploadSuccess({});
    setSheetPreviews({});
  };

  // Toggle Activation (Sadmin Feature)
  const handleToggleActivation = (id: string, currentStatus: string) => {
    const isNowActive = currentStatus !== "active";
    const success = MultiuserService.activateApplication(id, isNowActive);
    if (success) {
      // Reload apps list
      setApps(MultiuserService.getApplications());
    }
  };

  // Delete App (Sadmin Feature)
  const handleDeleteApp = (id: string) => {
    if (id === "master") return;
    if (window.confirm("Apakah Anda yakin ingin menghapus aplikasi unit ini? Tindakan ini tidak dapat dibatalkan.")) {
      const remaining = apps.filter(app => app.id !== id);
      MultiuserService.saveApplications(remaining);
      setApps(remaining);
    }
  };

  // Update Apps Script URL for active selected unit
  const handleUpdateGasUrl = (newUrl: string) => {
    const list = [...apps];
    const idx = list.findIndex(a => a.id === selectedAppId);
    if (idx !== -1) {
      list[idx].gasWebUrl = newUrl.trim();
      MultiuserService.saveApplications(list);
      setApps(list);
      alert(`Berhasil memperbarui Link Web App GAS untuk unit: UL ${list[idx].ulName}!`);
    } else {
      alert("Gagal memperbarui: Unit tidak ditemukan.");
    }
  };

  // Test current GAS Web App connectivity
  const handleTestGasConnection = async () => {
    const app = apps.find(a => a.id === selectedAppId);
    if (!app || !app.gasWebUrl || app.gasWebUrl.includes("sample")) {
      alert("Silakan masukkan URL Web App GAS yang valid terlebih dahulu.");
      return;
    }

    setTestConnectionStatus("testing");
    try {
      const res = await fetch(app.gasWebUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.status === "connected") {
        alert(`Koneksi Sukses!\n\nUnit: ${data.unit}\nTab yang ada di Google Sheet:\n${data.sheets ? data.sheets.join(", ") : "Tidak ada tab"}`);
        setTestConnectionStatus("success");
      } else if (data && data.error) {
        alert(`Koneksi Gagal: ${data.error}`);
        setTestConnectionStatus("error");
      } else {
        alert("Respon tidak dikenal dari Google Apps Script.");
        setTestConnectionStatus("error");
      }
    } catch (err: any) {
      alert(`Koneksi Gagal!\n\nPastikan:\n1. URL Web App GAS yang Anda masukkan tidak salah.\n2. Anda telah melakukan redeploy Apps Script (New Deployment) dengan akses 'Anyone' (Siapa Saja).\n3. Anda sudah meng-Authorize akses di Apps Script saat melakukan deploy.\n\nDetail Error: ${err.message || err}`);
      setTestConnectionStatus("error");
    }
  };

  // Synchronization helper
  const handleSyncToSheets = async (sheetName: string) => {
    const app = apps.find(a => a.id === selectedAppId);
    if (!app) {
      alert("Aplikasi unit sasaran tidak ditemukan.");
      return;
    }

    const csvOverride = localStorage.getItem(`pln_sheet_override_${selectedAppId}_${sheetName.toUpperCase()}`);
    if (!csvOverride) {
      alert("Tidak ada data unggahan lokal untuk disinkronkan.");
      return;
    }

    if (!app.gasWebUrl || app.gasWebUrl.includes("sample")) {
      alert("Tautan Google Apps Script (Web App GAS) belum dikonfigurasi untuk unit ini. Silakan masukkan tautan GAS Web App Anda di bagian panel unit di kiri terlebih dahulu.");
      return;
    }

    setSyncingState(prev => ({ ...prev, [sheetName]: 'syncing' }));

    try {
      const parsed = Papa.parse(csvOverride, {
        header: false,
        skipEmptyLines: true
      });
      const dataRows = parsed.data as any[][];

      const success = await MultiuserService.pushSheetToRemote(selectedAppId, sheetName, dataRows);
      if (success) {
        setSyncingState(prev => ({ ...prev, [sheetName]: 'success' }));
        setSyncMessage(prev => ({ ...prev, [sheetName]: "Berhasil disinkronkan ke Google Sheet!" }));
        alert(`Berhasil melakukan sinkronisasi tab '${sheetName}' langsung ke Google Sheet Anda!`);
      } else {
        setSyncingState(prev => ({ ...prev, [sheetName]: 'error' }));
        setSyncMessage(prev => ({ ...prev, [sheetName]: "Gagal sinkron remote. Periksa URL GAS Anda." }));
        alert(`Gagal mengirim data ke Google Sheet. Pastikan Anda telah mendeploy Apps Script sebagai Web App milik sendiri dengan hak akses 'Anyone / Siapa Saja'.`);
      }
    } catch (err: any) {
      setSyncingState(prev => ({ ...prev, [sheetName]: 'error' }));
      setSyncMessage(prev => ({ ...prev, [sheetName]: err?.message || "Koneksi Bermasalah" }));
      alert(`Gagal mengirim data: ${err?.message || err}`);
    }
  };

  // Manual Add Unit (Sadmin Feature)
  const handleManualAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUnitError(null);
    setAddUnitSuccess(null);
    if (!newUnitName.trim()) {
      setAddUnitError("Nama Unit Kerja wajib diisi!");
      return;
    }
    if (!newUnitSheetId.trim()) {
      setAddUnitError("Spreadsheet ID / Drive Link wajib diisi!");
      return;
    }

    try {
      const added = await MultiuserService.registerApplication(newUnitName, newUnitSheetId, newUnitGasUrl);
      // Automatically activate the manually added unit since SADMIN added it
      MultiuserService.activateApplication(added.id, true);
      
      setNewUnitName("");
      setNewUnitSheetId("");
      setNewUnitGasUrl("");
      setAddUnitSuccess(`Berhasil mendaftarkan & mengaktifkan unit: UL ${added.ulName} (${added.id})!`);
      // Update local state
      setApps(MultiuserService.getApplications());
    } catch (err: any) {
      setAddUnitError(err?.message || "Gagal menambahkan unit.");
    }
  };

  // CSV Drag and Drop & Upload parsed (Admind Feature)
  const handleFileUpload = (sheetName: string, file: File) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert("Jenis file tidak valid! Sistem hanya mendukung format file CSV (.csv) untuk saat ini.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      if (!csvText) return;

      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const dataRows = results.data as any[][];
            
            // Limit and pad columns based on sheetName
            let finalRows = dataRows.map(row => {
              return Array.isArray(row) ? row.map(cell => cell === null || cell === undefined ? "" : String(cell)) : [];
            });
            
            let targetCols: number | null = null;
            const upperSheet = sheetName.toUpperCase();
            if (upperSheet === "WO") {
              targetCols = 42; // Column AP (A=1 ... AP=42)
            } else if (upperSheet === "PO") {
              targetCols = 23; // Column W (A=1 ... W=23)
            } else if (upperSheet === "CCTV_DATA") {
              targetCols = 6;  // Column F (A=1 ... F=6)
            }

            if (targetCols !== null) {
              finalRows = finalRows.map(row => {
                if (row.length > targetCols!) {
                  return row.slice(0, targetCols!);
                } else {
                  const cleaned = [...row];
                  while (cleaned.length < targetCols!) {
                    cleaned.push("");
                  }
                  return cleaned;
                }
              });
            }

            const sanitizedCsvText = Papa.unparse(finalRows);
            const headers = finalRows[0].map(h => String(h || "").trim());
            const rows = finalRows.slice(1);

            // Save in MultiuserService
            const success = MultiuserService.saveSheetOverride(selectedAppId, sheetName, sanitizedCsvText);
            if (success) {
              setUploadSuccess(prev => ({
                ...prev,
                [sheetName]: `Berhasil mengunggah ${rows.length} baris data.`
              }));
              setSheetPreviews(prev => ({
                ...prev,
                [sheetName]: { headers, rows: rows.slice(0, 5) } // Store first 5 rows as preview
              }));

              // Auto-sync in background to Google Sheet if GAS URL is set
              const currentApp = apps.find(a => a.id === selectedAppId);
              if (currentApp && currentApp.gasWebUrl && !currentApp.gasWebUrl.includes("sample")) {
                setSyncingState(p => ({ ...p, [sheetName]: 'syncing' }));
                MultiuserService.pushSheetToRemote(selectedAppId, sheetName, finalRows)
                  .then(synced => {
                    if (synced) {
                      setSyncingState(p => ({ ...p, [sheetName]: 'success' }));
                      setSyncMessage(p => ({ ...p, [sheetName]: "Sinkronisasi otomatis berhasil masuk ke Google Sheet!" }));
                    } else {
                      setSyncingState(p => ({ ...p, [sheetName]: 'error' }));
                      setSyncMessage(p => ({ ...p, [sheetName]: "Gagal sinkronisasi otomatis. Klik tombol 'Sync ke Sheet'!" }));
                    }
                  })
                  .catch(() => {
                    setSyncingState(p => ({ ...p, [sheetName]: 'error' }));
                    setSyncMessage(p => ({ ...p, [sheetName]: "Gagal menghubungi Apps Script." }));
                  });
              } else {
                setSyncMessage(p => ({ ...p, [sheetName]: "Tersimpan di lokal. Atur Link Web App GAS di kiri untuk sinkronisasi otomatis." }));
              }
            } else {
              alert("Gagal menyimpan data override ke penyimpanan lokal.");
            }
          } else {
            alert("File CSV kosong atau tidak valid.");
          }
        },
        error: (err) => {
          alert("Gagal memparsing file CSV: " + err.message);
        }
      });
    };
    reader.readAsText(file);
  };

  // Reset Overrides (Restore Standard Sheets Integration)
  const handleResetOverride = (sheetName: string) => {
    localStorage.removeItem(`pln_sheet_override_${selectedAppId}_${sheetName.toUpperCase()}`);
    setUploadSuccess(prev => {
      const copy = { ...prev };
      delete copy[sheetName];
      return copy;
    });
    setSheetPreviews(prev => {
      const copy = { ...prev };
      delete copy[sheetName];
      return copy;
    });
  };

  const selectedApp = apps.find(a => a.id === selectedAppId);

  const sheetsList = [
    { name: "CCTV_DATA", label: "CCTV (Sheet CCTV_DATA)", icon: "🎥" },
    { name: "WO", label: "Work Order (Sheet WO)", icon: "📋" },
    { name: "PO", label: "Patrol Order (Sheet PO)", icon: "🎯" },
    { name: "POSKO", label: "Posko ULP (Sheet POSKO)", icon: "🏠" },
    { name: "PETUGAS", label: "Petugas / Officers (Sheet PETUGAS)", icon: "👤" },
    { name: "ULP", label: "Unit Layanan (Sheet ULP)", icon: "🏢" },
  ];

  if (!role) {
    const isAktivasiForm = initialTab === 'AKTIVASI';
    return (
      <div className="max-w-md mx-auto w-full py-16" id="login-admin">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0e1738] border border-cyan-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle logo bg */}
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-cyan-400/[0.03] rounded-full pointer-events-none" />
          
          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <div className="bg-cyan-500/10 p-3.5 rounded-full border border-cyan-500/30 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.1)]">
              <Lock size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-widest text-[#00e5ff] uppercase">
                {isAktivasiForm ? "OTENTIKASI SUPER ADMIN" : "OTENTIKASI KOORDINATOR"}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                {isAktivasiForm ? "Akses Halaman Aktivasi & Persetujuan Unit" : "Akses Halaman Unggah Berkas CSV Portal"}
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[9px] font-black tracking-widest text-slate-300 uppercase mb-2">KATA SANDI HAK AKSES</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#070b1e] border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-cyan-400 transition-colors"
                  required
                />
                <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
              </div>
              <div className="bg-[#060a1f] border border-slate-800 rounded-lg p-3 text-[10px] text-slate-400 mt-3 flex items-start gap-2">
                <ShieldCheck size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                {appId === "master" ? (
                  <span>
                    {isAktivasiForm ? (
                      <>Gunakan sandi <strong className="text-white">Sadmin</strong> untuk masuk ke Halaman Aktivasi & persetujuan unit baru secara global.</>
                    ) : (
                      <>Gunakan sandi <strong className="text-white">Admind</strong> untuk mengunggah file CSV, atau sandi <strong className="text-white">Sadmin</strong> jika Anda adalah Super Admin.</>
                    )}
                  </span>
                ) : (
                  <span>
                    Gunakan sandi <strong>Admind</strong> untuk masuk ke panel admin dan mengunggah override data file spreadsheet untuk unit ini.
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-xs font-semibold text-red-400 flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-[#070b1e] font-black py-3 rounded-lg text-xs uppercase tracking-widest hover:brightness-110 active:brightness-95 transition-all"
            >
              KONFIRMASI SANDI LOG MASUK
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full py-4 text-slate-100 flex flex-col gap-6" id="admin-dashboard-panel">
      {/* Action Header */}
      <div className="bg-[#0e1738] border border-cyan-500/10 rounded-xl p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#00e5ff]/10 p-2 rounded-lg text-[#00e5ff] border border-[#00e5ff]/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[9px] font-black tracking-widest bg-cyan-500/20 text-[#00e5ff] px-2 py-0.5 rounded uppercase">
              {initialTab === 'AKTIVASI' ? "SUPER ADMIN (TAB AKTIVASI)" : (role === 'SADMIN' ? "SUPER ADMIN (HAK UNGGAH CSV)" : "COORDINATOR ADMIN (FILE UPLOAD)")}
            </span>
            <h2 className="text-base font-black uppercase text-white mt-1">
              {initialTab === 'AKTIVASI' ? "HALAMAN AKTIVASI & AKSES APLIKASI MASTER" : "HALAMAN UNGGAH BERKAS CSV PORTAL"}
            </h2>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all flex items-center gap-1"
        >
          <Power size={12} /> Keluar Panel Admin
        </button>
      </div>

      {initialTab === 'UPLOAD' ? (
        // ------------------------- ADMIN FILE UPLOADER -------------------------
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Instructions and Selection */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#0e1738] border border-cyan-500/10 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-black tracking-wider uppercase text-cyan-400">1. PILIH INSTANSI UNIT SASARAN</h3>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Unit Layanan Aktif</label>
                <div className="relative">
                  <select
                    value={selectedAppId}
                    disabled={appId !== "master"}
                    onChange={(e) => {
                      setSelectedAppId(e.target.value);
                      setUploadSuccess({});
                      setSheetPreviews({});
                    }}
                    className={`w-full bg-[#070b1e] border border-slate-700 rounded-lg p-3 text-xs font-bold text-white tracking-wide appearance-none focus:outline-none focus:border-cyan-400 ${
                      appId !== "master" ? "opacity-60 cursor-not-allowed bg-slate-900/50" : ""
                    }`}
                  >
                    {apps.map(app => (
                      <option key={app.id} value={app.id}>
                        {app.id === "master" ? "MASTER (UP3 BUKITTINGGI)" : `UL ${app.ulName} (${app.id})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {selectedApp && (
                <div className="bg-[#070b1e] rounded-lg p-3 border border-slate-800 space-y-2 text-[11px] text-slate-400 font-medium">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 font-bold">
                    <span>Unit Kerja</span>
                    <strong className="text-white">UL {selectedApp.ulName}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 font-bold">
                    <span>Spreadsheet ID</span>
                    <span className="font-mono text-cyan-400 shrink-0 text-[10px] bg-cyan-950/40 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                      {selectedApp.spreadsheetId}
                    </span>
                  </div>
                  <div className="border-b border-slate-900 pb-1.5 space-y-1 font-bold">
                    <div className="flex justify-between">
                      <span>Web App GAS URL</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                        selectedApp.gasWebUrl && !selectedApp.gasWebUrl.includes("sample") 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {selectedApp.gasWebUrl && !selectedApp.gasWebUrl.includes("sample") ? "Terkonek" : "Belum Set"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="text"
                        placeholder="Paste link Web App GAS..."
                        defaultValue={selectedApp.gasWebUrl && !selectedApp.gasWebUrl.includes("sample") ? selectedApp.gasWebUrl : ""}
                        id="selected-app-gas-input"
                        className="flex-1 bg-black/40 border border-slate-800 rounded px-2 py-1 text-[10px] text-white font-mono placeholder-slate-700 focus:outline-none focus:border-cyan-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (document.getElementById("selected-app-gas-input") as HTMLInputElement)?.value || "";
                            handleUpdateGasUrl(val);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById("selected-app-gas-input") as HTMLInputElement)?.value || "";
                          handleUpdateGasUrl(val);
                        }}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black px-2 py-1 rounded text-[9px] uppercase tracking-widest transition-colors shrink-0"
                      >
                        Simpan
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestGasConnection}
                      disabled={testConnectionStatus === 'testing'}
                      className={`w-full mt-1.5 px-2 bg-slate-800 hover:bg-slate-700 py-1 border border-slate-700 rounded text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shrink-0 ${
                        testConnectionStatus === 'testing'
                          ? 'border-amber-500/30 text-amber-500 bg-amber-500/5 animate-pulse'
                          : testConnectionStatus === 'success'
                          ? 'border-green-500/30 text-green-400 bg-green-500/5 hover:bg-green-500/10'
                          : testConnectionStatus === 'error'
                          ? 'border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10'
                          : 'text-slate-300'
                      }`}
                    >
                      {testConnectionStatus === 'testing' ? 'Menguji Koneksi...' : '🔌 Cek Koneksi ke Google Sheet'}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span>Link Hubungan</span>
                    <a 
                      href={`https://docs.google.com/spreadsheets/d/${selectedApp.spreadsheetId}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      Buka Sheet <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0e1738] border border-cyan-500/10 rounded-xl p-5 text-xs text-slate-400 space-y-3 leading-relaxed font-semibold">
              <h3 className="text-xs font-black tracking-wider uppercase text-cyan-400">CARA KERJA UNGGAH OVERRIDE:</h3>
              <p className="font-medium">
                Fitur ini membantu Anda melatih, mencoba, atau mengoverride data spreadsheet utama Anda secara langsung dan instan via browser (Offline-first / Cache Storage).
              </p>
              <p className="font-medium">
                File CSV yang diunggah akan menggantikan data spreadsheet target untuk sementara. File Anda tetap aman karena terenkripsi secara aman di lokal penyimpanan browser Anda.
              </p>
              <div className="mt-2 text-yellow-400 font-semibold p-2 bg-yellow-400/5 border border-yellow-400/10 rounded text-[10px]">
                NB: Pastikan pemisah data menggunakan tanda koma ( , ) dan baris pertama berisi nama-nama kolom header seperti standar template.
              </div>
            </div>

            {/* CSV Template Download Panel */}
            <div className="bg-[#0e1738] border border-cyan-500/15 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black tracking-wider uppercase text-[#00e5ff] flex items-center gap-1.5">
                <FileSpreadsheet size={15} /> UNDUH TEMPLATE CSV PORTAL
              </h3>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Silakan unduh contoh file CSV siap pakai yang sesuai dengan format dan nama kolom standar sistem:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {sheetsList.map(sheet => (
                  <button
                    key={sheet.name}
                    onClick={() => downloadCsvTemplate(sheet.name)}
                    className="bg-[#070b1e] border border-slate-800 hover:border-cyan-400/50 p-2.5 rounded-lg text-left transition-all flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">{sheet.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-slate-200 group-hover:text-cyan-400 truncate">{sheet.name}</div>
                      <div className="text-[8px] text-slate-500 font-mono tracking-wider">Unduh Template</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Files List Uploaders */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-[#0e1738] border border-cyan-500/10 rounded-xl p-5">
              <h3 className="text-xs font-black tracking-widest text-[#00e5ff] uppercase mb-4">2. UNGGAHAN FILE GOOGLE SHEET SESUAI DIKOLOM</h3>
              
              <div className="space-y-4">
                {sheetsList.map((sheet) => {
                  // Check if this sheet is already overridden
                  const isOverridden = !!localStorage.getItem(`pln_sheet_override_${selectedAppId}_${sheet.name.toUpperCase()}`);
                  
                  return (
                    <div 
                      key={sheet.name} 
                      className={`p-4 rounded-xl border transition-all ${
                        isOverridden 
                          ? "bg-green-500/5 border-green-500/20" 
                          : "bg-[#070b1e] border-slate-850"
                      } flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-1 sm:mt-0">{sheet.icon}</span>
                        <div>
                          <h4 className="text-xs font-black text-slate-200 tracking-wide uppercase">{sheet.label}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {isOverridden 
                              ? `🟢 Overridden - Menggunakan data unggahan lokal (${uploadSuccess[sheet.name] || 'Aktif'})` 
                              : "🔗 Standard - Membaca langsung dari Google Sheet utama."
                            }
                          </p>
                          {isOverridden && syncMessage[sheet.name] && (
                            <p className={`text-[10px] font-bold mt-1 flex items-center gap-1 leading-snug ${
                              syncingState[sheet.name] === 'success' 
                                ? 'text-emerald-400' 
                                : syncingState[sheet.name] === 'error'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}>
                              <span className="opacity-90">Status G-Sheet:</span> {syncMessage[sheet.name]}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto">
                        {isOverridden && (
                          <button
                            onClick={() => handleSyncToSheets(sheet.name)}
                            disabled={syncingState[sheet.name] === 'syncing'}
                            className={`p-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                              syncingState[sheet.name] === 'syncing'
                                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500 cursor-not-allowed animate-pulse'
                                : syncingState[sheet.name] === 'success'
                                ? 'bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black'
                            }`}
                            title="Simpan & Sinkronisasikan Data ini Langsung ke Google Sheet"
                          >
                            {syncingState[sheet.name] === 'syncing' ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" /> Syncing...
                              </>
                            ) : (
                              <>
                                <Cloud size={14} /> Sync ke Sheet
                              </>
                            )}
                          </button>
                        )}

                        {isOverridden && (
                          <button
                            onClick={() => {
                              // Generate preview if not loaded
                              const override = MultiuserService.getSheetOverride(selectedAppId, sheet.name);
                              if (override) {
                                setSheetPreviews(prev => ({
                                  ...prev,
                                  [sheet.name]: { headers: override[0] || [], rows: override.slice(1, 6) }
                                }));
                              }
                              setShowPreviewModal(sheet.name);
                            }}
                            className="bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0"
                            title="Pratinjau Data"
                          >
                            <Eye size={14} /> Preview
                          </button>
                        )}
                        
                        <button
                          onClick={() => downloadCsvTemplate(sheet.name)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0 border border-slate-800"
                          title="Unduh Contoh Template CSV"
                        >
                          <Download size={14} /> Template
                        </button>

                        <label className="flex-1 sm:flex-none cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase text-center transition-all flex items-center justify-center gap-1 shrink-0">
                          <Upload size={12} /> Pilih file CSV
                          <input
                             type="file"
                             accept=".csv"
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) handleFileUpload(sheet.name, file);
                             }}
                             className="hidden"
                          />
                        </label>

                        {isOverridden && (
                          <button
                            onClick={() => handleResetOverride(sheet.name)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg border border-red-500/20 hover:border-red-500/40 shrink-0"
                            title="Hapus Override (Kembali ke Sheets)"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (initialTab === 'AKTIVASI' && role === 'SADMIN' && appId === 'master') ? (
        // ------------------------- SUPER ADMIN (SADMIN) TRASH MANAGEMENT & LINKS -------------------------
        <div className="bg-[#0e1738] border border-cyan-500/10 rounded-xl p-5 overflow-x-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-black tracking-widest text-[#00e5ff] uppercase flex items-center gap-1.5">
              📋 DAFTAR AKTIVASI APLIKASI MULTI-USER ({apps.length - 1} Unit)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Master Bukittinggi selalu diaktifkan secara global</span>
              <button
                onClick={() => {
                  setApps(MultiuserService.getApplications());
                }}
                className="px-2.5 py-1.5 bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors border border-cyan-500/20 flex items-center gap-1 cursor-pointer"
                title="Segarkan data aktivasi instansi baru"
              >
                <RefreshCw size={11} /> Segarkan Data
              </button>
              <button
                onClick={() => {
                  setShowAddUnitForm(!showAddUnitForm);
                  setAddUnitError(null);
                  setAddUnitSuccess(null);
                }}
                className="px-2.5 py-1.5 bg-cyan-400 hover:bg-cyan-500 text-slate-950 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              >
                {showAddUnitForm ? "✖ Tutup Formulir" : "➕ Tambah Unit Manual"}
              </button>
            </div>
          </div>

          {showAddUnitForm && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              onSubmit={handleManualAddUnit}
              className="bg-black/40 border border-slate-800 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <div className="flex flex-col gap-1 md:col-span-3">
                <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">
                  Pendaftaran Unit Kerja Baru secara Manual
                </h4>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Nama Unit Kerja Baru</label>
                <input 
                  type="text" 
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Contoh: UL SOLOK"
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Google Sheet ID atau Link</label>
                <input 
                  type="text" 
                  value={newUnitSheetId}
                  onChange={(e) => setNewUnitSheetId(e.target.value)}
                  placeholder="ID atau Link Google Spreadsheet"
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Link Web App GAS (Opsional)</label>
                <input 
                  type="text" 
                  value={newUnitGasUrl}
                  onChange={(e) => setNewUnitGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="md:col-span-3 flex items-center justify-between gap-2 mt-1">
                <div className="text-[10px] text-red-400 font-semibold">
                  {addUnitError && <span>⚠ {addUnitError}</span>}
                  {addUnitSuccess && <span className="text-green-400">✔ {addUnitSuccess}</span>}
                </div>
                <button 
                  type="submit" 
                  className="bg-cyan-400 hover:bg-cyan-500 text-slate-950 text-[9px] font-black px-4 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer"
                >
                  SIMPAN & AKTIFKAN UNIT
                </button>
              </div>
            </motion.form>
          )}

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold tracking-wider text-[10px] uppercase bg-black/35">
                <th className="p-3.5">ID / Unit Kerja</th>
                <th className="p-3.5">Spreadsheet ID</th>
                <th className="p-3.5">Web Apps GAS Link</th>
                <th className="p-3.5">Status Aktivasi</th>
                <th className="p-3.5 text-center">Tindakan Kontrol</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-b border-slate-900 hover:bg-white/[0.01] transition-all">
                  <td className="p-3.5 font-bold">
                    <div className="flex flex-col">
                      <span className="text-white">UL {app.ulName}</span>
                      <span className="text-[9px] font-mono text-slate-500 tracking-wider">
                        {app.id === "master" ? "🛡️ MASTER DEFAULT" : `id: ${app.id}`}
                      </span>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-[10px]">
                    <span className="text-slate-400 block truncate max-w-[150px]" title={app.spreadsheetId}>
                      {app.spreadsheetId}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-[10px] text-slate-400">
                    {app.gasWebUrl ? (
                      <span className="block truncate max-w-[150px]" title={app.gasWebUrl}>{app.gasWebUrl}</span>
                    ) : (
                      <span className="text-slate-600 block italic">Tidak terkonfigurasi</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {app.id === "master" ? (
                      <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 font-black text-[9px] uppercase tracking-wider inline-flex items-center gap-1 border border-green-500/20">
                        <Check size={10} /> SELALU AKTIF
                      </span>
                    ) : app.status === "active" ? (
                      <span className="px-2 py-1 rounded bg-green-500/20 text-[#00e5ff] font-black text-[9px] uppercase tracking-wider inline-flex items-center gap-1 border border-cyan-500/20 animate-pulse">
                        <Check size={10} /> AKTIF & JALAN
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-black text-[9px] uppercase tracking-wider inline-flex items-center gap-1 border border-red-500/20">
                        🔒 DIKUNCI / TERTUNDA
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center justify-center gap-2">
                      {app.id !== "master" && (
                        <>
                          <button
                            onClick={() => handleToggleActivation(app.id, app.status)}
                            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider border transition-all ${
                              app.status === "active"
                                ? "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20"
                                : "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20"
                            }`}
                          >
                            {app.status === "active" ? "Non-Aktifkan" : "Aktifkan"}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteApp(app.id)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 border border-transparent hover:border-red-500/20 transition-all"
                            title="Hapus Link Aktivasi"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      
                      <a
                        href={`${window.location.origin}/?appId=${app.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition-colors border border-slate-700"
                        title="Buka Link Aplikasi"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        initialTab === 'AKTIVASI' && appId === 'master' && role !== 'SADMIN' ? (
          <div className="max-w-md mx-auto w-full py-8">
            <div className="bg-[#0e1738] border border-yellow-500/20 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full filter blur-2xl pointer-events-none" />
              <div className="bg-yellow-500/10 p-3 rounded-full border border-yellow-500/30 text-yellow-400 inline-flex items-center justify-center">
                <Lock size={24} />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">SANDI SUPER ADMIN DIBUTUHKAN</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Anda masuk sebagai Coordinator Admin. Untuk membuka halaman aktivasi global & mengaktifkan unit baru, silakan masukkan kata sandi Super Admin (<strong className="text-[#00e5ff]">Sadmin</strong>):
              </p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const upgradePassword = (e.target as any).upgrade_password.value;
                if (upgradePassword === "Sadmin") {
                  onRoleChange('SADMIN');
                  setError(null);
                  (e.target as any).upgrade_password.value = "";
                } else {
                  setError("Kata sandi Super Admin salah!");
                }
              }} className="space-y-3 text-left">
                <div className="relative">
                  <input
                    name="upgrade_password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-[#070b1e] border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white text-center font-mono tracking-widest focus:outline-none focus:border-cyan-400"
                    required
                  />
                  <KeyRound size={14} className="absolute left-3 top-3 text-slate-500" />
                </div>
                {error && <div className="text-xs text-red-400 font-semibold text-center">⚠ {error}</div>}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-[#070b1e] font-black py-2.5 rounded-lg text-xs uppercase tracking-widest hover:brightness-110 active:brightness-95 transition-all"
                >
                  UPGRADE AKSES AKTIVASI
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-[#0e1738] border border-red-500/20 rounded-xl p-8 text-center space-y-3">
            <AlertCircle size={32} className="text-red-400 mx-auto" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Akses Terbatas</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Halaman pengaturan aktivasi dan registrasi ini hanya dapat diakses melalui Aplikasi Master. Silakan gunakan password Coordinator Admin untuk fitur penimpaan file lokal unit ini.
            </p>
          </div>
        )
      )}

      {/* Preview Modal for Uploaded Sheets */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e1738] border border-cyan-500/25 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 px-6 border-b border-slate-800 bg-cyan-950/20 flex items-center justify-between">
                <h3 className="font-black text-slate-200 tracking-wider uppercase text-xs">
                  Pratinjau Data Unggahan - Sheet: {showPreviewModal} (5 Baris Pertama)
                </h3>
                <button 
                  onClick={() => setShowPreviewModal(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  ✖
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 scrollbar-thin">
                {sheetPreviews[showPreviewModal] ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-black/40 border-b border-slate-800">
                        {sheetPreviews[showPreviewModal].headers.map((h, i) => (
                          <th key={i} className="p-2.5 font-black text-[#00e5ff] tracking-wide bg-[#070b1e]/60">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetPreviews[showPreviewModal].rows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-850 hover:bg-white/[0.01]">
                          {sheetPreviews[showPreviewModal].headers.map((_, colIdx) => (
                            <td key={colIdx} className="p-2.5 text-slate-300 font-mono text-[11px] truncate max-w-[170px]" title={row[colIdx]}>
                              {String(row[colIdx] !== undefined ? row[colIdx] : '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-slate-500 italic py-8">Gagal memuat pratinjau data.</p>
                )}
              </div>

              <div className="bg-slate-900 border-t border-slate-800 p-3 px-6 text-right">
                <button 
                  onClick={() => setShowPreviewModal(null)}
                  className="bg-cyan-500 px-5 py-2 font-black text-[#070b1e] rounded-lg text-[10px] tracking-wider uppercase hover:bg-cyan-400 transition-all"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
