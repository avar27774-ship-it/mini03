import { useState } from "react";
import { useLocation } from "wouter";
import { useGetAdminStats, getGetAdminStatsQueryKey, useAdminListUsers, getAdminListUsersQueryKey, useAdminBanUser, useAdminVerifyUser, useAdminListProducts, getAdminListProductsQueryKey, useAdminModerateProduct, useAdminListDeals, getAdminListDealsQueryKey, useAdminResolveDeal, useAdminListWithdrawals, getAdminListWithdrawalsQueryKey, useAdminProcessWithdrawal, useGetCategories, getGetCategoriesQueryKey, useAdminCreateCategory, useAdminDeleteCategory } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, ShoppingBag, Briefcase, Wallet, Shield, BarChart3, Ban, CheckCircle, X, Plus } from "lucide-react";

export default function AdminPage() {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"stats" | "users" | "products" | "deals" | "withdrawals" | "categories">("stats");
  const [userSearch, setUserSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  if (!isAuthenticated || !user?.isAdmin) { setLocation("/"); return null; }

  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: usersData } = useAdminListUsers({ search: userSearch || undefined }, { query: { enabled: tab === "users", queryKey: getAdminListUsersQueryKey({ search: userSearch || undefined }) } });
  const { data: productsData } = useAdminListProducts({}, { query: { enabled: tab === "products", queryKey: getAdminListProductsQueryKey({}) } });
  const { data: dealsData } = useAdminListDeals({}, { query: { enabled: tab === "deals", queryKey: getAdminListDealsQueryKey({}) } });
  const { data: withdrawals } = useAdminListWithdrawals({ query: { enabled: tab === "withdrawals", queryKey: getAdminListWithdrawalsQueryKey() } });
  const { data: categories } = useGetCategories({ query: { enabled: tab === "categories", queryKey: getGetCategoriesQueryKey() } });

  const banUser = useAdminBanUser();
  const verifyUser = useAdminVerifyUser();
  const moderateProduct = useAdminModerateProduct();
  const resolveDeal = useAdminResolveDeal();
  const processWithdrawal = useAdminProcessWithdrawal();
  const createCategory = useAdminCreateCategory();
  const deleteCategory = useAdminDeleteCategory();

  const tabs = [
    { key: "stats", icon: BarChart3, label: t("stats") },
    { key: "users", icon: Users, label: t("users") },
    { key: "products", icon: ShoppingBag, label: t("products") },
    { key: "deals", icon: Briefcase, label: t("deals") },
    { key: "withdrawals", icon: Wallet, label: t("withdrawals") },
    { key: "categories", icon: Shield, label: t("categories") },
  ];

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold text-primary">{t("admin")}</h1>
      </div>

      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto">
        {tabs.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "default" : "secondary"} size="sm" onClick={() => setTab(t.key as any)} className="text-xs shrink-0 gap-1" data-testid={`admin-tab-${t.key}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      <div className="px-4">
        {tab === "stats" && stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("totalUsers"), value: stats.totalUsers },
              { label: t("totalProducts"), value: stats.totalProducts },
              { label: t("totalDeals"), value: stats.totalDeals },
              { label: t("revenue"), value: `${Number(stats.totalRevenue || 0).toLocaleString()} ₽` },
              { label: t("pendingWithdrawals"), value: stats.pendingWithdrawals },
              { label: t("activeDisputes"), value: stats.activeDisputes },
              { label: `${t("today")} ${t("deals").toLowerCase()}`, value: stats.todayDeals },
              { label: `${t("today")} ${t("register").toLowerCase()}`, value: stats.todayRegistrations },
            ].map((s, i) => (
              <div key={i} className="bg-card rounded-xl p-3 border border-border/30">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="flex flex-col gap-3">
            <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder={t("search")} data-testid="input-admin-user-search" />
            {usersData?.users?.map((u) => (
              <div key={u.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{u.username}</div>
                  <div className="text-[10px] text-muted-foreground">Balance: {Number(u.balance || 0).toLocaleString()} ₽</div>
                </div>
                <div className="flex gap-1.5">
                  {!u.isVerified && (
                    <Button size="sm" variant="secondary" className="text-xs h-7" onClick={() => verifyUser.mutate({ id: u.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) }) })} data-testid={`verify-${u.id}`}>
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant={u.isBanned ? "secondary" : "destructive"} className="text-xs h-7" onClick={() => banUser.mutate({ id: u.id, data: { banned: !u.isBanned } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) }) })} data-testid={`ban-${u.id}`}>
                    <Ban className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "products" && (
          <div className="flex flex-col gap-3">
            {productsData?.products?.map((p) => (
              <div key={p.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{Number(p.price).toLocaleString()} ₽ - {p.seller?.username}</div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" className="text-xs h-7 text-green-400" onClick={() => moderateProduct.mutate({ id: p.id, data: { status: "active" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey({}) }) })}>
                    <CheckCircle className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="secondary" className="text-xs h-7 text-red-400" onClick={() => moderateProduct.mutate({ id: p.id, data: { status: "rejected" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey({}) }) })}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "deals" && (
          <div className="flex flex-col gap-3">
            {dealsData?.deals?.map((d) => (
              <div key={d.id} className="bg-card rounded-xl border border-border/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">#{d.dealNumber}</span>
                  <Badge className="text-[10px]">{d.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-2">{d.buyer?.username} → {d.seller?.username} | {Number(d.amount).toLocaleString()} ₽</div>
                {d.status === "disputed" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="text-xs flex-1" onClick={() => resolveDeal.mutate({ id: d.id, data: { resolution: "refund_buyer" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListDealsQueryKey({}) }) })}>
                      {t("refundBuyer")}
                    </Button>
                    <Button size="sm" variant="secondary" className="text-xs flex-1" onClick={() => resolveDeal.mutate({ id: d.id, data: { resolution: "pay_seller" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListDealsQueryKey({}) }) })}>
                      {t("paySeller")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="flex flex-col gap-3">
            {withdrawals?.map((w) => (
              <div key={w.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{Number(w.amount).toLocaleString()} ₽</div>
                  <div className="text-[10px] text-muted-foreground">{w.description}</div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="text-xs h-7 bg-green-600" onClick={() => processWithdrawal.mutate({ id: w.id, data: { action: "approve" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() }) })}>
                    {t("approve")}
                  </Button>
                  <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => processWithdrawal.mutate({ id: w.id, data: { action: "reject" } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() }) })}>
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ))}
            {(!withdrawals || withdrawals.length === 0) && <div className="text-center py-8 text-muted-foreground text-sm">{t("noTransactions")}</div>}
          </div>
        )}

        {tab === "categories" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Name" className="flex-1" data-testid="input-cat-name" />
              <Input value={newCatSlug} onChange={(e) => setNewCatSlug(e.target.value)} placeholder="slug" className="flex-1" data-testid="input-cat-slug" />
              <Button size="icon" onClick={() => {
                if (newCatName && newCatSlug) {
                  createCategory.mutate({ data: { name: newCatName, slug: newCatSlug } }, {
                    onSuccess: () => { setNewCatName(""); setNewCatSlug(""); queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() }); },
                  });
                }
              }} data-testid="button-add-cat"><Plus className="w-4 h-4" /></Button>
            </div>
            {categories?.map((c) => (
              <div key={c.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.slug}</div>
                </div>
                <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => deleteCategory.mutate({ id: c.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() }) })} data-testid={`delete-cat-${c.id}`}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
