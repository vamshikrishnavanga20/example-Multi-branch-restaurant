'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface OdometerProps {
  value: string | number;
  className?: string;
  duration?: number; // Duration in ms (default 800)
  prefix?: string;
  suffix?: string;
  showDirectionGlow?: boolean; // Subtle emerald/amber glow on change
}

// High-grade smooth deceleration curve (ease-out-expo)
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// Parses string or number into numeric value and formatting attributes
function parseValue(val: string | number) {
  if (typeof val === 'number') {
    return {
      numeric: val,
      prefix: '',
      suffix: '',
      decimals: val % 1 !== 0 ? 2 : 0,
      isIndianFormat: false,
    };
  }

  const str = String(val ?? '').trim();
  if (!str) {
    return { numeric: 0, prefix: '', suffix: '', decimals: 0, isIndianFormat: false };
  }

  const prefixMatch = str.match(/^[^\d-]*/);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const suffixMatch = str.match(/[^\d]*$/);
  const suffix = suffixMatch ? suffixMatch[0] : '';

  const cleanNumberStr = str.replace(/[^\d.-]/g, '');
  const numeric = parseFloat(cleanNumberStr);

  if (isNaN(numeric)) {
    return { numeric: 0, prefix: str, suffix: '', decimals: 0, isIndianFormat: false, isNaN: true };
  }

  const hasDecimal = cleanNumberStr.includes('.');
  const decimals = hasDecimal ? (cleanNumberStr.split('.')[1] || '').length : 0;
  const isIndianFormat = prefix.includes('₹') || str.includes('₹') || /,\d{2},/.test(str);

  return {
    numeric,
    prefix,
    suffix,
    decimals,
    isIndianFormat,
    isNaN: false,
  };
}

// Formats a number according to the detected configuration
function formatNumber(num: number, config: ReturnType<typeof parseValue>, customPrefix?: string, customSuffix?: string) {
  if (config.isNaN) return config.prefix;

  const rounded = config.decimals > 0 ? num.toFixed(config.decimals) : Math.round(num).toString();
  const effectivePrefix = customPrefix !== undefined ? customPrefix : config.prefix;
  const effectiveSuffix = customSuffix !== undefined ? customSuffix : config.suffix;

  let formattedNumber = '';
  if (config.isIndianFormat || effectivePrefix.includes('₹')) {
    const parts = rounded.split('.');
    const integerPart = parseInt(parts[0], 10);
    const formattedInteger = Number.isFinite(integerPart) ? integerPart.toLocaleString('en-IN') : '0';
    formattedNumber = parts.length > 1 ? `${formattedInteger}.${parts[1]}` : formattedInteger;
  } else {
    const parts = rounded.split('.');
    const integerPart = parseInt(parts[0], 10);
    const formattedInteger = Number.isFinite(integerPart) ? integerPart.toLocaleString('en-US') : '0';
    formattedNumber = parts.length > 1 ? `${formattedInteger}.${parts[1]}` : formattedInteger;
  }

  return `${effectivePrefix}${formattedNumber}${effectiveSuffix}`;
}

export default function Odometer({
  value,
  className = '',
  duration = 800,
  prefix,
  suffix,
  showDirectionGlow = true,
}: OdometerProps) {
  const parsed = useMemo(() => parseValue(value), [value]);
  const [mounted, setMounted] = useState(false);
  const [displayValue, setDisplayValue] = useState<number>(parsed.numeric);
  const [isRolling, setIsRolling] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  const currentValRef = useRef<number>(parsed.numeric);
  const animFrameRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If not numeric (e.g. error string or NaN), no animation needed
    if (parsed.isNaN) return;

    const targetVal = parsed.numeric;

    // Skip animation on first load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      currentValRef.current = targetVal;
      setDisplayValue(targetVal);
      return;
    }

    const startVal = currentValRef.current;
    if (Math.abs(targetVal - startVal) < 0.0001) {
      return;
    }

    const newDirection = targetVal > startVal ? 'up' : 'down';
    setDirection(newDirection);
    setIsRolling(true);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutExpo(progress);
      const nextVal = startVal + (targetVal - startVal) * ease;

      setDisplayValue(nextVal);
      currentValRef.current = nextVal;

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetVal);
        currentValRef.current = targetVal;
        setIsRolling(false);
        // Clear direction indicator after smooth settle
        setTimeout(() => setDirection(null), 500);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [parsed.numeric, parsed.isNaN, duration]);

  // SSR / Fallback initial render
  if (!mounted) {
    return (
      <span className={`inline-block tabular-nums font-mono ${className}`}>
        {formatNumber(parsed.numeric, parsed, prefix, suffix)}
      </span>
    );
  }

  if (parsed.isNaN) {
    return <span className={`inline-block ${className}`}>{String(value)}</span>;
  }

  const formattedStr = formatNumber(displayValue, parsed, prefix, suffix);

  return (
    <span
      className={`inline-flex items-baseline tabular-nums font-mono transition-colors duration-300 ${
        showDirectionGlow && isRolling
          ? direction === 'up'
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]'
            : 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]'
          : ''
      } ${className}`}
    >
      {formattedStr.split('').map((char, idx) => {
        const isDigit = /\d/.test(char);
        if (!isDigit) {
          return (
            <span key={`char-${idx}-${char}`} className="select-none inline-block">
              {char}
            </span>
          );
        }

        return (
          <span
            key={`col-${idx}`}
            className="inline-flex overflow-hidden h-[1.12em] leading-none align-baseline relative select-none"
          >
            {/* Hidden spacer ensuring exact tabular glyph width */}
            <span className="invisible pointer-events-none tabular-nums font-mono leading-none">0</span>
            <span className="absolute inset-0 flex items-center justify-center tabular-nums font-mono leading-none">
              {char}
            </span>
          </span>
        );
      })}
    </span>
  );
}
