import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from "react";
import { Button, Empty, Tag as AntTag } from "antd";
import type { ButtonProps } from "antd";
import { CheckCircle2, Clock3, CircleAlert, CircleDollarSign, PlugZap } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
  titleClassName
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="sprix-page-hero">
      <h1 className={titleClassName ?? "sprix-title sprix-hero-title"}>{title}</h1>
      {subtitle && <p className="sprix-hero-subtitle">{subtitle}</p>}
      {actions && <div className="sprix-hero-actions">{actions}</div>}
    </div>
  );
}

export function Surface({
  children,
  className = "",
  tight = false,
  onClick,
  onKeyDown,
  role,
  tabIndex
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
}) {
  return (
    <section
      className={`${tight ? "sprix-card-tight" : "sprix-card"} ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </section>
  );
}

export function ActionButton(props: ButtonProps) {
  return <Button type="primary" shape="round" {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <Button shape="round" {...props} />;
}

export function SoftTag({
  children,
  tone = "teal",
  bordered = true,
  className = ""
}: {
  children: ReactNode;
  tone?: "teal" | "neutral" | "amber" | "red";
  bordered?: boolean;
  className?: string;
}) {
  const colors = {
    teal: { color: "#0f766e", borderColor: "#bfe9df", background: "#e7f7f2" },
    neutral: { color: "#56657a", borderColor: "#e5e7eb", background: "#f7f7f5" },
    amber: { color: "#a15c07", borderColor: "#ffe1a8", background: "#fff7e6" },
    red: { color: "#b42318", borderColor: "#ffd9d9", background: "#fff4f4" }
  };
  return (
    <AntTag bordered={bordered} style={colors[tone]} className={`m-0 rounded-full px-2.5 py-0.5 ${className}`.trim()}>
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
  icon
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
}) {
  const valueClassName = typeof value === "string" && value.length > 8 ? " is-long" : "";

  return (
    <Surface tight className="sprix-metric-card p-5">
      <div className="flex items-center gap-5">
        <div className="flex size-[92px] shrink-0 items-center justify-center">
          {icon ?? <CircleDollarSign size={19} />}
        </div>
        <div className="min-w-0">
          <p className="sprix-metric-card-title text-ink-soft">{title}</p>
          <div className={`sprix-metric-card-value mt-1 text-ink${valueClassName}`}>{value}</div>
          {caption && <p className="mt-1 text-xs text-ink-soft">{caption}</p>}
        </div>
      </div>
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
