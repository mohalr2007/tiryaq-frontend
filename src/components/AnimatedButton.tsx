'use client';
import { motion } from "framer-motion";
import Link from "next/link";

interface AnimatedButtonProps {
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "social" | "link";
  href?: string;
}

export function AnimatedButton({
  type = "submit",
  children,
  className = "",
  disabled = false,
  onClick,
  variant = "primary",
  href,
}: AnimatedButtonProps) {
  const baseStyles = "relative overflow-hidden font-medium transition-all duration-150 transform disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-2xl shadow-lg hover:shadow-2xl hover:from-blue-700 hover:to-blue-800 w-full",
    secondary: "py-2.5 px-4 border border-slate-300 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold shadow-sm",
    social: "py-4 px-4 border-2 border-gray-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:shadow-md flex items-center justify-center gap-2 text-sm font-medium",
    link: "text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors whitespace-nowrap"
  };

  const buttonContent = (
    <>
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeInOut",
        }}
      />
      
      {/* Subtle pulse effect for primary variant */}
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-white/10 rounded-2xl"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut",
          }}
        />
      )}
      
      {/* Button content */}
      <span className="relative z-10 inline-flex items-center justify-center gap-2 leading-none">
        {children}
      </span>
      
      {/* Corner accent for primary variant */}
      {variant === "primary" && (
        <motion.div
          className="absolute top-1 right-1 w-2 h-2 bg-white/30 rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 5,
            ease: "easeInOut",
          }}
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${baseStyles} ${variants[variant]} ${className}`}>
        {buttonContent}
      </Link>
    );
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      whileHover={{ 
        scale: 1.01,
        y: -1,
        transition: { type: "spring", stiffness: 420, damping: 28 }
      }}
      whileTap={{ 
        scale: 0.98,
        transition: { duration: 0.1 }
      }}
    >
      {buttonContent}
    </motion.button>
  );
}
