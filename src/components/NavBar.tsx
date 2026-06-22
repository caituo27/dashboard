import { PillButton } from "./ui/PillButton";

export function NavBar() {
  return (
    <header className="relative z-10 mx-auto flex max-w-[1080px] items-center justify-between px-7 py-6">
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-xl">◳</span>
        <span className="font-serif text-[22px]">ConfigRater</span>
      </div>
      <PillButton
        variant="solid"
        className="!px-5 !py-2.5 !text-sm"
        onClick={() =>
          document
            .getElementById("evaluator")
            ?.scrollIntoView({ behavior: "smooth" })
        }
      >
        Start
      </PillButton>
    </header>
  );
}
