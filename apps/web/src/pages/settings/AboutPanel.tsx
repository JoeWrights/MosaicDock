export function AboutPanel() {
  const isElectron = typeof window !== "undefined" && "electronAPI" in window;

  if (!isElectron) {
    return <div className="p-8 text-center text-slate-500 dark:text-[#8b8d95]">此功能仅在桌面客户端中可用</div>;
  }

  return (
    <div className="p-4">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-xl bg-pink-50 text-2xl font-bold text-pink-500 shadow-lg">
            M
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-[#e8e9ed]">MosaicDock</h2>
          <p className="text-sm text-slate-500 dark:text-[#8b8d95]">当前版本: --</p>
        </div>
        <div className="w-full rounded-lg border border-gray-200 bg-white p-6 dark:border-[#2e3035] dark:bg-[#232428]">
          <button
            type="button"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-slate-600 dark:border-[#34363c] dark:text-[#d6d7dc]"
          >
            检查更新
          </button>
        </div>
      </div>
    </div>
  );
}
