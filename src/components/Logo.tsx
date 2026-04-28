import Image from "next/image";

interface LogoProps {
  className?: string;
  isDark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  isMofid?: boolean;
}

export function Logo({ className = "", isDark = false, size = "md", isMofid = false }: LogoProps) {
  if (isMofid) {
    // Mofid branding remains specialized as requested
    return (
      <span className={`inline-flex items-center gap-1 font-bold tracking-tight ${size === "sm" ? "text-sm" : "text-base"} ${className} ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        <span>M</span>
        <span className={`relative inline-flex items-center justify-center rounded-full border-2 border-blue-600 text-blue-600 font-black leading-none bg-blue-50 dark:bg-blue-900/20 shadow-sm shadow-blue-500/20 ${size === "sm" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[10px]"}`}>
          +
        </span>
        <span>fid</span>
      </span>
    );
  }

  const heights = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Light mode logo */}
      <Image
        src="/images/logo-light.png"
        alt="TIRYAQ"
        width={420}
        height={106}
        priority
        unoptimized
        sizes="(max-width: 640px) 128px, (max-width: 1024px) 160px, 220px"
        style={{ height: heights[size], width: 'auto' }}
        className="dark:hidden object-contain"
      />
      {/* Dark mode logo */}
      <Image
        src="/images/logo-dark.png"
        alt="TIRYAQ"
        width={468}
        height={114}
        priority
        unoptimized
        sizes="(max-width: 640px) 128px, (max-width: 1024px) 160px, 220px"
        style={{ height: heights[size], width: 'auto' }}
        className="hidden dark:block object-contain"
      />
    </div>
  );
}
