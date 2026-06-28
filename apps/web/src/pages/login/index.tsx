import { useState, type FormEvent } from "react";
import { mosaicApi } from "@mosaic-dock/api-client";
import type { ApiClient } from "@mosaic-dock/api-client";
import type { LoginRequest, LoginResponse, User } from "@mosaic-dock/shared";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type LoginCredentials = LoginRequest & { rememberMe: boolean };

export interface LoginPageApi {
  client: {
    login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  };
}

interface LoginPageProps {
  api?: LoginPageApi;
  onAuthenticated: (user: User) => void;
}

export function LoginPage({ api = mosaicApi, onAuthenticated }: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function submit(values: LoginCredentials) {
    setError(null);
    setSubmitting(true);
    try {
      const result: LoginResponse = await api.client.login(values);
      const targetStorage = values.rememberMe ? localStorage : sessionStorage;
      const staleStorage = values.rememberMe ? sessionStorage : localStorage;

      targetStorage.setItem("token", result.accessToken);
      targetStorage.setItem("user", JSON.stringify(result.user));
      staleStorage.removeItem("token");
      staleStorage.removeItem("user");

      onAuthenticated(result.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void submit({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      type: "email",
      rememberMe,
    });
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_32%)] p-6">
      <Card className="w-full max-w-[420px] rounded-2xl shadow-2xl shadow-slate-950/10">
        <CardHeader>
          <CardTitle>Mosaic Dock</CardTitle>
          <CardDescription>
            登录后连接现有 guada 后端，进入 React 版聊天工作台。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                name="username"
                placeholder="用户名"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="密码"
                autoComplete="current-password"
                required
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              记住我
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export type { ApiClient };

export default LoginPage;
