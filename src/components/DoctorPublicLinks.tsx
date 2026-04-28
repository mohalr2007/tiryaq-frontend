"use client";

import type { IconType } from "react-icons";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTelegram,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";
import { MdAlternateEmail, MdEmail, MdLocalPhone } from "react-icons/md";
import { useI18n } from "@/lib/i18n";
import {
  buildDoctorPublicChannels,
  type DoctorContactFields,
  type DoctorPublicChannel,
} from "@/utils/doctorContactChannels";

type Props = {
  doctor: DoctorContactFields;
  variant?: "compact" | "detailed";
  className?: string;
};

const channelIconByKey: Record<DoctorPublicChannel["key"], IconType> = {
  phone: MdLocalPhone,
  email: MdEmail,
  gmail: MdAlternateEmail,
  whatsapp: FaWhatsapp,
  telegram: FaTelegram,
  facebook: FaFacebookF,
  instagram: FaInstagram,
  x: FaXTwitter,
  linkedin: FaLinkedinIn,
};

const channelColors: Record<string, { bg: string; border: string; text: string; icon: string; hover: string; iconBg: string }> = {
  phone: {
    bg: "bg-emerald-100 dark:bg-emerald-950/75",
    border: "border-emerald-400 dark:border-emerald-500/70",
    text: "text-emerald-900 dark:text-emerald-50",
    icon: "text-emerald-800 dark:text-emerald-100",
    hover: "hover:bg-emerald-200 dark:hover:bg-emerald-900/85",
    iconBg: "bg-white/80 dark:bg-emerald-500/20",
  },
  email: {
    bg: "bg-blue-100 dark:bg-blue-950/75",
    border: "border-blue-400 dark:border-blue-500/70",
    text: "text-blue-900 dark:text-blue-50",
    icon: "text-blue-800 dark:text-blue-100",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-900/85",
    iconBg: "bg-white/80 dark:bg-blue-500/20",
  },
  gmail: {
    bg: "bg-red-100 dark:bg-red-950/75",
    border: "border-red-400 dark:border-red-500/70",
    text: "text-red-900 dark:text-red-50",
    icon: "text-red-800 dark:text-red-100",
    hover: "hover:bg-red-200 dark:hover:bg-red-900/85",
    iconBg: "bg-white/80 dark:bg-red-500/20",
  },
  whatsapp: {
    bg: "bg-green-100 dark:bg-green-950/75",
    border: "border-green-400 dark:border-green-500/70",
    text: "text-green-900 dark:text-green-50",
    icon: "text-green-800 dark:text-green-100",
    hover: "hover:bg-green-200 dark:hover:bg-green-900/85",
    iconBg: "bg-white/80 dark:bg-green-500/20",
  },
  telegram: {
    bg: "bg-sky-100 dark:bg-sky-950/75",
    border: "border-sky-400 dark:border-sky-500/70",
    text: "text-sky-900 dark:text-sky-50",
    icon: "text-sky-800 dark:text-sky-100",
    hover: "hover:bg-sky-200 dark:hover:bg-sky-900/85",
    iconBg: "bg-white/80 dark:bg-sky-500/20",
  },
  facebook: {
    bg: "bg-[#dce9ff] dark:bg-[#102b58]",
    border: "border-[#6da8ff] dark:border-[#2d7ef7]",
    text: "text-[#0f58cc] dark:text-[#edf5ff]",
    icon: "text-[#0f58cc] dark:text-[#ffffff]",
    hover: "hover:bg-[#c8dcff] dark:hover:bg-[#153978]",
    iconBg: "bg-white/85 dark:bg-[#1877f2]/22",
  },
  instagram: {
    bg: "bg-pink-100 dark:bg-pink-950/75",
    border: "border-pink-400 dark:border-pink-500/70",
    text: "text-pink-900 dark:text-pink-50",
    icon: "text-pink-800 dark:text-pink-100",
    hover: "hover:bg-pink-200 dark:hover:bg-pink-900/85",
    iconBg: "bg-white/80 dark:bg-pink-500/20",
  },
  x: {
    bg: "bg-slate-300 dark:bg-slate-700/95",
    border: "border-slate-500 dark:border-slate-400/80",
    text: "text-slate-900 dark:text-white",
    icon: "text-slate-900 dark:text-white",
    hover: "hover:bg-slate-400 dark:hover:bg-slate-600/95",
    iconBg: "bg-white/80 dark:bg-slate-500/30",
  },
  linkedin: {
    bg: "bg-[#dff1ff] dark:bg-[#0a2d4a]",
    border: "border-[#7abfff] dark:border-[#1791ff]",
    text: "text-[#0a5baf] dark:text-[#eef8ff]",
    icon: "text-[#0a66c2] dark:text-[#ffffff]",
    hover: "hover:bg-[#cae8ff] dark:hover:bg-[#103d64]",
    iconBg: "bg-white/85 dark:bg-[#1791ff]/20",
  },
};

