import { CalendarClock, Plus, RefreshCw } from "lucide-react";
import { WorkspacePageHeader } from "../../components/layout/WorkspacePageHeader";
import { Button } from "../../components/ui/button";

export function SchedulerPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <WorkspacePageHeader
          title="定时任务"
          actions={
            <div className="flex items-center gap-2">
              <Button className="h-8 rounded-md bg-pink-500 px-3 text-sm text-white shadow-none hover:bg-pink-500/90">
                <Plus className="h-4 w-4" aria-hidden="true" />
                新建任务
              </Button>
              <Button variant="secondary" className="h-8 rounded-md px-3 text-sm shadow-none">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                刷新
              </Button>
            </div>
          }
        />
      </header>

      <main className="pt-5">
        <section className="grid min-h-[176px] place-items-center rounded-lg border border-slate-200 bg-white text-center dark:border-[#2f3136] dark:bg-[#232428]">
          <div className="flex flex-col items-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/45" aria-hidden="true" />
            <h2 className="mt-4 text-sm font-medium text-muted-foreground">暂无定时任务</h2>
            <p className="mt-2 text-xs text-muted-foreground/75">点击"新建任务"开始创建</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default SchedulerPage;
