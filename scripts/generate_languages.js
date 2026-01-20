const fs = require('fs');
const fetch = require('node-fetch');

const LANGUAGES = [
  "Prolog","Python","JavaScript","Jupyter Notebook","PHP","R","Java","CSS","HTML",
  "C","C++","TypeScript","Swift","Kotlin","Ruby","Shell","Objective-C","Dart",
  "Scala","Hack","Rust","Go","PowerShell","Haskell","Perl","Groovy","MATLAB","CoffeeScript","Julia"
];

const COLORS = {
  "Prolog": "#0FA0FA","Python": "#3572A5","JavaScript": "#f1e05a","Jupyter Notebook": "#F37626",
  "PHP": "#4F5D95","R": "#198CE7","Java": "#b07219","CSS": "#563d7c","HTML": "#e34c26",
  "C": "#555555","C++": "#f34b7d","TypeScript": "#2b7489","Swift": "#ffac45",
  "Kotlin": "#A97BFF","Ruby": "#701516","Shell": "#89e051","Objective-C": "#438eff",
  "Dart": "#00B4AB","Scala": "#c22d40","Hack": "#000080","Rust": "#dea584",
  "Go": "#00ADD8","PowerShell": "#012456","Haskell": "#5e5086","Perl": "#0298c3",
  "Groovy": "#e69f56","MATLAB": "#e16737","Julia": "#a270ba"
};

const TEXT_COLORS = {
  light: '#24292f',
  dark: '#e6edf3'
};

const USERNAME = process.env.GITHUB_ACTOR;
const TOKEN = process.env.GITHUB_TOKEN;
const headers = TOKEN ? { Authorization: `token ${TOKEN}` } : {};


function countNotebookBytes(nb) {
  let bytes = 0;
  if (!nb.cells) return 0;

  for (const cell of nb.cells) {
    if (Array.isArray(cell.source)) {
      for (const line of cell.source) {
        bytes += Buffer.byteLength(line, 'utf8');
      }
    }
  }
  return bytes;
}

async function fetchAllContents(owner, repo, path = '') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  let files = [];
  for (const item of items) {
    if (item.type === 'file') {
      files.push(item);
    } else if (item.type === 'dir') {
      const sub = await fetchAllContents(owner, repo, item.path);
      files = files.concat(sub);
    }
  }
  return files;
}

function generateSVG(sortedLangs, totalBytes, textColor) {
  const svgWidth = 400;
  const barHeight = 12;
  const gap = 6;
  const textMargin = 120;
  const barMaxWidth = svgWidth - textMargin;

  let yOffset = 0;
  let svg = `<svg width="${svgWidth}"
                   height="${sortedLangs.length * (barHeight + gap)}"
                   xmlns="http://www.w3.org/2000/svg">`;

  for (const [lang, bytes] of sortedLangs) {
    const percent = (bytes / totalBytes) * 100;
    const width = Math.round((percent / 100) * barMaxWidth);
    const color = COLORS[lang] || '#ededed';

    svg += `
      <rect x="0" y="${yOffset}" width="${width}" height="${barHeight}"
            fill="${color}" rx="4" ry="4"/>
      <text x="${width + 6}" y="${yOffset + barHeight - 2}"
            font-family="Arial" font-size="10"
            fill="${textColor}">
        ${lang} ${percent.toFixed(1)}%
      </text>
    `;
    yOffset += barHeight + gap;
  }

  return svg + '</svg>';
}


(async () => {
  let page = 1, repos = [], data;
  do {
    data = await fetch(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`,
      { headers }
    ).then(r => r.json());
    repos = repos.concat(data);
    page++;
  } while (data.length === 100);

  const languageMap = {};

  for (const repo of repos) {
    const langs = await fetch(repo.languages_url, { headers }).then(r => r.json());

    for (const [lang, bytes] of Object.entries(langs)) {
      if (lang !== "Jupyter Notebook" && LANGUAGES.includes(lang)) {
        languageMap[lang] = (languageMap[lang] || 0) + bytes;
      }
    }

    if (langs["Jupyter Notebook"]) {
      const files = await fetchAllContents(USERNAME, repo.name);

      for (const file of files) {
        if (
          file.name.endsWith('.ipynb') &&
          file.download_url &&
          file.size < 7_000_000
        ) {
          try {
            const raw = await fetch(file.download_url).then(r => r.text());
            const nb = JSON.parse(raw);
            const nbBytes = countNotebookBytes(nb);
            languageMap["Jupyter Notebook"] =
              (languageMap["Jupyter Notebook"] || 0) + nbBytes;
          } catch {
          }
        }
      }
    }
  }

  const totalBytes = Object.values(languageMap).reduce((a, b) => a + b, 0);
  const sortedLangs = Object.entries(languageMap)
    .filter(([_, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!sortedLangs.length) return;

  fs.writeFileSync(
    'top-languages-light.svg',
    generateSVG(sortedLangs, totalBytes, TEXT_COLORS.light),
    'utf8'
  );

  fs.writeFileSync(
    'top-languages-dark.svg',
    generateSVG(sortedLangs, totalBytes, TEXT_COLORS.dark),
    'utf8'
  );
})();
