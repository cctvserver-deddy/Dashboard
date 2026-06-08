import React, { useEffect, useState } from 'react';
import { Header } from './components/Header.tsx';
import { SubHeader } from './components/SubHeader.tsx';
import { WOUP3Card } from './components/WOUP3Card.tsx';
import { ULPStatsCard } from './components/ULPStatsCard.tsx';
import { POUP3Card } from './components/POUP3Card.tsx';
import { ULPPOStatsCard } from './components/ULPPOStatsCard.tsx';
import { PerformanceTable } from './components/PerformanceTable.tsx';
import { ULPPerformanceTable } from './components/ULPPerformanceTable.tsx';
import { DetailModal } from './components/DetailModal.tsx';
import { OverSLAPage } from './components/OverSLAPage.tsx';
import { RatingPage } from './components/RatingPage.tsx';
import { GoogleSheetsService } from './services/googleSheetsService.ts';
import { DashboardData } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Lock } from 'lucide-react';
import { MultiuserService, AppInstance } from './services/multiuserService.ts';
import { InstallerPage } from './components/InstallerPage.tsx';
import { AdminPage } from './components/AdminPage.tsx';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUlp, setSelectedUlp] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<'CCTV' | 'OVER_SLA' | 'RATING'>('CCTV');

  // Multi-user & custom branding views state
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'INSTALLER' | 'ADMIN'>(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : "");
    const mode = params.get("mode")?.toLowerCase();
    if (mode === "install" || mode === "installer" || params.get("install") === "true") {
      return 'INSTALLER';
    }
    return 'DASHBOARD';
  });
  const [appId, setAppId] = useState<string>("master");
  const [activeApp, setActiveApp] = useState<AppInstance | null>(null);
  const [isAppPending, setIsAppPending] = useState<boolean>(false);

  // Check if this is a dedicated installer link to disable general navigation
  const isIsolatedInstaller = React.useMemo(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : "");
    const mode = params.get("mode")?.toLowerCase();
    return mode === "install" || mode === "installer" || params.get("install") === "true";
  }, []);

  // Monitor appId and activation status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("appId") || "master";
    setAppId(id);

    if (id !== "master") {
      const app = MultiuserService.getApplication(id);
      if (!app) {
        setIsAppPending(true);
        setActiveApp(null);
      } else if (app.status !== "active") {
        setIsAppPending(true);
        setActiveApp(app);
      } else {
        setIsAppPending(false);
        setActiveApp(app);
      }
    } else {
      setIsAppPending(false);
      setActiveApp(null);
    }
  }, [viewMode]); // Re-run whenever view mode switches or page mounts to capture activation state changes

  const ulName = activeApp ? activeApp.ulName : "BUKITTINGGI";
  
  // Clear filter when changing tabs since the filter source (ULP vs Posko) changes
  useEffect(() => {
    setSelectedUlp("");
  }, [activeTab]);

  const formatDateForQuery = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Set default date range to current month on initial load
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(formatDateForQuery(firstDay));
    setEndDate(formatDateForQuery(now));
  }, []);

  // Memoized filter logic
  const filteredData = React.useMemo(() => {
    if (!data) return null;
    
    return {
      ...data,
      ulpPerformance: (selectedUlp 
        ? data.ulpPerformance.filter(u => u.ulp === selectedUlp)
        : data.ulpPerformance
      ).sort((a, b) => {
        const avgA = (parseFloat(a.persenWo) || 0) + (parseFloat(a.persenPo) || 0);
        const avgB = (parseFloat(b.persenWo) || 0) + (parseFloat(b.persenPo) || 0);
        return avgB - avgA;
      }),
      officerPerformance: (selectedUlp
        ? data.officerPerformance.filter(o => o.ulp === selectedUlp)
        : data.officerPerformance
      ).sort((a, b) => {
        const avgA = (parseFloat(a.persenWo) || 0) + (parseFloat(a.persenPo) || 0);
        const avgB = (parseFloat(b.persenWo) || 0) + (parseFloat(b.persenPo) || 0);
        return avgB - avgA;
      }),
      summary: data.summary,
      rating: {
        ...data.rating,
        officerRatings: selectedUlp
          ? data.rating.officerRatings.filter(o => o.ulp === selectedUlp)
          : data.rating.officerRatings
      }
    };
  }, [data, selectedUlp]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalHeaders, setModalHeaders] = useState<string[]>([]);
  const [modalRows, setModalRows] = useState<any[][]>([]);

  // Filter logic options
  const filterList = React.useMemo(() => {
    if (!data) return [];
    // Both CCTV and OVER_SLA now use UNIT (ULP) filter as requested
    return data.allUlps || [];
  }, [data]);

  const handleDetailClick = (type: 'WO' | 'PO', identifier: string, isUlp: boolean, isCctv: boolean) => {
    if (!data) return;

    const headers = type === 'WO' ? data.woHeaders : data.poHeaders;
    const rawRows = type === 'WO' ? data.rawWoRows : data.rawPoRows;
    const indices = type === 'WO' ? data.woIndices : data.poIndices;

    // Build officer to ULP map for fallback
    const officerToUlpMap = new Map<string, string>();
    data.officerPerformance.forEach(op => {
      officerToUlpMap.set(op.name.toLowerCase().trim(), op.ulp.toUpperCase().trim());
    });

    let filteredRows = rawRows;

    // 1. Filter by CCTV if requested
    if (isCctv) {
      filteredRows = filteredRows.filter(row => {
        const cctvVal = String(row[indices.cctv] || '').toUpperCase();
        return cctvVal.includes('CCTV');
      });
    }

    // 2. Filter by ULP or Officer
    if (identifier === "UP3" || identifier === "ALL") {
      setModalTitle(MultiuserService.replaceBrandingText(`DETAIL DATA ${type}${isCctv ? ' (CCTV)' : ''} - UP3 BUKITTINGGI`, ulName));
    } else if (isUlp) {
      const targetUlp = identifier.toUpperCase().trim();
      filteredRows = filteredRows.filter(row => {
        let rowUlp = "";
        if (indices.ulp !== -1 && row[indices.ulp]) {
          rowUlp = String(row[indices.ulp]).toUpperCase().replace(/^POSKO ULP\s+/i, '').trim();
        } else {
          // Fallback to officer mapping
          const rowName = String(row[indices.name] || '').toLowerCase().trim();
          rowUlp = officerToUlpMap.get(rowName) || "";
        }
        return rowUlp === targetUlp;
      });
      setModalTitle(`DETAIL DATA ${type}${isCctv ? ' (CCTV)' : ''} - ULP: ${identifier}`);
    } else {
      const targetName = identifier.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => {
        const rowName = String(row[indices.name] || '').toLowerCase().trim();
        return rowName === targetName;
      });
      setModalTitle(`DETAIL DATA ${type}${isCctv ? ' (CCTV)' : ''} - PETUGAS: ${identifier}`);
    }

    setModalHeaders(headers);
    setModalRows(filteredRows);
    setModalOpen(true);
  };

  const handleOverSLADetailClick = (criteria: string, value?: string) => {
    if (!data) return;

    const headers = data.woHeaders;
    const rawRows = data.rawWoRows;
    const indices = data.woIndices;

    let filteredRows = rawRows;
    let title = "DETAIL DATA OVER SLA";

    const getRptValue = (row: any[]) => {
      if (indices.rpt !== -1 && row[indices.rpt]) {
        return parseFloat(String(row[indices.rpt]).replace(",", "."));
      }
      return -1;
    };

    const getRctValue = (row: any[]) => {
      if (indices.rct !== -1 && row[indices.rct]) {
        return parseFloat(String(row[indices.rct]).replace(",", "."));
      }
      return -1;
    };

    switch (criteria) {
      case 'ALL':
        title = "DETAIL SELURUH DATA GANGGUAN";
        break;
      case 'RPT_OVER_30':
        filteredRows = rawRows.filter(row => getRptValue(row) >= 30);
        title = "DETAIL WO RPT > 30 MENIT";
        break;
      case 'RPT_OVER_45':
        filteredRows = rawRows.filter(row => getRptValue(row) >= 45);
        title = "DETAIL WO RPT > 45 MENIT";
        break;
      case 'HIGHEST_RPT':
        const maxRpt = Math.max(...rawRows.map(row => getRptValue(row)));
        filteredRows = rawRows.filter(row => getRptValue(row) === maxRpt);
        title = "DETAIL DURASI RPT TERTINGGI";
        break;
      case 'HIGHEST_RCT':
        const maxRct = Math.max(...rawRows.map(row => getRctValue(row)));
        filteredRows = rawRows.filter(row => getRctValue(row) === maxRct);
        title = "DETAIL DURASI RCT TERTINGGI";
        break;
      case 'AVG_RPT':
        filteredRows = rawRows.filter(row => getRptValue(row) >= 0);
        title = "DETAIL DATA RATA-RATA RPT";
        break;
      case 'AVG_RCT':
        filteredRows = rawRows.filter(row => getRctValue(row) >= 0);
        title = "DETAIL DATA RATA-RATA RCT";
        break;
      case 'ULP':
        if (value) {
          const targetUlp = value.toUpperCase().trim();
          filteredRows = rawRows.filter(row => {
            let rowUlp = "";
            if (indices.ulp !== -1 && row[indices.ulp]) {
              rowUlp = String(row[indices.ulp]).toUpperCase().replace(/^POSKO ULP\s+/i, '').replace(/^ULP\s+/i, '').trim();
            }
            return rowUlp === targetUlp || String(row[indices.name] || '').toUpperCase().includes(targetUlp);
          });
          title = `DETAIL DATA WO - ULP: ${value}`;
        }
        break;
    }

    setModalHeaders(headers);
    setModalRows(filteredRows);
    setModalOpen(true);
  };

  useEffect(() => {
    const loadData = async (showLoading = false) => {
      // If we already have data and are just changing ULP, we don't need a full-page loader
      // the new caching logic in GoogleSheetsService handles this instantly
      const needsFullLoader = !data || (showLoading && !isRefreshing);
      
      if (needsFullLoader) setIsRefreshing(true);
      
      try {
        const result = await GoogleSheetsService.fetchData(startDate, endDate, selectedUlp);
        const hasData = result.officerPerformance.length > 0 || result.summary.dataAktif > 0;
        if (!hasData) {
          setError("Tidak ada data yang ditemukan untuk rentang tanggal ini.");
        } else {
          setError(null);
        }
        setData(result);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Gagal menghubungkan ke Google Sheets.");
      } finally {
        setIsRefreshing(false);
      }
    };

    loadData(!data);
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [startDate, endDate, selectedUlp]);

  const isLoadingData = !data && viewMode === 'DASHBOARD' && !isAppPending;

  if (error && !data && viewMode === 'DASHBOARD' && !isAppPending) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a1128] text-white p-6 gap-6">
        <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-lg max-w-2xl w-full text-center">
          <h2 className="text-2xl font-black text-red-500 tracking-widest uppercase mb-4">KESALAHAN SINKRONISASI</h2>
          <p className="text-white/80 font-bold mb-6">{error}</p>
          <div className="text-left bg-black/40 p-4 rounded text-xs font-mono text-brand-accent/80 space-y-2">
            <p className="font-bold text-white mb-1 underline">LANGKAH PERBAIKAN:</p>
            <p>1. Buka Google Sheet Anda.</p>
            <p>2. Klik menu <span className="text-white">File &gt; Share &gt; Publish to web</span>.</p>
            <p>3. Pilih <span className="text-white">"Entire Document"</span> dan <span className="text-white">"Comma-separated values (.csv)"</span>.</p>
            <p>4. Klik <span className="text-white">Publish</span>.</p>
            <p>5. Refresh halaman ini.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 bg-brand-accent text-[#0a1128] px-8 py-3 font-black tracking-widest uppercase hover:bg-white transition-colors"
          >
            COBA LAGI SEKARANG
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a1128] text-white">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
          <h2 className="text-xl font-black tracking-widest uppercase">MEMUAT DATA...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#070b1e]">
      {isRefreshing && (
        <div className="fixed top-0 left-0 w-full h-1 z-[100]">
          <motion.div 
            initial={{ x: "-100%" }} 
            animate={{ x: "100%" }} 
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="h-full bg-brand-accent w-full"
          />
        </div>
      )}

      <Header 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ulName={ulName}
        isIsolatedInstaller={isIsolatedInstaller}
      />

      {viewMode === 'DASHBOARD' && !isAppPending && data && (
        <SubHeader 
          lastSync={data.summary.lastSync} 
          dataAktif={data.summary.dataAktif} 
          selectedUlp={selectedUlp}
          onUlpChange={setSelectedUlp}
          ulpList={filterList}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          activeTab={activeTab}
          ulName={ulName}
        />
      )}
      
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode === 'DASHBOARD' ? (startDate + endDate + selectedUlp + activeTab + isAppPending) : viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={isRefreshing ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}
          >
            {viewMode === 'INSTALLER' ? (
              <InstallerPage />
            ) : viewMode === 'ADMIN' ? (
              <AdminPage />
            ) : isAppPending ? (
              /* Blockout pending screen */
              <div className="max-w-2xl mx-auto w-full py-12 px-2 text-center" id="app-pending-blocker">
                <div className="bg-[#0e1738] border border-red-500/25 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-44 h-44 bg-red-500/5 rounded-full filter blur-3xl pointer-events-none" />
                  
                  <div className="bg-red-500/10 p-5 rounded-full border border-red-500/30 text-red-400 inline-flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <Lock size={36} className="animate-pulse" />
                  </div>
                  
                  <h2 className="text-lg font-black text-red-400 tracking-widest uppercase mb-2">LINK APLIKASI BELUM DIAKTIFKAN</h2>
                  <p className="text-xs font-bold text-slate-300 leading-relaxed mb-6">
                    Aplikasi untuk unit <span className="text-[#00e5ff] font-black uppercase">UL {ulName}</span> dengan ID <code>{appId}</code> telah berhasil didaftarkan di sistem multiuser, namun statusnya masih tertunda.
                  </p>
                  
                  <div className="text-left bg-[#070b1e] border border-slate-800 p-4 rounded-xl text-xs font-medium text-slate-400 space-y-2 mb-6">
                    <p className="font-extrabold text-[#00e5ff] tracking-wide uppercase text-[10px] mb-1 underline">INFORMASI & TINDAKAN:</p>
                    <p>1. Berikan ID Aplikasi berikut pada Admin Master: <strong className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded select-all">{appId}</strong></p>
                    <p>2. Klik tombol di bawah untuk membuka panel aktivasi AKSES (Gunakan kata sandi <strong>Sadmin</strong>) jika Anda adalah pengelola utama sistem.</p>
                  </div>

                  <button 
                    onClick={() => setViewMode('ADMIN')}
                    className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-[#070b1e] font-black py-3 rounded-lg text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    BUKA PANEL AKTIVASI (SUPER ADMIN)
                  </button>
                </div>
              </div>
            ) : data ? (
              // Normal Dashboard View mode
              activeTab === 'CCTV' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]" id="dashboard-cctv">
                  {/* Left Column - WO UP3 & ULP Cards */}
                  <div className="lg:col-span-3 flex flex-col">
                    <WOUP3Card 
                      totalWo={filteredData?.summary.totalBaca || 0} 
                      totalWoCctv={filteredData?.summary.totalValid || 0} 
                      onDetailClick={(isCctv) => handleDetailClick('WO', 'UP3', true, isCctv)}
                      ulName={ulName}
                    />
                    <ULPStatsCard 
                      ulpData={filteredData?.ulpPerformance || []} 
                      onDetailClick={(ulp, isCctv) => handleDetailClick('WO', ulp, true, isCctv)}
                      ulName={ulName}
                    />
                  </div>

                  {/* Center Column - Performance Tables */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    <PerformanceTable 
                      data={filteredData?.officerPerformance || []} 
                      onDetailClick={(type, name, isCctv) => handleDetailClick(type, name, false, isCctv)}
                      ulName={ulName}
                    />
                    <ULPPerformanceTable 
                      data={filteredData?.ulpPerformance || []} 
                      onDetailClick={(type, ulp, isCctv) => handleDetailClick(type, ulp, true, isCctv)}
                      ulName={ulName}
                    />
                  </div>

                  {/* Right Column - PO UP3 & ULP Cards */}
                  <div className="lg:col-span-3 flex flex-col">
                    <POUP3Card 
                      totalPo={filteredData?.summary.totalPo || 0} 
                      totalPoCctv={filteredData?.summary.totalPoCctv || 0} 
                      onDetailClick={(isCctv) => handleDetailClick('PO', 'UP3', true, isCctv)}
                      ulName={ulName}
                    />
                    <ULPPOStatsCard 
                      ulpData={filteredData?.ulpPerformance || []} 
                      onDetailClick={(ulp, isCctv) => handleDetailClick('PO', ulp, true, isCctv)}
                      ulName={ulName}
                    />
                  </div>
                </div>
              ) : activeTab === 'OVER_SLA' ? (
                <OverSLAPage 
                  data={filteredData?.overSla || data.overSla} 
                  onDetailClick={handleOverSLADetailClick}
                  ulName={ulName}
                />
              ) : (
                <RatingPage data={filteredData || data} ulName={ulName} />
              )
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      <DetailModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        headers={modalHeaders}
        rows={modalRows}
        ulName={ulName}
      />

      <footer className="bg-[#0a1128] border-t border-slate-900 p-4 text-center">
        <p className="text-[10px] font-black text-slate-500 tracking-[0.5em] uppercase">
          {MultiuserService.replaceBrandingText("© 2026 PLN ELECTRICITY SERVICES • REGIONAL SUMATERA BARAT • UL BUKITTINGGI", ulName)}
        </p>
      </footer>
    </div>
  );
}
