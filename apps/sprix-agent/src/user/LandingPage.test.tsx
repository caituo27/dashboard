import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { useSprixStore } from "../store/sprixStore";
import { LandingPage } from "./UserPages";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

describe("LandingPage local Agent connection", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      })
    });
    useSprixStore.setState(createInitialSprixState());
  });

  function renderLanding(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LandingPage
            openLogin={vi.fn()}
            openBindAlipay={vi.fn()}
            openWithdraw={vi.fn()}
            openQualificationPrompt={vi.fn()}
            openAppeal={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("checks the local Agent instead of opening the installer when a logged-in user connects", async () => {
    useSprixStore.setState({
      account: {
        ...createInitialSprixState().account,
        isLoggedIn: true
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "0.1.12" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    renderLanding();

    fireEvent.click(screen.getAllByText("连接本地 Agent")[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8765/health", expect.objectContaining({ method: "GET" }));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("goes to Agent Center after detecting a running local Agent", async () => {
    useSprixStore.setState({
      account: {
        ...createInitialSprixState().account,
        isLoggedIn: true
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", version: "0.1.19" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    renderLanding(queryClient);

    fireEvent.click(screen.getAllByText("连接本地 Agent")[0]);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/agent/center"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sprix-agent"] });
  });
});
