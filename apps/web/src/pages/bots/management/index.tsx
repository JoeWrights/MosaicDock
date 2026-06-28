import { useEffect, useState } from "react";
import { Bot, ExternalLink, Plus } from "lucide-react";
import { mosaicApi, type ApiClient, type BotInstance } from "@mosaic-dock/api-client";
import { WorkspacePageHeader } from "../../../components/layout/WorkspacePageHeader";
import { Button } from "../../../components/ui/button";
import { Spinner } from "../../../components/ui/spinner";
import { cn } from "../../../lib/utils";

export interface BotsManagementPageApi {
  client: Pick<ApiClient, "fetchBotInstances">;
}

interface BotsManagementPageProps {
  api?: BotsManagementPageApi;
}

export function BotsManagementPage({ api = mosaicApi }: BotsManagementPageProps) {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBots() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.client.fetchBotInstances();
        if (!cancelled) {
          setBots(Array.isArray(response) ? response : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "机器人加载失败");
          setBots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBots();

    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 pb-5 text-foreground dark:bg-[#1e1f23] dark:text-[#e8e9ed]">
      <header className="border-b border-slate-200 pb-4 dark:border-[#2f3136]">
        <WorkspacePageHeader title="机器人" />
        <div className="flex items-center justify-between gap-4">
          <nav aria-label="机器人页面" className="flex items-center gap-6 text-sm">
            <TabButton active>机器人管理</TabButton>
            <TabButton>对话数据</TabButton>
          </nav>
          <a
            href="https://ai.dingd.cn/docs/bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-muted-foreground transition hover:text-foreground dark:border-[#2f3136] dark:bg-[#232428]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            使用说明
          </a>
        </div>
      </header>

      <main className="pt-5">
        <Button className="h-8 rounded-md bg-linear-to-r from-pink-500 to-rose-500 px-3 text-sm text-white shadow-none hover:from-pink-500/90 hover:to-rose-500/90">
          <Plus className="h-4 w-4" aria-hidden="true" />
          新建机器人
        </Button>

        <section className="mt-5">
          {loading ? (
            <div className="grid min-h-[220px] place-items-center">
              <Spinner label="正在加载机器人" />
            </div>
          ) : error ? (
            <BotsEmptyState title={error} description="请稍后重试或检查登录状态" />
          ) : bots.length === 0 ? (
            <BotsEmptyState title="暂无机器人" description="点击上方按钮创建第一个机器人" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bots.map((bot) => (
                <BotCard key={bot.id} bot={bot} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TabButton({ active = false, children }: { active?: boolean; children: string }) {
  return (
    <button
      type="button"
      className={cn(
        "border-b-2 pb-2 transition-colors",
        active
          ? "border-pink-500 text-pink-500"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BotsEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center text-center">
      <div className="flex flex-col items-center">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-[#2f3136] dark:bg-[#232428]">
          <Bot className="h-6 w-6 text-foreground" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BotCard({ bot }: { bot: BotInstance }) {
  const statusText = bot.runtimeStatus ?? bot.status;

  return (
    <article
      data-testid={`bot-card-${bot.id}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-[#2f3136] dark:bg-[#232428]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#2a2c30] dark:text-[#e8e9ed]">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">{bot.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{bot.platform}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                bot.enabled
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-slate-100 text-muted-foreground dark:bg-[#2a2c30]",
              )}
            >
              {bot.enabled ? "已启用" : "已停用"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
              状态：{statusText}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-[#2a2c30]">
              重试：{bot.maxRetries} 次
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default BotsManagementPage;
