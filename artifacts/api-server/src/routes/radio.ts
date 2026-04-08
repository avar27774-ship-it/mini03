import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

// Все станции с несколькими fallback URL
const STATIONS: Record<string, { name: string; urls: string[] }> = {
  "radio-record": {
    name: "Radio Record",
    urls: [
      "https://air.radiorecord.ru:8101/rr_320",
      "https://radiorecord.hostingradio.ru/rr96.aacp",
      "https://air2.radiorecord.ru:8101/rr_320",
    ],
  },
  "europa-plus": {
    name: "Europa Plus",
    urls: [
      "https://ep256.hostingradio.ru/ep256",
      "https://ep128.hostingradio.ru/ep128",
      "https://europaplus.hostingradio.ru/europaplus128.mp3",
    ],
  },
  "retro-fm": {
    name: "Retro FM",
    urls: [
      "https://retro.hostingradio.ru/retro96.aacp",
      "https://retrohost-32bit.cdnvideo.ru/retro128.mp3",
      "https://retro128.cdnvideo.ru/retro128",
    ],
  },
  "dfm": {
    name: "DFM",
    urls: [
      "https://dfm.hostingradio.ru/dfm128.mp3",
      "https://dfm96.hostingradio.ru/dfm96.aacp",
    ],
  },
  "mayak": {
    name: "Радио Маяк",
    urls: [
      "https://icecast.radiomayak.ru/mayak128.mp3",
      "https://mayak.hostingradio.ru/mayak96.aacp",
      "https://icecast.radiomayak.ru/mayak128",
    ],
  },
  "vesti-fm": {
    name: "Вести FM",
    urls: [
      "https://icecast.vesti.ru/vestifm_mp3_128kbps",
      "https://vedfm.cdnvideo.ru/vesti128.mp3",
    ],
  },
  "autoradio": {
    name: "Авторадио",
    urls: [
      "https://avtoradio.hostingradio.ru/avtoradio128.mp3",
      "https://avto.hostingradio.ru/avto96.aacp",
    ],
  },
  "dorozhnoe": {
    name: "Дорожное Радио",
    urls: [
      "https://dorozhnoe.hostingradio.ru/dorozhnoe128.mp3",
      "https://dorozhnoe96.hostingradio.ru/dorozhnoe96.aacp",
    ],
  },
  "monte-carlo": {
    name: "Radio Monte Carlo",
    urls: [
      "https://mc.hostingradio.ru/mc96.aacp",
      "https://mcradio.hostingradio.ru/mc128",
    ],
  },
  "hit-fm": {
    name: "Hit FM",
    urls: [
      "https://hitfm.hostingradio.ru/hitfm128.mp3",
      "https://hitfm96.hostingradio.ru/hitfm96.aacp",
    ],
  },
};

// Отдаём список станций фронтенду
router.get("/stations", (req, res) => {
  const list = Object.entries(STATIONS).map(([id, s]) => ({ id, name: s.name }));
  res.json(list);
});

// Прокси-стрим: браузер → наш сервер → радио-сервер
// Это решает CORS полностью, т.к. браузер обращается к нашему домену
router.get("/stream/:stationId", (req, res) => {
  const station = STATIONS[req.params.stationId];
  if (!station) {
    res.status(404).json({ message: "Station not found" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // отключаем буферизацию nginx если есть

  let urlIndex = 0;

  function tryUrl() {
    if (urlIndex >= station.urls.length) {
      if (!res.headersSent) {
        res.status(502).json({ message: "All stream URLs failed" });
      }
      return;
    }

    const targetUrl = station.urls[urlIndex++];
    const proto = targetUrl.startsWith("https") ? https : http;

    const proxyReq = proto.get(
      targetUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RadioProxy/1.0)",
          "Icy-MetaData": "1",
        },
        timeout: 8000,
      },
      (proxyRes) => {
        if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
          proxyReq.destroy();
          tryUrl();
          return;
        }

        // Прокидываем Content-Type от источника
        const ct = proxyRes.headers["content-type"] || "audio/mpeg";
        res.setHeader("Content-Type", ct);
        res.status(200);

        proxyRes.pipe(res);

        proxyRes.on("error", () => {
          if (!res.headersSent) tryUrl();
        });

        res.on("close", () => {
          proxyReq.destroy();
        });
      }
    );

    proxyReq.on("error", () => tryUrl());
    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      tryUrl();
    });
  }

  tryUrl();
});

export default router;
