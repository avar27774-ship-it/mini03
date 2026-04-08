import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Radio, Play, Pause, ArrowLeft, Volume2, VolumeX, Loader2 } from "lucide-react";

const stations = [
  {
    id: "radio-record",
    name: "Radio Record",
    description: "Лучший EDM и dance из России",
    // Используем публичный CORS-прокси для стрима
    url: "https://air.radiorecord.ru:8101/rr_320",
    fallback: "https://radiorecord.hostingradio.ru/rr96.aacp",
    emoji: "🎧",
  },
  {
    id: "europa-plus",
    name: "Europa Plus",
    description: "Популярная русская музыка 24/7",
    url: "https://ep128.hostingradio.ru/ep128",
    fallback: "https://europaplus.hostingradio.ru/europaplus128.mp3",
    emoji: "🌍",
  },
  {
    id: "retro-fm",
    name: "Retro FM",
    description: "Хиты из 80–90-х и ностальгия",
    url: "https://retro.hostingradio.ru/retro96.aacp",
    fallback: "https://retrohost-32bit.cdnvideo.ru/retro128.mp3",
    emoji: "💿",
  },
  {
    id: "dfm",
    name: "DFM",
    description: "Танцевальные хиты и радио-лидеры",
    url: "https://dfm.hostingradio.ru/dfm128.mp3",
    fallback: "https://dfm.hostingradio.ru/dfm128",
    emoji: "🎚️",
  },
  {
    id: "mayak",
    name: "Радио Маяк",
    description: "Классика радио и новости",
    url: "https://icecast.radiomayak.ru/mayak128.mp3",
    fallback: "https://icecast.radiomayak.ru/mayak128",
    emoji: "🕯️",
  },
  {
    id: "autoradio",
    name: "Авторадио",
    description: "Популярные хиты на дороге",
    url: "https://avtoradio.hostingradio.ru/avtoradio128.mp3",
    fallback: "https://avtoradio.hostingradio.ru/avtoradio128",
    emoji: "🚗",
  },
  {
    id: "dorozhnoe",
    name: "Дорожное Радио",
    description: "Радио на все случаи пути",
    url: "https://dorozhnoe.hostingradio.ru/dorozhnoe128.mp3",
    fallback: "https://dorozhnoe.hostingradio.ru/dorozhnoe128",
    emoji: "🛣️",
  },
  {
    id: "hit-fm",
    name: "Hit FM",
    description: "Топовые российские треки",
    url: "https://hitfm.hostingradio.ru/hitfm128.mp3",
    fallback: "https://hitfm.hostingradio.ru/hitfm128",
    emoji: "🔥",
  },
];

export default function RadioPage() {
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState(stations[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedStation = stations.find((s) => s.id === selectedId) || stations[0];

  // Инициализация audio элемента
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;

    audio.addEventListener("playing", () => {
      setIsLoading(false);
      setIsPlaying(true);
      setError(null);
    });
    audio.addEventListener("waiting", () => setIsLoading(true));
    audio.addEventListener("pause", () => {
      setIsPlaying(false);
      setIsLoading(false);
    });
    audio.addEventListener("error", () => {
      // Пробуем fallback URL
      const station = stations.find((s) => s.id === selectedId);
      if (station?.fallback && audio.src !== station.fallback) {
        audio.src = station.fallback;
        audio.load();
        audio.play().catch(() => {
          setIsLoading(false);
          setIsPlaying(false);
          setError("Не удалось подключиться к стриму");
        });
      } else {
        setIsLoading(false);
        setIsPlaying(false);
        setError("Не удалось подключиться к стриму");
      }
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Смена станции
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = isPlaying;
    audio.pause();
    audio.src = selectedStation.url;
    audio.load();
    setError(null);
    if (wasPlaying) {
      setIsLoading(true);
      audio.play().catch(() => {
        setIsLoading(false);
        setIsPlaying(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying || isLoading) {
      audio.pause();
      setIsPlaying(false);
      setIsLoading(false);
    } else {
      if (!audio.src || audio.src === window.location.href) {
        audio.src = selectedStation.url;
        audio.load();
      }
      setIsLoading(true);
      setError(null);
      audio.play().catch(() => {
        setIsLoading(false);
        setIsPlaying(false);
        setError("Не удалось воспроизвести");
      });
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const selectStation = (id: string) => {
    setSelectedId(id);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur px-4 pt-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{t("radio")}</h1>
            <p className="text-xs text-muted-foreground">{t("liveRadio")}</p>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="bg-card rounded-3xl border border-border/40 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-primary/10 text-primary w-14 h-14 flex items-center justify-center text-2xl">
              {selectedStation.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-[0.2em] text-primary">{t("radioTop10")}</span>
              </div>
              <h2 className="text-xl font-semibold">{selectedStation.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedStation.description}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-background p-4 border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("nowPlaying")}</p>
                <p className="font-medium text-sm mt-1 truncate">{selectedStation.name}</p>
                {error ? (
                  <p className="text-xs text-destructive mt-1">{error}</p>
                ) : isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Подключение...</p>
                ) : isPlaying ? (
                  <p className="text-xs text-primary mt-1">● В эфире</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">{selectedStation.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button variant="secondary" size="icon" onClick={togglePlay} disabled={false}>
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4">
        <h2 className="font-bold text-base mb-3">{t("topRadio")}</h2>
        <div className="grid gap-3">
          {stations.map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => selectStation(station.id)}
              className={`w-full rounded-3xl border p-4 text-left transition ${
                station.id === selectedId
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 text-primary w-12 h-12 flex items-center justify-center text-xl">
                  {station.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{station.name}</span>
                    {station.id === selectedId && isPlaying && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-primary">{t("playing")}</span>
                    )}
                    {station.id === selectedId && isLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{station.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
