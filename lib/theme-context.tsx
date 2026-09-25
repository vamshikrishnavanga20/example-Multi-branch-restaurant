'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ThemePalette = 'gold' | 'sapphire' | 'emerald' | 'amethyst' | 'ivory';

export interface PaletteConfig {
  id: ThemePalette;
  name: string;
  tagline: string;
  primary: string;
  light: string;
  border: string;
  glow: string;
  textOnAccent: string;
  colors: string[];
}

export const PALETTE_CONFIGS: Record<ThemePalette, PaletteConfig> = {
  gold: {
    id: 'gold',
    name: 'Obsidian Gold',
    tagline: 'Signature fine dining with champagne gold foil & deep onyx.',
    primary: '#D4AF37',
    light: 'rgba(212, 175, 55, 0.15)',
    border: 'rgba(212, 175, 55, 0.35)',
    glow: 'rgba(212, 175, 55, 0.25)',
    textOnAccent: '#000000',
    colors: ['#09090B', '#121216', '#D4AF37', '#E5C158']
  },
  sapphire: {
    id: 'sapphire',
    name: 'Midnight Sapphire',
    tagline: 'Modern executive palette with cool navy slate & ice blue.',
    primary: '#38BDF8',
    light: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.35)',
    glow: 'rgba(56, 189, 248, 0.25)',
    textOnAccent: '#000000',
    colors: ['#0A0F1D', '#111827', '#38BDF8', '#0EA5E9']
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Reserve',
    tagline: 'Imperial botanical luxury with deep forest black & emerald jade.',
    primary: '#10B981',
    light: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.35)',
    glow: 'rgba(16, 185, 129, 0.25)',
    textOnAccent: '#000000',
    colors: ['#09120C', '#0F1E14', '#10B981', '#34D399']
  },
  amethyst: {
    id: 'amethyst',
    name: 'Royal Amethyst',
    tagline: 'Opulent lounge aesthetics with velvet noir & rich violet.',
    primary: '#A855F7',
    light: 'rgba(168, 85, 247, 0.15)',
    border: 'rgba(168, 85, 247, 0.35)',
    glow: 'rgba(168, 85, 247, 0.25)',
    textOnAccent: '#FFFFFF',
    colors: ['#0E0A17', '#171126', '#A855F7', '#C084FC']
  },
  ivory: {
    id: 'ivory',
    name: 'Ivory Luxe (Light)',
    tagline: 'Daytime manager mode with warm porcelain white & bronze accents.',
    primary: '#B45309',
    light: 'rgba(180, 83, 9, 0.15)',
    border: 'rgba(180, 83, 9, 0.35)',
    glow: 'rgba(180, 83, 9, 0.2)',
    textOnAccent: '#FFFFFF',
    colors: ['#F8FAFC', '#FFFFFF', '#B45309', '#D4AF37']
  }
};

interface ThemeContextType {
  mode: ThemeMode;
  palette: ThemePalette;
  themeConfig: PaletteConfig;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleMode: () => void;
  pageSize: number;
  setPageSize: (size: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  palette: 'gold',
  themeConfig: PALETTE_CONFIGS.gold,
  setMode: () => {},
  setPalette: () => {},
  toggleMode: () => {},
  pageSize: 18,
  setPageSize: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [palette, setPaletteState] = useState<ThemePalette>('gold');
  const [pageSize, setPageSizeState] = useState<number>(18);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem('manohaa_theme_mode') as ThemeMode | null;
      const savedPalette = localStorage.getItem('manohaa_theme_palette') as ThemePalette | null;
      const savedPageSize = localStorage.getItem('manohaa_page_size');

      if (savedMode === 'light' || savedMode === 'dark') {
        setModeState(savedMode);
      }
      if (savedPalette && PALETTE_CONFIGS[savedPalette]) {
        setPaletteState(savedPalette);
      }
      if (savedPageSize) {
        const parsed = parseInt(savedPageSize, 10);
        if ([12, 18, 24, 36].includes(parsed)) setPageSizeState(parsed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const themeConfig = PALETTE_CONFIGS[palette] || PALETTE_CONFIGS.gold;

  // Apply theme variables directly to documentElement
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('manohaa_theme_mode', mode);
      localStorage.setItem('manohaa_theme_palette', palette);
      localStorage.setItem('manohaa_page_size', pageSize.toString());

      const root = document.documentElement;
      root.setAttribute('data-theme', mode);
      root.setAttribute('data-palette', palette);
      
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.setProperty('--bg-primary', '#09090b');
        root.style.setProperty('--bg-surface', '#121216');
        root.style.setProperty('--bg-card', 'rgba(18, 18, 22, 0.95)');
        root.style.setProperty('--border-card', 'rgba(255, 255, 255, 0.08)');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.6)');
        root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.35)');
        root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.05)');
        root.style.setProperty('--sidebar-bg', '#09090b');
        root.style.setProperty('--header-bg', 'rgba(9, 9, 11, 0.85)');
        root.style.setProperty('--input-bg', 'rgba(0, 0, 0, 0.4)');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.setProperty('--bg-primary', '#f8fafc');
        root.style.setProperty('--bg-surface', '#ffffff');
        root.style.setProperty('--bg-card', '#ffffff');
        root.style.setProperty('--border-card', '#e2e8f0');
        root.style.setProperty('--border-subtle', '#f1f5f9');
        root.style.setProperty('--text-primary', '#0f172a');
        root.style.setProperty('--text-secondary', '#334155');
        root.style.setProperty('--text-muted', '#64748b');
        root.style.setProperty('--sidebar-bg', '#ffffff');
        root.style.setProperty('--header-bg', 'rgba(255, 255, 255, 0.95)');
        root.style.setProperty('--input-bg', '#f8fafc');
      }

      // Accent variables
      root.style.setProperty('--accent', themeConfig.primary);
      root.style.setProperty('--accent-light', themeConfig.light);
      root.style.setProperty('--accent-border', themeConfig.border);
      root.style.setProperty('--accent-glow', themeConfig.glow);
      root.style.setProperty('--accent-text', themeConfig.textOnAccent);

    } catch (e) {
      // ignore
    }
  }, [mode, palette, pageSize, mounted, themeConfig]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const setPalette = (newPalette: ThemePalette) => {
    setPaletteState(newPalette);
    if (newPalette === 'ivory') {
      setModeState('light');
    }
  };

  const toggleMode = () => {
    setModeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setPageSize = (size: number) => {
    setPageSizeState(size);
  };

  return (
    <ThemeContext.Provider value={{ mode, palette, themeConfig, setMode, setPalette, toggleMode, pageSize, setPageSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
