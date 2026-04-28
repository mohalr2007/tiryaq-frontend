'use client';

import { Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";

type CopyPublicUrlButtonProps = {
  url: string;
  label: string;
  successLabel: string;
  className?: string;
};

export default function CopyPublicUrlButton({
  url,
  label,
  successLabel,
  className = "",
}: CopyPublicUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className={className}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? successLabel : label}
    </button>
  );
}
