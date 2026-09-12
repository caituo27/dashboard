import React from "react";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryEvents, queryUserProfile } from "./analytics-events.mjs";
import { beforeAll, afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DashboardAnalytics } from "../src/admin/DashboardAnalytics";
import { createAnalyticsSnapshot, BASELINE_AT } from "./analytics-data.mjs";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) });
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  const getStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getStyle(element));
});
afterEach(cleanup);
const snapshot = createAnalyticsSnapshot(7, BASELINE_AT);

test("metric opens a daily detail drawer with the selected period", async () => {
  render(<DashboardAnalytics data={snapshot} />);
  fireEvent.click(screen.getByRole("button", { name: /页面浏览量 PV/ }));
  expect(await screen.findByText("页面访问明细")).toBeTruthy();
  expect(screen.getByText("近 7 天 · 按日统计")).toBeTruthy();
  expect(screen.getByRole("combobox")).toBeTruthy();
});

test("button ranking opens the corresponding button's detail", async () => {
  render(<DashboardAnalytics data={snapshot} />);
  fireEvent.click(screen.getAllByRole("button", { name: "查看明细" })[0]);
  expect(await screen.findByText("查看任务详情 · 点击明细")).toBeTruthy();
});

test("date bar opens daily traffic and funnel opens selected stage", async () => {
  const view = render(<DashboardAnalytics data={snapshot} />);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`查看 ${snapshot.daily[0].date} 的访问明细`) }));
  expect(await screen.findByText("页面访问明细")).toBeTruthy();
  view.unmount();
  render(<DashboardAnalytics data={snapshot} />);
  fireEvent.click(screen.getByRole("button", { name: /05.*Agent 提交交付/ }));
  expect(await screen.findByText("任务转化明细")).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Agent 提交交付（所选）" })).toBeTruthy();
});

test("event tab loads a server page and opens all correlation fields", async () => {
  const response = queryEvents(new URLSearchParams('days=7'), BASELINE_AT);
  const request = vi.spyOn(axios, 'get').mockResolvedValue({data:response});
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  try {
    render(<QueryClientProvider client={client}><DashboardAnalytics data={snapshot}/></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button',{name:/页面浏览量 PV/}));
    fireEvent.click(await screen.findByRole('tab',{name:'事件明细'}));
    const buttons = await screen.findAllByRole('button',{name:'查看字段'});
    expect(buttons.length).toBe(20);
    fireEvent.click(buttons[0]);
    expect(await screen.findByText('事件完整字段')).toBeTruthy();
    expect(screen.getByText(response.rows[0].trace_id)).toBeTruthy();
    expect(screen.getByText(response.rows[0].event_id)).toBeTruthy();
    expect(request.mock.calls[0][1].params.page).toBe(1);
  } finally {client.clear();request.mockRestore();}
});

test("user profile opens from an event with consistent identity and device fields", async () => {
  const response = queryEvents(new URLSearchParams('days=7'), BASELINE_AT);
  const profile = queryUserProfile(response.rows[0].user_id, BASELINE_AT);
  const request = vi.spyOn(axios, 'get').mockImplementation(async (url)=>({data:url.includes('user-profile') ? profile : response}));
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  try {
    render(<QueryClientProvider client={client}><DashboardAnalytics data={snapshot}/></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button',{name:/页面浏览量 PV/}));
    fireEvent.click(await screen.findByRole('tab',{name:'事件明细'}));
    fireEvent.click((await screen.findAllByRole('button',{name:'用户画像'}))[0]);
    expect(await screen.findByText('窗口内首次访问')).toBeTruthy();
    expect(screen.getByText(text=>text.includes(profile.latest_context.device_model))).toBeTruthy();
    expect(screen.getByText('中国')).toBeTruthy();
    expect(screen.queryByText('匿名 ID')).toBeNull();
    expect(screen.queryByText('屏幕尺寸（CSS 像素）')).toBeNull();
    fireEvent.click(screen.getByText('更多详情'));
    expect(await screen.findByText('匿名 ID')).toBeTruthy();
    expect(screen.getByText('屏幕尺寸（CSS 像素）')).toBeTruthy();
    expect(request.mock.calls.find(([url])=>url.includes('user-profile'))[1].params.user_id).toBe(profile.user_id);
  } finally {client.clear();request.mockRestore();}
});
