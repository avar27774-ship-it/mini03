import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Globe } from "lucide-react";

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { isAuthenticated, user, updateUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [bio, setBio] = useState(user?.bio || "");

  const updateProfile = useUpdateProfile();

  if (!isAuthenticated) { setLocation("/auth"); return null; }

  const handleSave = () => {
    updateProfile.mutate({ data: { firstName: firstName || undefined, lastName: lastName || undefined, avatar: avatar || undefined, bio: bio || undefined } }, {
      onSuccess: (updated) => {
        updateUser(updated);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: t("profileUpdated") });
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold">{t("settings")}</h1>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-4">
          <h2 className="font-semibold">{t("editProfile")}</h2>
          <div className="flex flex-col gap-2">
            <Label>{t("firstName")}</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-firstname" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("lastName")}</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-lastname" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("avatar")} (URL)</Label>
            <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." data-testid="input-avatar" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("bio")}</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} data-testid="input-bio" />
          </div>
          <Button onClick={handleSave} disabled={updateProfile.isPending} className="gradient-primary border-0" data-testid="button-save-profile">
            {updateProfile.isPending ? t("loading") : t("save")}
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> {t("language")}</h2>
          <div className="flex gap-2">
            <Button variant={lang === "ru" ? "default" : "secondary"} size="sm" onClick={() => setLang("ru")} data-testid="button-lang-ru">{t("ru")}</Button>
            <Button variant={lang === "en" ? "default" : "secondary"} size="sm" onClick={() => setLang("en")} data-testid="button-lang-en">{t("en")}</Button>
          </div>
        </div>

        <Button variant="destructive" className="w-full" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" /> {t("logout")}
        </Button>
      </div>
    </div>
  );
}
