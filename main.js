const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')();
const fs = require('fs').promises;

const sleep = ms => new Promise(r => setTimeout(r, ms));

//save cookie function
const saveCookie = async (page) => {
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies, null, 2);
    await fs.writeFile('./cookies.json', cookieJson);
}

//load cookie function
const loadCookie = async (page) => {
    const cookieJson = await fs.readFile('./cookies.json');
    const cookies = JSON.parse(cookieJson);
    await page.setCookie(...cookies);
}

async function waitAndClick(page, name) {
    await page.waitForSelector(name);
    await page.click(name);
}

async function get_moves(page) {
    return await page.$eval("vertical-move-list", (list) => {
        const moves = list.querySelectorAll(".move");
        const data = [];

        for (let i = 0; i < moves.length; i++) {
            let move = moves[i];
            data[i] = [];

            for (let y = 0; y < move.children.length; y++) {
                let child = move.children[y];
                data[i][y] = {color: child.classList[0], pos: child.innerText};
            }
        }
        return data;
    });
}

const num_to_pos = (s) => {
    return ["a", "b", "c", "d", "e", "f", "g", "h"][parseInt(s[0] - 1)] + s[1];
}
const highlight_pos = (h) => {
    const a = [];
    for (let i = 0; i < h.length; i++) {
        a[i] = num_to_pos(h[i]);
    }
    return a;
}

async function get_highlights(page) {
    return await page.$eval(".board", (board) => {
        let data = [];
        let highlights = board.querySelectorAll(".highlight");
        for (let i = 0; i < highlights.length; i++) {
            data[i] = highlights[i].classList[1].substring(7);
        }
        return data;
    });
}

async function feedback_game(page, game) {
    await page.waitForSelector("vertical-move-list");

    let last = [];
    while (true) {
        let moves = await get_moves(page);
        if (last.toString() == moves.toString()) continue;
        else last = moves;

        let last_moves = moves[moves.length - 1];
        if (last_moves == undefined) { console.log("last moves undefined"); break; } 
        let last_move = last_moves[last_moves.length - 1];

        console.log(last_move);

        let highlights = await get_highlights(page);
        let charmove = highlight_pos(highlights);

        const place = await page.evaluate((piece)=> {
            return document.querySelector(".board").querySelector(".piece.square-" + piece);
        }, highlights[0]);

        if (place == null) {
            game.click(".square-" + highlights[0]);
            await game.waitForSelector(".square-" + highlights[1]);
            await sleep(10);
            game.click(".square-" + highlights[1]);
            await sleep(50);

            console.log(last_move.color + ": " + highlights[0] + " -> " + highlights[1]);
        }
        else {
            game.click(".square-" + highlights[1]);
            await game.waitForSelector(".square-" + highlights[0]);
            await sleep(10);
            game.click(".square-" + highlights[0]);
            await sleep(50);

            console.log(last_move.color + ": " + highlights[1] + " -> " + highlights[0]);
            //await sleep(5000);
            //console.log(last_move.color + ": " + highlights[1] + " -> " + highlights[0]);
        }

        //page.click('.square-57');
        //await sleep(5000);
        //page.click('.square-55');

        /*if (last_move.pos == "O-O") {
            const place = await page.evaluate((piece)=> {
                return document.querySelector(".board").querySelector(".piece.square-" + piece);
            }, highlights[0]);

            if (place == null)
                console.log(last_move.color + ": " + charmove[0] + " -> " + charmove[1]);
            else
                console.log(last_move.color + ": " + charmove[1] + " -> " + charmove[0]);
        }
        else
            if (last_move.pos.includes(charmove[0]))
                console.log(last_move.color + ": " + charmove[1] + " -> " + charmove[0] + " (" + last_move.pos + ")");
            else
                console.log(last_move.color + ": " + charmove[0] + " -> " + charmove[1] + " (" + last_move.pos + ")");*/
    }
}

(async() => {
    const player = await puppeteer.launch({defaultViewport: null, headless: false, args: [ "--start-maximized" ]});
    const game = await player.newPage();
    await loadCookie(game);
    await game.goto("https://www.chess.com/");
    prompt("continue when logged in.");
    await saveCookie(game);
    

    const browser = await puppeteer.launch({defaultViewport: null, headless: false, args: [ "--start-maximized" ]});
    const page = await browser.newPage();
    await page.goto("https://www.chess.com/play/computer");

    /*await page.waitForSelector("#username");
    await page.$eval("#username", el => el.value = "nick.notwaeeb@gmail.com");
    await page.$eval("#password", el => el.value = "Robot123");
    await page.click("#_remember_me");
    await page.click("#login");

    //await page.waitForNavigation(); */

    await waitAndClick(page, ".ui_outside-close-component");
    //await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/212792427.43bc219b.200x200o.48fe7b579d3a.png']"); //mewtens
    await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/232238735.11a67669.200x200o.98859ab5ec43.png']"); // agent chess
    //await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/109757776.54a6d484.200x200o.aadc7de54ee7.png']"); // danya
    await waitAndClick(page, ".ui_v5-button-component.ui_v5-button-primary.ui_v5-button-large.selection-menu-button");
    
    const play = prompt("what are they playing as? ") == "b" ? "black" : "white"; 
    await waitAndClick(page, "[data-cy='" + play + "']");

    await waitAndClick(page, ".ui_v5-button-component.ui_v5-button-primary.ui_v5-button-large.ui_v5-button-full");

    //const moves = await get_moves(page);
    //console.log(moves);

    feedback_game(page, game);
    feedback_game(game, page);


    // dont do this while loop as highlgihts occur when selecting a or right clicking board. for right clcik you can check color.
    // loop vertical move list board-vs-personalities and check for change either in new move class (queryselectorall and find last move class) or a new node within that div

    // need to do when pawn reaches other side and become queen

    //let a = await page.evaluate(() => document.querySelector(".button.auth.login.ui_v5-button-component.ui_v5-button-primary.login-modal-trigger").click())
})();

console.log('hello world g uys!');
