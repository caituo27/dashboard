import { displayText } from "../utils/displayText";
import { Children, cloneElement, isValidElement, useState, type ReactNode } from "react";
import { Table, Tooltip, type TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";

function displayChildren(children: ReactNode): ReactNode {
  return Children.map(children, child => {
    if (typeof child === "string") return displayText(child);
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children !== undefined)
      return cloneElement(child, undefined, displayChildren(child.props.children));
    return child;
  });
}

/** Keeps links and styled values interactive while revealing the rendered text. */
export function EllipsisText({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [title, setTitle] = useState<string>();
  return (
    <Tooltip title={title} styles={{ body: { maxHeight: "50vh", overflowY: "auto", overflowWrap: "anywhere" } }}>
      <span
        className={`sprix-table-ellipsis-cell ${className}`}
        onMouseEnter={(event) => setTitle(event.currentTarget.textContent || undefined)}
        onFocus={(event) => setTitle(event.currentTarget.textContent || undefined)}
      >{displayChildren(children)}</span>
    </Tooltip>
  );
}

export function EllipsisCell({ value }: { value?: string | number | null }) {
  return <EllipsisText>{value == null || value === "" ? "-" : String(value)}</EllipsisText>;
}

function compactColumns<T extends object>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((column) => {
    if ("children" in column) return { ...column, children: compactColumns(column.children) };
    // Action groups keep their buttons; composite cells opt out and truncate each field themselves.
    if (column.title === "操作") return { ...column, width: column.width ?? 220 };
    if (column.ellipsis === false) return column;
    const render = column.render;
    return {
      ...column,
      width: column.width ?? 140,
      ellipsis: { showTitle: false },
      render: (value, record, index) => {
        const content = render ? render(value, record, index) : value;
        if (isValidElement(content) && (content.type === EllipsisCell || content.type === EllipsisText)) return content;
        // Preserve Ant Design's legacy rendered-cell contract if a caller uses it.
        if (content != null && typeof content === "object" && !isValidElement(content) && !Array.isArray(content)) return content;
        return <EllipsisText>{content as ReactNode}</EllipsisText>;
      }
    };
  });
}

export function AdminTable<T extends object>(props: TableProps<T>) {
  const columns = props.columns ? compactColumns(props.columns) : undefined;
  const columnWidth = (items: ColumnsType<T>): number => items.reduce((sum, column) =>
    sum + ("children" in column ? columnWidth(column.children) : typeof column.width === "number" ? column.width : 140), 0);
  const minWidth = columns ? columnWidth(columns) + (props.rowSelection ? 48 : 0) : 0;
  const pagination: TableProps<T>["pagination"] = props.pagination === false ? false : {
    position: ["bottomRight"],
    showSizeChanger: false,
    showTotal: (total: number) => `共 ${total.toLocaleString()} 条`,
    ...props.pagination
  };
  return <Table<T> {...props} pagination={pagination} tableLayout="fixed" columns={columns}
    scroll={{ ...props.scroll, x: typeof props.scroll?.x === "string" ? props.scroll.x : Math.max(minWidth, typeof props.scroll?.x === "number" ? props.scroll.x : 0) }} />;
}
