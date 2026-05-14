// src/components/ui/Dropdown.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  trigger?: React.ReactNode | ((selected: DropdownOption | undefined, isOpen: boolean) => React.ReactNode);
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  label,
  trigger,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find((opt) => opt.id === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isDropdownClick = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      const isMenuClick = menuRef.current && menuRef.current.contains(event.target as Node);
      
      if (!isDropdownClick && !isMenuClick) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      setMenuRect(dropdownRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}
      
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger ? (
          typeof trigger === "function" ? trigger(selectedOption, isOpen) : trigger
        ) : (
          <button
            type="button"
            className={`w-full flex items-center justify-between p-2.5 text-xs font-medium bg-white border rounded-lg transition-all shadow-sm
              ${isOpen 
                ? "border-violet-500 ring-4 ring-violet-500/10" 
                : "border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
          >
            <div className="flex items-center gap-2 truncate text-left">
              {selectedOption?.icon && (
                <span className="text-slate-400 shrink-0">{selectedOption.icon}</span>
              )}
              <span className="truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              {selectedOption?.badge && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded leading-none shrink-0 
                  ${selectedOption.badge === 'DRAFT' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {selectedOption.badge}
                </span>
              )}
            </div>
            <ChevronDown 
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0
                ${isOpen ? "rotate-180" : ""}`} 
            />
          </button>
        )}
      </div>

      {isOpen && menuRect && createPortal(
        <div 
          ref={menuRef}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-300/50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top"
          style={{
            top: `${menuRect.bottom + 6}px`,
            left: `${menuRect.left}px`,
            minWidth: `${menuRect.width}px`,
          }}
        >
          <div className="max-h-[240px] overflow-y-auto py-1.5">
            {options.map((option) => {
              const isSelected = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors
                    ${isSelected 
                      ? "bg-violet-50 text-violet-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {option.icon && (
                        <span className={`shrink-0 transition-colors ${isSelected ? "text-violet-500" : "text-slate-400"}`}>
                          {option.icon}
                        </span>
                      )}
                      <span className="text-xs font-semibold truncate">
                        {option.label}
                      </span>
                      {option.badge && (
                        <span className={`text-[8px] font-black px-1 py-0.5 rounded leading-none shrink-0
                          ${isSelected ? "bg-violet-200 text-violet-800" : "bg-slate-100 text-slate-500"}`}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className={`text-[10px] mt-0.5 truncate ${isSelected ? "text-violet-500/70" : "text-slate-400"}`}>
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