function truncateValue(channel: DoctorPublicChannel) {
  if (channel.key === "phone" || channel.key === "email" || channel.key === "gmail") {
    return channel.value;
  }

  return channel.key.toUpperCase();
}

function getChannelDirection(channel: DoctorPublicChannel) {
  if (
    channel.key === "phone" ||
    channel.key === "email" ||
    channel.key === "gmail" ||
    channel.key === "whatsapp"
  ) {
    return "ltr";
  }

  return undefined;
}

export default function DoctorPublicLinks({
  doctor,
  variant = "compact",
  className = "",
}: Props) {
  const { language } = useI18n();
  const tr = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;

  const channels = buildDoctorPublicChannels(doctor);
  if (channels.length === 0) {
    return null;
  }

  const getLabel = (key: DoctorPublicChannel["key"]) => {
    switch (key) {
      case "phone":
        return tr("Téléphone", "Phone", "الهاتف");
      case "email":
        return tr("Email", "Email", "البريد الإلكتروني");
      case "facebook":
        return "Facebook";
      case "instagram":
        return "Instagram";
      case "x":
        return "X";
      case "whatsapp":
        return "WhatsApp";
      case "telegram":
        return "Telegram";
      case "linkedin":
        return "LinkedIn";
      case "gmail":
        return "Gmail";
      default:
        return key;
    }
  };

  if (variant === "detailed") {
    return (
      <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
        {channels.map((channel) => {
          const Icon = channelIconByKey[channel.key];
          const colors =
            channelColors[channel.key] ?? {
              bg: "bg-slate-100 dark:bg-slate-800",
              border: "border-slate-300 dark:border-slate-700",
              text: "text-slate-800 dark:text-slate-100",
              icon: "text-slate-700 dark:text-slate-100",
              hover: "hover:bg-slate-200 dark:hover:bg-slate-700",
              iconBg: "bg-white dark:bg-slate-700",
            };
          return (
            <a
              key={`${channel.key}-${channel.href}`}
              href={channel.href}
              target={channel.href.startsWith("http") ? "_blank" : undefined}
              rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:-translate-y-0.5 ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}`}
            >
              <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${colors.iconBg} ${colors.icon}`}>
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider opacity-90">
                    {getLabel(channel.key)}
                  </span>
                <span dir={getChannelDirection(channel)} className="mt-1 block truncate font-semibold">
                  {channel.value}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {channels.map((channel) => {
        const Icon = channelIconByKey[channel.key];
        const isShortKey = !["phone", "email", "gmail", "whatsapp"].includes(channel.key);
        const colors =
          channelColors[channel.key] ?? {
            bg: "bg-slate-100 dark:bg-slate-800",
              border: "border-slate-200 dark:border-slate-700",
              text: "text-slate-700 dark:text-slate-100",
              icon: "text-slate-700 dark:text-slate-100",
              hover: "hover:bg-slate-200 dark:hover:bg-slate-700",
              iconBg: "bg-white/80 dark:bg-slate-700/70",
            };
        return (
          <a
            key={`${channel.key}-${channel.href}`}
            href={channel.href}
            target={channel.href.startsWith("http") ? "_blank" : undefined}
            rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
            onClick={(event) => event.stopPropagation()}
            title={`${getLabel(channel.key)}${isShortKey ? "" : `: ${channel.value}`}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}`}
          >
            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors.iconBg}`}>
              <Icon size={12} className={colors.icon} />
            </span>
            <span dir={getChannelDirection(channel)} className="max-w-[140px] truncate">
              {isShortKey ? getLabel(channel.key) : truncateValue(channel)}
            </span>
          </a>
        );
      })}
    </div>
  );
}
