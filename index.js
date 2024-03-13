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
function search(q) {
    return get_list(SCRYFALL_SEARCH + "?" + new URLSearchParams({q}));
}
window.search = search;

async function build_histo(q) {
    const histo = new Map();
    let min_year = Infinity,
        max_year = 0;
    for await (const card of search(q)) {
        const y = parseInt(card.released_at.slice(0, 4), 10);
        histo.set(y, (histo.get(y) || 0) + 1);
        min_year = Math.min(min_year, y);
        max_year = Math.max(max_year, y);
    }
    return {histo, min_year, max_year};
}

function get_query() {
    const q0 = document.querySelector("#query").value.trim();
    if (q0 === "") return undefined;
    const fp = document.querySelector("#firstprint").checked;
    return fp ? "is:first-printing " + q0 : q0;
}

function do_submit(e) {
    e.preventDefault();
    const q = get_query();
    if (typeof q === "undefined") return;
    const thr = document.querySelector("#throbber");
    thr.style.display = "inline-block";
    build_histo(q).then(results => {
        do_plot(results);
    }, err => {
        if (err instanceof ScryfallError) {
            // TODO something better
            alert(err.message);
        }
    }).finally(() => {
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

