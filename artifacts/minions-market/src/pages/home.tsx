import { Link } from "wouter";
import { useGetCategories, getGetCategoriesQueryKey, useGetMarketplaceStats, getGetMarketplaceStatsQueryKey, useListProducts, getListProductsQueryKey, useGetFeaturedProducts, getGetFeaturedProductsQueryKey } from "@workspace/api-client-react";
import { useLang } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Star, Eye, Gamepad2, Coins, Shield, Rocket, Crown, Swords, ShoppingBag, Sparkles, Users, TrendingUp, Heart } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const categoryIcons: Record<string, typeof Gamepad2> = {
  "game-accounts": Gamepad2,
  "game-items": Swords,
  "game-currency": Coins,
  "boosting": Rocket,
  "services": Crown,
  "other": ShoppingBag,
};

function ProductCard({ product }: { product: any }) {
  return (
    <Link href={`/product/${product.id}`} className="block" data-testid={`card-product-${product.id}`}>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all duration-200 group">
        <div className="aspect-[4/3] bg-secondary/50 relative overflow-hidden">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gamepad2 className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
          {product.isPromoted && (
            <Badge className="absolute top-2 left-2 bg-primary/90 text-xs gap-1">
              <Sparkles className="w-3 h-3" /> TOP
            </Badge>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="font-semibold text-sm truncate text-foreground">{product.title}</h3>
          <div className="flex items-center justify-between">
            <span className="text-primary font-bold text-lg">{Number(product.price).toLocaleString()} ₽</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{product.views || 0}</span>
            </div>
          </div>
          {product.seller && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {product.seller.avatar ? <img src={product.seller.avatar} className="w-full h-full object-cover" /> : <span className="text-[8px]">{product.seller.username?.[0]?.toUpperCase()}</span>}
              </div>
              <span className="truncate">{product.seller.username}</span>
              {product.seller.rating && (
                <span className="flex items-center gap-0.5 text-yellow-500"><Star className="w-3 h-3 fill-current" />{Number(product.seller.rating).toFixed(1)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories, isLoading: catLoading } = useGetCategories({ query: { queryKey: getGetCategoriesQueryKey() } });
  const { data: stats } = useGetMarketplaceStats({ query: { queryKey: getGetMarketplaceStatsQueryKey() } });
  const { data: featured, isLoading: featuredLoading } = useGetFeaturedProducts({ query: { queryKey: getGetFeaturedProductsQueryKey() } });
  const { data: recent, isLoading: recentLoading } = useListProducts({ sort: "newest", limit: 8 }, { query: { queryKey: getListProductsQueryKey({ sort: "newest", limit: 8 }) } });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setLocation(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="gradient-primary px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-xl font-bold text-white mb-1">Minions Market</h1>
        <p className="text-white/70 text-sm mb-4">{t("secureDeal")}</p>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search")}
              className="pl-9 bg-background/90 border-0 h-10 rounded-xl"
              data-testid="input-search"
            />
          </div>
        </form>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 px-4">
          {[
            { icon: ShoppingBag, value: stats.totalProducts || 0, label: t("totalProducts") },
            { icon: Users, value: stats.totalUsers || 0, label: t("totalUsers") },
            { icon: TrendingUp, value: stats.totalDeals || 0, label: t("totalDeals") },
          ].map((s, i) => (
            <div key={i} className="bg-card rounded-xl p-3 border border-border/30 text-center">
              <s.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{s.value.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4">
        <h2 className="font-bold text-base mb-3">{t("allCategories")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {catLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : categories?.map((cat) => {
            const Icon = categoryIcons[cat.slug] || ShoppingBag;
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="bg-card rounded-xl p-3 border border-border/30 flex flex-col items-center gap-1.5 hover:border-primary/30 transition-colors"
                data-testid={`cat-${cat.slug}`}
              >
                <Icon className="w-6 h-6 text-primary" />
                <span className="text-xs font-medium text-center leading-tight">{cat.name}</span>
                {cat.productCount != null && <span className="text-[10px] text-muted-foreground">{cat.productCount}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {featured && featured.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> {t("featuredProducts")}
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {featuredLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="w-48 h-52 rounded-xl shrink-0" />) :
              featured.map((p) => (
                <div key={p.id} className="w-48 shrink-0">
                  <ProductCard product={p} />
                </div>
              ))
            }
          </div>
        </div>
      )}

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">{t("recentProducts")}</h2>
          <Link href="/catalog" className="text-xs text-primary font-medium">{t("all")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {recentLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />) :
            recent?.products?.map((p) => <ProductCard key={p.id} product={p} />)
          }
          {!recentLoading && (!recent?.products || recent.products.length === 0) && (
            <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">{t("noProducts")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
