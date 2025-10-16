import express from "express";
import cors from "cors";
import { scrapeCompilationLinks } from "./scraper.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

function parseMonthYear(mmyyyy) {
  if (typeof mmyyyy !== "string") return null;
  const match = mmyyyy.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  // JS Date months are 0-based
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

app.get("/compilations", async (req, res) => {
  const startedAt = Date.now();
  const { from = '01/2025', to = '12/2025' } = req.query;
  console.log(`[GET] /compilations - start from=${from || ""} to=${to || ""}`);
  try {
    let range = undefined;
    if (from || to) {
      const fromRange = from ? parseMonthYear(from) : null;
      const toRange = to ? parseMonthYear(to) : null;
      if ((from && !fromRange) || (to && !toRange)) {
        return res.status(400).json({ error: "Invalid date format. Use mm/yyyy" });
      }
      const start = fromRange ? fromRange.start : undefined;
      const end = toRange ? toRange.end : undefined;
      if (start && end && start > end) {
        return res.status(400).json({ error: "from must be <= to" });
      }
      range = { start, end };
    }

    const data = await scrapeCompilationLinks(range);
    const durationMs = Date.now() - startedAt;
    console.log(`[GET] /compilations - success count=${data.length} durationMs=${durationMs}`);
    res.json({ count: data.length, items: data, durationMs });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(`[GET] /compilations - error durationMs=${durationMs}`, error);
    res.status(500).json({ error: error.message || "Failed to scrape", durationMs });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


