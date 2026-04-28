'use client';
import { motion } from "framer-motion";
import { LucideIcon, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface AnimatedInputProps {
  id: string;
  type: string;
  placeholder: string;
  label: string;
  icon: LucideIcon;
  iconDelay?: number;
  fieldDelay?: number;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function AnimatedInput({
  id,
  type,
  placeholder,
  label,
  icon: Icon,
  iconDelay = 0,
  fieldDelay = 0,
  required = false,
  value,
  onChange,
  disabled = false,
  children,
}: AnimatedInputProps) {
  // made by mohamed - local state for password visibility toggle
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;
  // made by mohamed

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: fieldDelay }}
    >
      <label htmlFor={id} className="block text-slate-700 dark:text-slate-200 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative flex items-center">
        <motion.div
          className="absolute left-4 size-5 text-slate-400 dark:text-slate-500 flex items-center justify-center"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 5,
            delay: iconDelay,
          }}
        >
          <Icon className="size-5" />
        </motion.div>
        {children ? (
          <div className="w-full pl-12">
            {children}
          </div>
        ) : (
          <>
            <motion.input
              id={id}
              type={currentType}
              placeholder={placeholder}
              required={required}
              value={value}
              onChange={onChange}
              disabled={disabled}
              // made by mohamed - added padding right if it's a password field to make room for the eye icon
              className={`w-full pl-12 pr-4 ${isPassword ? 'pr-12' : ''} py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500' : ''}`}
              whileFocus={disabled ? {} : {
                scale: 1.01
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
            {/* made by mohamed - eye icon for password visibility */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="size-5" />
                ) : (
                  <Eye className="size-5" />
                )}
              </button>
            )}
            {/* made by mohamed */}
          </>
        )}
      </div>
    </motion.div>
  );
}
