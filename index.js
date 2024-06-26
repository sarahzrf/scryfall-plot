import { Chart } from "chart.js";

function pause(delay) {
    return new Promise((res, rej) => setTimeout(res, delay));
}

class ScryfallError extends Error {
    constructor(page) {
        super(page.details || page.warnings[0]);
        this.name = this.constructor.name;
    }
}

async function* get_list(uri, delay = 750) {
    while (true) {
        // TODO just how much error handling do I want?
        const resp = await fetch(uri),
            page = await resp.json();
        if (page.object === "error" ||
            (page.total_cards > 1000 && page.warnings instanceof Array)) {
            throw new ScryfallError(page);
        }
        for (const item of page.data) yield item;
        if (!page.has_more) return;
        uri = page.next_page;
        await pause(delay);
    }
}

const SCRYFALL_SEARCH = "https://api.scryfall.com/cards/search";
function search(qu) {
    return get_list(SCRYFALL_SEARCH + "?" + new URLSearchParams(qu));
}

function params(q, unique) {
    if (unique === "cards") q = "is:first-printing " + q;
    return {q, unique};
}

const year_counts = new Map();
async function year_count(year, unique) {
    const k = [year, unique];
    if (year_counts.has(k)) return year_counts.get(k);
    const qu = params("year=" + year.toString(10), unique),
          uri = SCRYFALL_SEARCH + "?" + new URLSearchParams(qu),
          resp = await fetch(uri),
          page = await resp.json();
    if (page.object === "error") throw new ScryfallError(page);
    year_counts.set(k, page.total_cards);
    return page.total_cards;
}

async function build_histo(qu, percent) {
    const histo = new Map();
    let min_year = Infinity,
        max_year = 0;
    for await (const card of search(qu)) {
        const y = parseInt(card.released_at.slice(0, 4), 10);
        histo.set(y, (histo.get(y) || 0) + 1);
        min_year = Math.min(min_year, y);
        max_year = Math.max(max_year, y);
    }
    if (percent) {
        for (const [y, count] of histo) {
            histo.set(y, 100 * count / await year_count(y, qu.unique));
        }
    }
    return {histo, min_year, max_year};
}

function get_query() {
    const dat = new FormData(document.querySelector("#form"));
    let q = dat.get("query");
    const unique = dat.get("unique");
    if (!q || !q.trim() || !unique) return undefined;
    q = q.trim();
    return params(q, unique);
}

function do_submit(e) {
    e.preventDefault();
    const qu = get_query();
    if (typeof qu === "undefined") return;
    const inp = document.querySelector("#inputs"),
        thr = document.querySelector("#throbber");
    inp.disabled = true;
    thr.style.display = "inline-block";
    const percent = document.querySelector("#percent").checked;
    build_histo(qu, percent).then(results => {
        do_plot(results);
    }, err => {
        if (err instanceof ScryfallError) {
            // TODO something better
            alert(err.message);
        }
        else {
            console.error(err);
        }
    }).finally(() => {
        inp.disabled = false;
        thr.style.display = "none";
    });
}

function build_data(results) {
    const {histo, min_year, max_year} = results;
    const labels = [], data = [];
    for (var y = min_year; y <= max_year; y++) {
        labels.push(y.toString(10));
        data.push(histo.get(y) || 0);
    }
    return {labels, datasets: [{label: "number of cards", data}]};
}

function do_plot(results) {
    const data = build_data(results);
    if (typeof window.chart !== "undefined") {
        window.chart.data = data;
        window.chart.update();
    }
    else {
        const ctx = document.querySelector("#results");
        window.chart = new Chart(ctx, {
            type: "bar",
            data,
            options: {}
        });
    }
}

window.addEventListener("load", () => {
    document.querySelector("#form").addEventListener("submit", do_submit);
});

