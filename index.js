import * as Scry from "scryfall-sdk";
import { Chart } from "chart.js";

async function search(q) {
    const histo = new Map();
    let min_year = Infinity,
        max_year = 0;
    for await (const card of Scry.Cards.search(q).all()) {
        const y = parseInt(card.released_at.slice(0, 4), 10);
        histo.set(y, (histo.get(y) || 0) + 1);
        min_year = Math.min(min_year, y);
        max_year = Math.max(max_year, y);
    }
    return {histo, min_year, max_year};
}

function get_query() {
    const q0 = document.querySelector("#query").value,
          fp = document.querySelector("#firstprint").checked;
    return fp ? "is:first-printing " + q0 : q0;
}

function do_submit(e) {
    e.preventDefault();
    const q = get_query(),
          thr = document.querySelector("#throbber");
    thr.style.display = "inline-block";
    // TODO report API errors?
    search(q).then(results => {
        do_plot(results);
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

