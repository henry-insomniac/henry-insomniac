#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const USERNAME = "henry-insomniac";
const DEFAULT_OUT = "assets/profile-dashboard.svg";

const palette = {
  bg: "#0d1117",
  panel: "#161b22",
  panel2: "#1f2937",
  line: "#30363d",
  text: "#f0f6fc",
  muted: "#8b949e",
  blue: "#58a6ff",
  green: "#3fb950",
  yellow: "#d29922",
  red: "#f85149",
  violet: "#bc8cff",
  cyan: "#39c5cf"
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out ?? DEFAULT_OUT;
  const user = args.user
    ? JSON.parse(await readFile(args.user, "utf8"))
    : await fetchJson(`https://api.github.com/users/${USERNAME}`);
  const repos = args.repos
    ? JSON.parse(await readFile(args.repos, "utf8"))
    : await fetchAllRepos(USERNAME);

  const metrics = buildMetrics(user, repos);
  const svg = renderDashboard(metrics);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${svg}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

async function fetchAllRepos(username) {
  const repos = [];

  for (let page = 1; page < 10; page += 1) {
    const batch = await fetchJson(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated&page=${page}`
    );

    repos.push(...batch);

    if (batch.length < 100) {
      break;
    }
  }

  return repos;
}

async function fetchJson(url) {
  const headers = {
    "User-Agent": "henry-insomniac-profile-generator",
    Accept: "application/vnd.github+json"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${url}`);
  }

  return response.json();
}

function buildMetrics(user, repos) {
  const totalRepos = repos.length;
  const originalRepos = repos.filter((repo) => !repo.fork);
  const forkedRepos = repos.filter((repo) => repo.fork);
  const totalStars = repos.reduce((sum, repo) => sum + numeric(repo.stargazers_count), 0);
  const languages = summarizeLanguages(repos);
  const recentRepos = repos
    .toSorted((a, b) => timestamp(b.pushed_at ?? b.updated_at) - timestamp(a.pushed_at ?? a.updated_at))
    .slice(0, 6);
  const featuredRepos = repos
    .filter((repo) => !repo.fork)
    .toSorted((a, b) => {
      const byStars = numeric(b.stargazers_count) - numeric(a.stargazers_count);
      if (byStars !== 0) {
        return byStars;
      }
      return timestamp(b.pushed_at ?? b.updated_at) - timestamp(a.pushed_at ?? a.updated_at);
    })
    .slice(0, 5);
  const activeSince = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const activeRecent = repos.filter((repo) => timestamp(repo.pushed_at ?? repo.updated_at) >= activeSince).length;
  const productized = originalRepos.filter((repo) => hasProductSignal(repo)).length;

  return {
    user: {
      name: user.name || user.login || USERNAME,
      login: user.login || USERNAME,
      blog: cleanUrl(user.blog),
      location: user.location || "Chengdu"
    },
    totals: {
      totalRepos,
      original: originalRepos.length,
      forked: forkedRepos.length,
      totalStars
    },
    signals: [
      {
        label: "Originality",
        value: percent(originalRepos.length, totalRepos),
        detail: `${originalRepos.length} original`
      },
      {
        label: "Momentum",
        value: clamp(Math.round((activeRecent / Math.max(totalRepos, 1)) * 100), 8, 100),
        detail: `${activeRecent} active in 90d`
      },
      {
        label: "Stack Breadth",
        value: clamp(languages.length * 18, 10, 100),
        detail: `${languages.length} main stacks`
      },
      {
        label: "Product Shape",
        value: clamp(percent(productized, Math.max(originalRepos.length, 1)), 8, 100),
        detail: `${productized} public surfaces`
      }
    ],
    languages,
    recentRepos,
    featuredRepos
  };
}

function summarizeLanguages(repos) {
  const counts = new Map();

  for (const repo of repos) {
    const language = repo.language || "Unknown";
    if (language === "Unknown") {
      continue;
    }

    const current = counts.get(language) ?? { name: language, count: 0, stars: 0 };
    current.count += 1;
    current.stars += numeric(repo.stargazers_count);
    counts.set(language, current);
  }

  return [...counts.values()]
    .toSorted((a, b) => {
      const byCount = b.count - a.count;
      if (byCount !== 0) {
        return byCount;
      }
      return b.stars - a.stars;
    })
    .slice(0, 6);
}

function renderDashboard(metrics) {
  const { user, totals, signals, languages, recentRepos, featuredRepos } = metrics;
  const languageMax = Math.max(...languages.map((language) => language.count), 1);
  const languageRows = languages
    .map((language, index) => renderLanguageRow(language, index, languageMax))
    .join("");
  const recentRows = recentRepos.map((repo, index) => renderRecentRow(repo, index)).join("");
  const featuredRows = featuredRepos.map((repo, index) => renderFeaturedRow(repo, index)).join("");
  const signalRows = signals.map((signal, index) => renderSignalLegend(signal, index)).join("");
  const rings = signals.map((signal, index) => renderSignalRing(signal, index)).join("");

  return `<svg width="1200" height="680" viewBox="0 0 1200 680" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">HenryHou GitHub profile dashboard</title>
  <desc id="desc">A data-driven GitHub profile dashboard with repository metrics, builder signal ring, language distribution, recent work, and featured projects.</desc>
  <rect width="1200" height="680" rx="0" fill="${palette.bg}"/>
  <rect x="32" y="32" width="1136" height="616" rx="8" fill="${palette.panel}" stroke="${palette.line}"/>

  <g transform="translate(72 72)">
    <text x="0" y="0" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="34" font-weight="700">${escapeXml(user.name)} / ${escapeXml(user.login)}</text>
    <text x="0" y="38" fill="${palette.blue}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="19" font-weight="600">Building agent-first personal software</text>
    <text x="0" y="68" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15">Local AI runtimes · Knowledge systems · Native macOS/iOS tools · Developer workflow infrastructure</text>
    <text x="0" y="101" fill="${palette.green}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14">${escapeXml(user.location)} · ${escapeXml(user.blog || "yi-flow.com")}</text>
  </g>

  ${renderMetricCard(72, 210, `${totals.totalRepos}`, "public repos", palette.blue)}
  ${renderMetricCard(252, 210, `${totals.original}`, "original", palette.green)}
  ${renderMetricCard(432, 210, `${totals.totalStars}`, "repo stars", palette.yellow)}
  ${renderMetricCard(612, 210, `${totals.forked}`, "forks tracked", palette.violet)}

  <g transform="translate(72 340)">
    <rect x="0" y="0" width="416" height="248" rx="8" fill="${palette.bg}" stroke="${palette.line}"/>
    <text x="28" y="40" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="19" font-weight="700">Builder Signal</text>
    <text x="28" y="66" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">Public GitHub signals, not a vanity score.</text>
    <g transform="translate(42 92)">
      <circle cx="72" cy="72" r="62" stroke="${palette.line}" stroke-width="10"/>
      <circle cx="72" cy="72" r="48" stroke="${palette.line}" stroke-width="10"/>
      <circle cx="72" cy="72" r="34" stroke="${palette.line}" stroke-width="10"/>
      <circle cx="72" cy="72" r="20" stroke="${palette.line}" stroke-width="10"/>
      ${rings}
    </g>
    <g transform="translate(206 86)">
      ${signalRows}
    </g>
  </g>

  <g transform="translate(520 340)">
    <rect x="0" y="0" width="280" height="248" rx="8" fill="${palette.bg}" stroke="${palette.line}"/>
    <text x="24" y="40" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="19" font-weight="700">Language Map</text>
    <text x="24" y="66" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">Primary languages by public repo count.</text>
    <g transform="translate(24 92)">
      ${languageRows}
    </g>
  </g>

  <g transform="translate(832 72)">
    <rect x="0" y="0" width="280" height="236" rx="8" fill="${palette.bg}" stroke="${palette.line}"/>
    <text x="24" y="40" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="19" font-weight="700">Recent Work</text>
    <text x="24" y="66" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">Latest public pushes.</text>
    <g transform="translate(24 94)">
      ${recentRows}
    </g>
  </g>

  <g transform="translate(832 340)">
    <rect x="0" y="0" width="280" height="248" rx="8" fill="${palette.bg}" stroke="${palette.line}"/>
    <text x="24" y="40" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="19" font-weight="700">Featured Projects</text>
    <text x="24" y="66" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">Highest-signal original repos.</text>
    <g transform="translate(24 94)">
      ${featuredRows}
    </g>
  </g>
</svg>`;
}

function renderMetricCard(x, y, value, label, color) {
  return `<g transform="translate(${x} ${y})">
    <title>${escapeXml(value)} ${escapeXml(label)}</title>
    <rect x="0" y="0" width="148" height="86" rx="8" fill="${palette.bg}" stroke="${palette.line}"/>
    <text x="22" y="38" fill="${color}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="28" font-weight="800">${escapeXml(value)}</text>
    <text x="22" y="62" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">${escapeXml(label)}</text>
  </g>`;
}

function renderSignalRing(signal, index) {
  const colors = [palette.green, palette.blue, palette.violet, palette.yellow];
  const radii = [62, 48, 34, 20];
  const strokeWidths = [10, 10, 10, 10];
  const dashOffset = 25;

  return `<circle cx="72" cy="72" r="${radii[index]}" pathLength="100" stroke="${colors[index]}" stroke-width="${strokeWidths[index]}" stroke-linecap="round" stroke-dasharray="${signal.value} ${100 - signal.value}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 72 72)"/>`;
}

function renderSignalLegend(signal, index) {
  const colors = [palette.green, palette.blue, palette.violet, palette.yellow];
  const y = index * 38;

  return `<g transform="translate(0 ${y})">
    <circle cx="6" cy="6" r="5" fill="${colors[index]}"/>
    <text x="20" y="10" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13" font-weight="600">${escapeXml(signal.label)}</text>
    <text x="20" y="27" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11">${signal.value}% · ${escapeXml(signal.detail)}</text>
  </g>`;
}

function renderLanguageRow(language, index, max) {
  const colors = [palette.blue, palette.green, palette.yellow, palette.violet, palette.cyan, palette.red];
  const y = index * 24;
  const width = Math.max(20, Math.round((language.count / max) * 126));

  return `<g transform="translate(0 ${y})">
    <text x="0" y="12" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">${escapeXml(language.name)}</text>
    <rect x="104" y="2" width="132" height="10" rx="5" fill="${palette.panel2}"/>
    <rect x="104" y="2" width="${width}" height="10" rx="5" fill="${colors[index % colors.length]}"/>
    <text x="246" y="12" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12">${language.count}</text>
  </g>`;
}

function renderRecentRow(repo, index) {
  const y = index * 22;
  const label = truncate(repo.name, 25);

  return `<g transform="translate(0 ${y})">
    <circle cx="5" cy="6" r="4" fill="${palette.blue}"/>
    <text x="18" y="10" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12">${escapeXml(label)}</text>
    <text x="232" y="10" text-anchor="end" fill="${palette.muted}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11">${escapeXml(repo.language || "Docs")}</text>
  </g>`;
}

function renderFeaturedRow(repo, index) {
  const y = index * 26;
  const label = truncate(repo.name, 24);
  const stars = numeric(repo.stargazers_count);

  return `<g transform="translate(0 ${y})">
    <text x="0" y="12" fill="${palette.text}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="600">${escapeXml(label)}</text>
    <text x="232" y="12" text-anchor="end" fill="${palette.yellow}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12">${stars} stars</text>
  </g>`;
}

function hasProductSignal(repo) {
  return Boolean(cleanUrl(repo.homepage) || repo.has_pages || repo.has_wiki || repo.license);
}

function percent(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function timestamp(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

function cleanUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\/$/, "");
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
