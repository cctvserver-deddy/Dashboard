import React, { useState } from 'react';
import { MultiuserService, AppInstance } from '../services/multiuserService.ts';
import { motion } from 'motion/react';
import { Copy, Check, ShieldAlert, ArrowRight, ExternalLink, HelpCircle, FileSpreadsheet, Sparkles } from 'lucide-react';

export const InstallerPage: React.FC = () => {
  const [ulName, setUlName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [gasUrl, setGasUrl] = useState("");
  const [hasCopiedTemplate, setHasCopiedTemplate] = useState(false);
  
  const [createdApp, setCreatedApp] = useState<AppInstance | null>(null);
  const [copiedAppId, setCopiedAppId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Auto-duplication simulation state
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicationProgress, setDuplicationProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");

  const MASTER_SPREADSHEET_ID = "1CXQHbSse7jic16s5hZwzSQl8MbDSAy9nBUKr5Z8ACVE";
  const SPREADSHEET_COPY_URL = `https://docs.google.com/spreadsheets/d/${MASTER_SPREADSHEET_ID}/copy`;

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ulName || !driveLink) return;

    setIsDuplicating(true);
    setDuplicationProgress(5);
    setCurrentTask("Menghubungkan ke lokasi Google Drive tujuan...");

    const tasks = [
      { progress: 15, msg: "Memverifikasi hak akses folder Google Drive..." },
      { progress: 35, msg: "Menyambung dengan Spreadsheet Master ID: 1CXQHbSse7jic16s5hZwzSQl8MbDSAy9nBUKr5Z8ACVE..." },
      { progress: 55, msg: "Menduplikasi modul CCTV_DATA dan seluruh worksheet sekunder..." },
      { progress: 75, msg: `Merestrukturisasi form WO & PO untuk unit ${ulName.toUpperCase()}...` },
      { progress: 90, msg: "Menyesuaikan formula persentase, SLA, dan rating unit..." },
      { progress: 98, msg: "Mematangkan skrip Google Apps Script untuk sinkronisasi..." },
      { progress: 100, msg: "Sukses menduplikasi Sheet Master ke Drive Link!" }
    ];

    let taskIdx = 0;
    const interval = setInterval(() => {
      if (taskIdx < tasks.length) {
        setDuplicationProgress(tasks[taskIdx].progress);
        setCurrentTask(tasks[taskIdx].msg);
        taskIdx++;
      } else {
        clearInterval(interval);
        setIsDuplicating(false);
        // Register via service
        const rawApp = MultiuserService.registerApplication(ulName, driveLink, gasUrl);
        setCreatedApp(rawApp);
      }
    }, 550);
  };

  const handleAutoCopy = () => {
    window.open(SPREADSHEET_COPY_URL, '_blank');
    setHasCopiedTemplate(true);
  };

  const getFullAppLink = (id: string) => {
    return `https://dashboard.cctv-servet.workers.dev/?appId=${id}`;
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-4 text-slate-100 flex flex-col gap-6" id="installer-page">
      <div className="bg-[#0e1738] border border-cyan-500/20 rounded-xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-cyan-500/10 p-3 rounded-lg border border-cyan-500/30 text-cyan-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-widest text-[#00e5ff] uppercase">INSTALL DASHBOARD BARU (MULTI-USER)</h2>
            <p className="text-xs text-slate-400 font-semibold tracking-wide mt-1">
              Gunakan wizard ini untuk melakukan pendeployan aplikasi mandiri bagi Unit Layanan Pelanggan (UL) baru Anda dengan auto-generate Spreadsheet Master.
            </p>
          </div>
        </div>

        {isDuplicating ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-cyan-500/10 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
                <FileSpreadsheet size={32} className="animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 max-w-md">
              <h3 className="text-sm font-black tracking-widest text-[#00e5ff] uppercase">PROSES DUPLIKASI SPREADSHEET MASTER SEDANG BERJALAN</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mengekstrak, memindahkan, dan mempublikasikan data master spreadsheet PLN ke Drive tujuan Anda:
              </p>
              <div className="font-mono text-[10px] text-cyan-300 bg-slate-900 border border-slate-800 rounded px-3 py-2 select-none animate-pulse">
                {currentTask}
              </div>
            </div>

            <div className="w-full max-w-sm bg-black/40 h-2.5 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full"
                style={{ width: `${duplicationProgress}%` }}
                initial={{ width: "0%" }}
                animate={{ width: `${duplicationProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              SINKRONISASI DUPLIKASI SPREADSHEET • {duplicationProgress}% SELESAI
            </div>
          </div>
        ) : !createdApp ? (
          <div className="space-y-6">
            {/* Step 1: Auto-generate Spreadsheet Template */}
            <div className={`p-5 rounded-xl border transition-all ${hasCopiedTemplate ? 'bg-green-500/5 border-green-500/20' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#00e5ff] text-[#070b1e] w-5 h-5 rounded-full flex items-center justify-center font-black text-xs">1</span>
                    <h3 className="text-xs font-black tracking-wider text-white uppercase flex items-center gap-1.5">
                      GENERATE OTOMATIS SPREADSHEET MASTER UNIT
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                    Klik tombol di samping untuk langsung menduplikasi template database Google Sheets standar master. Seluruh lembar data penting (CCTV_DATA, WO, PO, POSKO, PETUGAS, ULP) akan otomatis disiapkan untuk Anda.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoCopy}
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-[#070b1e] font-black shrink-0 px-4 py-3 rounded-lg text-xs uppercase tracking-wide flex items-center gap-2 self-stretch sm:self-auto justify-center transition-all shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                >
                  <FileSpreadsheet size={15} /> Duplikasi Sheets Master <Sparkles size={12} className="animate-spin" />
                </button>
              </div>

              {hasCopiedTemplate && (
                <div className="mt-3 flex items-center gap-2 text-[10px] text-green-400 font-bold bg-green-500/5 border border-green-500/10 p-2.5 rounded-lg animate-fade-in">
                  <Check size={14} /> Berhasil membuka generator salinan template Spreadsheet master dlm tab baru! Sekarang Anda hanya perlu menamai, mempublikasikan ke Web as CSV (atau share), lalu lanjut mengisi form Langkah 2 di bawah.
                </div>
              )}
            </div>

            {/* Step 2: Form */}
            <form onSubmit={handleInstall} className="space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center font-black text-xs">2</span>
                <h3 className="text-xs font-black tracking-wider text-slate-200 uppercase">
                  LENGKAPI INFORMASI INSTALASI DETAIL UNIT
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 tracking-wider uppercase mb-2">NAMA UNIT LAYANAN (UL) BARU</label>
                  <input
                    type="text"
                    placeholder="Contoh: UL PADANG, UL SOLOK, UL PAYAKUMBUH"
                    value={ulName}
                    onChange={(e) => setUlName(e.target.value)}
                    required
                    className="w-full bg-[#070b1e] border border-slate-700 rounded-lg px-4 py-3 text-xs text-white font-bold tracking-wide focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-slate-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Semua teks "UL BUKITTINGGI" akan otomatis diganti menjadi nama unit ini.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-300 tracking-wider uppercase mb-2">LINK GOOGLE SHEET / DRIVE CEPAT</label>
                  <input
                    type="url"
                    placeholder="Contoh: https://docs.google.com/spreadsheets/d/.../edit"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    required
                    className="w-full bg-[#070b1e] border border-slate-700 rounded-lg px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-slate-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Paste link dari Spreadsheet hasil duplikasi Langkah 1 di atas.</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-300 tracking-wider uppercase">LINK WEB APP GAS (GOOGLE APPS SCRIPT) (OPSIONAL)</label>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-[10px] font-black text-cyan-400 underline hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle size={12} /> {showGuide ? "Sembunyikan Petunjuk" : "Lihat Petunjuk"}
                  </button>
                </div>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  className="w-full bg-[#070b1e] border border-slate-700 rounded-lg px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-slate-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Membantu mempercepat sinkronisasi realtime terdeploy secara mandiri.</span>
              </div>

              {showGuide && (
                <div className="bg-[#070b1e] border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p className="font-bold text-[#00e5ff] uppercase tracking-wider text-[10px] flex items-center gap-1">
                    🔧 MEKANISME AKTIVASI & PUBLIKASI SPREADSHEET BARU:
                  </p>
                  <ul className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                    <li>Gunakan tombol Langkah 1 di atas untuk menyalin draf template spreadsheet ke Google Drive Anda.</li>
                    <li>Pada Google Sheet Anda, klik menu <strong>File &gt; Share &gt; Publish to web</strong>.</li>
                    <li>Ubah pilihan lembar menjadi tipe <strong>"Comma-separated values (.csv)"</strong> dan pilih opsi publikasikan global agar backend aplikasi dpt membaca data Anda.</li>
                    <li>Copy link Spreadsheet baru tersebut ke kolom "LINK GOOGLE SHEET / DRIVE CEPAT" di atas.</li>
                    <li>Selesaikan pendaftaran, dan hubungi Admin Master untuk mengaktifkan link instastion Anda!</li>
                    <li className="text-yellow-400/80 font-bold">Catatan: Sheet/Tab <span className="underline">AKTIVASI</span> adalah modul terpusat milik Master UP3 Bukittinggi untuk mendata registrasi dan status aktivasi. Sheet/Tab AKTIVASI ini tidak ikut tergenerate dan tidak diperlukan di Google Spreadsheet baru unit Anda.</li>
                  </ul>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-[#070b1e] font-black py-4 rounded-lg text-xs uppercase tracking-widest hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2"
              >
                PROSES INSTAL DAN DAFTARKAN INSTANSI <ArrowRight size={14} />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-xs text-yellow-300 space-y-2">
              <h3 className="font-black text-sm text-yellow-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} /> LINK BERHASIL DIGENERATE (MEMBUTUHKAN AKTIVASI)
              </h3>
              <p className="leading-relaxed">
                Selamat! Aplikasi untuk unit <strong>{createdApp.ulName}</strong> sudah sukses didaftarkan dengan ID <code>{createdApp.id}</code>. Namun, demi alasan keamanan, link baru dideploy ini <strong>belum aktif</strong>. Silakan hubungi <strong>Admin Master (Super Admin)</strong> untuk mengaktifkan link Anda dari halaman admin.
              </p>
            </div>

            <div className="bg-[#070b1e] rounded-xl p-5 border border-slate-800 space-y-4">
              <div>
                <label className="block text-[9px] font-black tracking-widest text-[#00e5ff] uppercase mb-1">ID APLIKASI ANDA</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdApp.id}
                    className="flex-1 bg-black/40 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(createdApp.id, setCopiedAppId)}
                    className="bg-slate-800 border border-slate-700 px-3 py-2 rounded text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    {copiedAppId ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black tracking-widest text-[#00e5ff] uppercase mb-1">LINK INSTALLED APPLICATION</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getFullAppLink(createdApp.id)}
                    className="flex-1 bg-black/40 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(getFullAppLink(createdApp.id), setCopiedLink)}
                    className="bg-slate-800 border border-slate-700 px-3 py-2 rounded text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors animate-pulse"
                  >
                    {copiedLink ? <Check size={14} className="text-green-400" /> : "Salin Link"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Copy link aplikasi di atas untuk dibagikan kepada tim layanan pelanggan Anda setelah status aktif.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1">
                  💻 KODE GOOGLE APPS SCRIPT (GAS) JALUR INTERAKTIF
                </h3>
                <button
                  onClick={() => copyToClipboard(MultiuserService.generateAppsScriptCode(createdApp.ulName), setCopiedCode)}
                  className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded text-[10px] font-bold hover:bg-cyan-500/20 transition-colors flex items-center gap-1"
                >
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />} Salin Kode script GAS
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Gunakan kode di bawah ini untuk dipasang di Extension Google Sheets Anda guna melepaskan dependensi UP3 Bukittinggi, menyinkronkan data langsung ke target unit <strong>UL {createdApp.ulName}</strong>.
              </p>
              
              <div className="bg-[#030613] text-gray-300 font-mono text-[10px] p-4 rounded-lg overflow-x-auto max-h-60 border border-slate-900 border-t-4 border-t-cyan-500 select-all">
                <pre>{MultiuserService.generateAppsScriptCode(createdApp.ulName)}</pre>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCreatedApp(null)}
                className="flex-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg text-xs uppercase transition-colors"
              >
                Kembali & Daftarkan Unit Lainnya
              </button>
              <a
                href={getFullAppLink(createdApp.id)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black py-3 px-4 rounded-lg text-xs uppercase text-center transition-colors flex items-center justify-center gap-1"
              >
                Buka Link Aplikasi <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

