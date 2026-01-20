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

const USERNAME = process.env.GITHUB_ACTOR;
const TOKEN = process.env.GITHUB_TOKEN;
const headers = TOKEN ? { Authorization: `token ${TOKEN}` } : {};

(async () => {
    let page = 1, repos = [], data;
    do {
        data = await fetch(`https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`, { headers })
            .then(r => r.json());
        repos = repos.concat(data);
        page++;
    } while(data.length === 100);

    const languageMap = {};
    for (const repo of repos) {
        const langs = await fetch(repo.languages_url, { headers }).then(r => r.json());
        for (const [lang, bytes] of Object.entries(langs)) {
            if (LANGUAGES.includes(lang)) {
                languageMap[lang] = (languageMap[lang] || 0) + bytes;
            }
        }
    }

    const totalBytes = Object.values(languageMap).reduce((a,b)=>a+b,0);

    const sortedLangs = Object.entries(languageMap)
        .filter(([_, bytes]) => bytes > 0)
        .sort((a,b)=>b[1]-a[1]);

    if(sortedLangs.length === 0) return;

    const svgWidth = 400;
    const barHeight = 12;
    const gap = 6;
    const textMargin = 120;
    const barMaxWidth = svgWidth - textMargin;
    let yOffset = 0;

    let svg = `<svg width="${svgWidth}" height="${sortedLangs.length * (barHeight + gap)}" xmlns="http://www.w3.org/2000/svg">`;

    sortedLangs.forEach(([lang, bytes]) => {
        const percent = (bytes / totalBytes) * 100;
        const color = COLORS[lang] || '#ededed';
        const width = Math.round((percent / 100) * barMaxWidth);
        svg += `
            <rect x="0" y="${yOffset}" width="${width}" height="${barHeight}" fill="${color}" rx="4" ry="4"/>
            <text x="${width + 5}" y="${yOffset + barHeight - 2}" font-family="Arial" font-size="10" fill="#000">
                ${lang} ${percent.toFixed(1)}%
            </text>
        `;
        yOffset += barHeight + gap;
    });

    svg += '</svg>';

    fs.writeFileSync('top-languages.svg', svg, 'utf8');
})();
