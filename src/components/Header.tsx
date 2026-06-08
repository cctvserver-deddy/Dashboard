import React from 'react';
import { LayoutGrid, Zap, BarChart2, ShieldCheck, PlusCircle } from 'lucide-react';
import { MultiuserService } from '../services/multiuserService.ts';

interface HeaderProps {
  viewMode: 'DASHBOARD' | 'INSTALLER' | 'ADMIN';
  onViewModeChange: (mode: 'DASHBOARD' | 'INSTALLER' | 'ADMIN') => void;
  activeTab: 'CCTV' | 'OVER_SLA' | 'RATING';
  onTabChange: (tab: 'CCTV' | 'OVER_SLA' | 'RATING') => void;
  ulName?: string;
  isIsolatedInstaller?: boolean;
  isMasterApp?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  viewMode, 
  onViewModeChange, 
  activeTab, 
  onTabChange,
  ulName = "BUKITTINGGI",
  isIsolatedInstaller = false,
  isMasterApp = true
}) => {
  return (
    <header className="bg-[#0a1128] text-white h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="bg-white p-1 rounded-lg">
          <img 
            src="https://lh3.googleusercontent.com/d/1oVyyV8xNI5Xse4CMC2Ovn11w18uVXp7E" 
            alt="Logo" 
            className="w-8 h-8 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tighter leading-none">DASHBOARD MONITORING YANDAL</h1>
          <p className="text-[10px] text-brand-accent font-bold opacity-80 uppercase">
            {MultiuserService.replaceBrandingText("PLN ES BUKITTINGGI", ulName)}
          </p>
        </div>
      </div>

      {!isIsolatedInstaller ? (
        <nav className="flex items-center gap-1">
          {/* Dashboard Sub-Tabs */}
          <NavItem 
            icon={<LayoutGrid size={15} />} 
            label="CCTV" 
            active={viewMode === 'DASHBOARD' && activeTab === 'CCTV'} 
            onClick={() => {
              onViewModeChange('DASHBOARD');
              onTabChange('CCTV');
            }}
          />
          <NavItem 
            icon={<BarChart2 size={15} />} 
            label="OVER SLA" 
            active={viewMode === 'DASHBOARD' && activeTab === 'OVER_SLA'} 
            onClick={() => {
              onViewModeChange('DASHBOARD');
              onTabChange('OVER_SLA');
            }}
          />
          <NavItem 
            icon={<Zap size={15} />} 
            label="RATING" 
            active={viewMode === 'DASHBOARD' && activeTab === 'RATING'} 
            onClick={() => {
              onViewModeChange('DASHBOARD');
              onTabChange('RATING');
            }}
          />

          {/* Global Installer & Admin Tabs */}
          <span className="w-[1px] h-6 bg-white/20 mx-2" />

          {isMasterApp && (
            <NavItem 
              icon={<PlusCircle size={15} />} 
              label="PASANG INSTANSI" 
              active={viewMode === 'INSTALLER'} 
              onClick={() => onViewModeChange('INSTALLER')}
            />
          )}
          <NavItem 
            icon={<ShieldCheck size={15} />} 
            label="ADMIN PANEL" 
            active={viewMode === 'ADMIN'} 
            onClick={() => onViewModeChange('ADMIN')}
          />
        </nav>
      ) : (
        <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase animate-pulse">
          ⚡ MODE PEMASANGAN BARU (MULTI-USER)
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> SISTEM LIVE
          </span>
        </div>
        <div className="w-10 h-10 bg-gray-700 rounded-full overflow-hidden border-2 border-brand-accent">
          <img src="https://picsum.photos/seed/admin/100/100" alt="Admin" referrerPolicy="no-referrer" />
        </div>
      </div>
    </header>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${active ? 'bg-[#00e5ff22] text-brand-accent border border-brand-accent/30 shadow-[0_0_15px_rgba(0,229,255,0.1)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
  >
    {icon}
    <span className="text-[10px] font-black tracking-widest">{label}</span>
  </button>
);
