import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import App from "./App";
import "./index.css";

const adminTheme: ThemeConfig = {
  token: {
    colorPrimary: "#111111",
    colorPrimaryHover: "#2b2b2b",
    colorPrimaryActive: "#050505",
    colorInfo: "#0f766e",
    colorSuccess: "#0f766e",
    colorWarning: "#d97706",
    colorError: "#e5484d",
    colorErrorHover: "#f05b62",
    colorErrorActive: "#c92f35",
    colorLink: "#111111",
    colorLinkHover: "#2b2b2b",
    colorLinkActive: "#050505",
    colorText: "#1a1a1a",
    colorTextSecondary: "#6b6b6b",
    colorBorder: "#eeeeee",
    colorBgContainer: "#ffffff",
    colorBgElevated: "rgba(255, 255, 255, 0.98)",
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: "\"PingFang SC\", \"Source Han Sans SC\", \"Noto Sans CJK SC\", \"Noto Sans SC\", \"Microsoft YaHei\", sans-serif"
  },
  components: {
    Button: {
      primaryShadow: "none",
      dangerShadow: "none",
      defaultBorderColor: "#e5e5e5",
      defaultColor: "#1a1a1a",
      defaultHoverBorderColor: "#111111",
      defaultHoverColor: "#111111"
    },
    Input: {
      activeBorderColor: "#111111",
      activeShadow: "0 0 0 2px rgba(15, 118, 110, 0.1)",
      hoverBorderColor: "#d6d6d6"
    },
    Modal: {
      contentBg: "rgba(255, 255, 255, 0.98)",
      headerBg: "transparent",
      titleColor: "#1a1a1a"
    },
    Pagination: {
      itemActiveBg: "#ffffff"
    },
    Segmented: {
      itemSelectedBg: "#ffffff",
      itemSelectedColor: "#111111",
      trackBg: "#f4f4f2"
    },
    Table: {
      headerBg: "#fafafa",
      headerColor: "#6b6b6b",
      rowHoverBg: "#fbfbfa"
    },
    Tabs: {
      inkBarColor: "#111111",
      itemHoverColor: "#111111",
      itemSelectedColor: "#111111"
    }
  }
};

ConfigProvider.config({
  holderRender: (children) => (
    <ConfigProvider locale={zhCN} theme={adminTheme}>
      {children}
    </ConfigProvider>
  )
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={adminTheme}>
      <App />
    </ConfigProvider>
  </StrictMode>
);
