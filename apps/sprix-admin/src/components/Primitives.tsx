import type { ReactNode } from "react";
import { Button, Empty, Tag as AntTag } from "antd";
import type { ButtonProps } from "antd";
import { CheckCircle2, Clock3, CircleAlert, CircleDollarSign, PlugZap } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow = "Sprix 管理后台"
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="sprix-page-header">
      <div className="min-w-0">
        <div className="sprix-page-kicker">{eyebrow}</div>
        <h1 className="sprix-page-title">{title}</h1>
        {subtitle && <p className="sprix-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="sprix-page-actions">{actions}</div>}
    </div>
  );
}

export function Surface({
  children,
  className = "",
  tight = false
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return <section className={`${tight ? "sprix-card-tight" : "sprix-card"} ${className}`}>{children}</section>;
}

export function ActionButton(props: ButtonProps) {
  return <Button type="primary" {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <Button {...props} />;
}

export function SoftTag({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "neutral" | "amber" | "red" }) {
  const colors = {
    teal: { color: "#0f766e", borderColor: "#bfe9df", background: "#e7f7f2" },
    neutral: { color: "#56657a", borderColor: "#e5e7eb", background: "#f7f7f5" },
    amber: { color: "#a15c07", borderColor: "#ffe1a8", background: "#fff7e6" },
    red: { color: "#b42318", borderColor: "#ffd9d9", background: "#fff4f4" }
  };
  return (
    <AntTag style={colors[tone]} className="m-0 rounded-full px-2.5 py-0.5">
      {children}
    </AntTag>
  );
}

export function StatusTag({ status }: { status: string }) {
  const tone =
    status.includes("失败") || status.includes("驳回") || status.includes("未通过") || status.includes("异常")
      ? "red"
      : status.includes("中") || status.includes("待") || status.includes("需")
        ? "amber"
        : status.includes("已") || status.includes("通过") || status.includes("可")
          ? "teal"
          : "neutral";
  return <SoftTag tone={tone}>{status}</SoftTag>;
}

export function MetricCard({
  title,
  value,
  caption,
  icon,
  onClick,
  active = false
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e7f7f2] text-accent">
          {icon ?? <CircleDollarSign size={19} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-soft">{title}</p>
          <div className="mt-1 text-2xl font-semibold leading-none text-ink">{value}</div>
          {caption && <p className="mt-1 text-xs text-ink-soft">{caption}</p>}
        </div>
      </div>
  );

  if (onClick) {
    return (
      <button type="button" className={`sprix-card-tight sprix-metric-action p-4 ${active ? "is-active" : ""}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <Surface tight className="p-4">
      {content}
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Surface className="p-8 text-center">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-ink-soft">{description}</span>} />
      <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}

export const primitiveIcons = {
  check: <CheckCircle2 size={19} />,
  clock: <Clock3 size={19} />,
  alert: <CircleAlert size={19} />,
  plug: <PlugZap size={19} />
};
