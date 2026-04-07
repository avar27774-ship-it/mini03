import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X } from "lucide-react";

export default function SellPage() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [deliveryType, setDeliveryType] = useState("manual");
  const [deliveryData, setDeliveryData] = useState("");
  const [game, setGame] = useState("");
  const [server, setServer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const { data: categories } = useGetCategories({ query: { queryKey: getGetCategoriesQueryKey() } });
  const createProduct = useCreateProduct();

  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const addImage = () => {
    if (imageInput.trim() && !images.includes(imageInput.trim())) {
      setImages([...images, imageInput.trim()]);
      setImageInput("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !price || !category) return;

    createProduct.mutate({
      data: {
        title,
        description,
        price: parseFloat(price),
        category,
        deliveryType: deliveryType as any,
        deliveryData: deliveryData || undefined,
        game: game || undefined,
        server: server || undefined,
        tags,
        images,
      },
    }, {
      onSuccess: (product) => {
        toast({ title: t("productCreated") });
        setLocation(`/product/${product.id}`);
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold">{t("addProduct")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label>{t("title")} *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} data-testid="input-title" />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("description")} *</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("description")} className="min-h-[100px]" data-testid="input-description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>{t("price")} (₽) *</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" min="1" data-testid="input-price" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("category")} *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-category"><SelectValue placeholder={t("category")} /></SelectTrigger>
              <SelectContent>
                {categories?.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>{t("game")}</Label>
            <Input value={game} onChange={(e) => setGame(e.target.value)} placeholder={t("game")} data-testid="input-game" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("server")}</Label>
            <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder={t("server")} data-testid="input-server" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("deliveryType")}</Label>
          <Select value={deliveryType} onValueChange={setDeliveryType}>
            <SelectTrigger data-testid="select-delivery"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">{t("manual")}</SelectItem>
              <SelectItem value="auto">{t("auto")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {deliveryType === "auto" && (
          <div className="flex flex-col gap-2">
            <Label>Delivery Data</Label>
            <Textarea value={deliveryData} onChange={(e) => setDeliveryData(e.target.value)} placeholder="Data to deliver automatically" data-testid="input-delivery-data" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>{t("images")} (URL)</Label>
          <div className="flex gap-2">
            <Input value={imageInput} onChange={(e) => setImageInput(e.target.value)} placeholder="https://..." className="flex-1" data-testid="input-image-url" />
            <Button type="button" variant="secondary" size="icon" onClick={addImage}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-secondary">
                <img src={img} className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("tags")}</Label>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder={t("tags")} className="flex-1" data-testid="input-tag" />
            <Button type="button" variant="secondary" size="icon" onClick={addTag}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="bg-secondary text-xs px-2 py-1 rounded-md flex items-center gap-1">
                {tag}
                <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gradient-primary border-0" disabled={createProduct.isPending} data-testid="button-create-product">
          {createProduct.isPending ? t("loading") : t("create")}
        </Button>
      </form>
    </div>
  );
}
