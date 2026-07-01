"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: string, p: string) {
    setError(null);
    const res = await signIn("credentials", { email: e, password: p, redirect: false });
    if (res?.error) setError("Неверный логин или пароль");
    else router.push("/workspace");
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Личный кабинет FD</h1>
      <form onSubmit={(ev) => { ev.preventDefault(); submit(email, password); }} className="space-y-3">
        <input className="w-full rounded-md border px-3 py-2" placeholder="Логин" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-white">Войти</button>
      </form>
      <div className="flex gap-2">
        <button onClick={() => submit("client@demo", "demo1234")} className="flex-1 rounded-md border px-3 py-2 text-sm">Войти как Клиент</button>
        <button onClick={() => submit("admin@demo", "demo1234")} className="flex-1 rounded-md border px-3 py-2 text-sm">Войти как Админ</button>
      </div>
    </div>
  );
}
