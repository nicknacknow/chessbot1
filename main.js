const puppeteer = require('puppeteer');
const { isGeneratorFunction } = require('util/types');
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

// need proper good way of checking if game is over... prob just check chat for game over thing and if rematch find number of times 
async function is_game_over(page) { // pop-up when game over: .modal-game-over-component ............... when it says game over check in chat if there is a new game after.. if there is then invalid game over prompt
    return await page.evaluate(() => {
        let modal = document.querySelector("#game-over-modal");
        return (modal && (modal.firstChild && ((modal.firstChild.classList && modal.firstChild.classList[0]) && modal.firstChild.classList[0] == "modal-chessboard-container-component")));
    });
}

async function get_moves(page) { // excude time- here
    await page.waitForSelector("vertical-move-list"); // evaluate and find vertical-move-list in here
    return await page.$eval("vertical-move-list", (list) => {
        const moves = list.querySelectorAll(".move");
        const data = [];

        for (let i = 0; i < moves.length; i++) {
            let move = moves[i];
            data[i] = [];
            
            for (let y = 0; y < move.children.length; y++) {
                let child = move.children[y];
                if (child.classList[0].substring(0, 4) == "time") continue;
                data[i][y] = {color: child.classList[0], pos: child.innerText};
            }
            let result = move.querySelector(".game-result");
            if (result) {
                data[i][data[i].length - 1] = {color: result.classList[0], pos: result.innerText, result: true};
            }
        }
        return data;
    });
}

async function get_last_move(page) {
    let moves = await get_moves(page);
    let last_moves = moves[moves.length - 1];
    if (last_moves == undefined) return;
    return last_moves[last_moves.length - 1];
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


// when bot checkmates, does not return and does not play on real game
// add new parameter for bot-played game so if real game ends so does bot game? press resign button against bot for instant game over
async function feedback_game(page, game) {
    let last = [];
    await page.waitForSelector("vertical-move-list");
    while (true) {
        let lm = await get_last_move(game);
        if (lm && lm.result) { console.log("game is over"); break; }
        let moves = await get_moves(page);
        if (last.toString() == moves.toString()) continue;
        else last = moves;

        let last_moves = moves[moves.length - 1];
        if (last_moves == undefined) { console.log("last moves undefined"); break; } 
        let last_move = last_moves[last_moves.length - 1];

        if (last_move.color.substring(5) == "time-") continue;
        console.log(last_move);

        let highlights = await get_highlights(page);

        const place = await page.evaluate((piece)=> {
            return document.querySelector(".board").querySelector(".piece.square-" + piece);
        }, highlights[0]);
        await sleep(5);
        if (place == null) {
            await game.waitForSelector(".square-" + highlights[0]);
            game.click(".square-" + highlights[0]);
            await game.waitForSelector(".square-" + highlights[1]); // should check for hint each time after click just to make sure click is registered
            await sleep(10);
            game.click(".square-" + highlights[1]);

            console.log(last_move.color + ": " + highlights[0] + " -> " + highlights[1]);
        }
        else {
            await game.waitForSelector(".square-" + highlights[1]);
            game.click(".square-" + highlights[1]);
            await game.waitForSelector(".square-" + highlights[0]);
            await sleep(10);
            game.click(".square-" + highlights[0]);

            console.log(last_move.color + ": " + highlights[1] + " -> " + highlights[0]);
        }
        await sleep(10);
        await page.evaluate(() => {
            let promotes = document.querySelectorAll(".promotion-piece");
            for (let i = 0; i < promotes.length; i++) {
                let promote = promotes[i];
                if (promote.classList[1].substring(1) == "q"){
                    promote.click();
                    break;
                }
            }
        });

        if (await is_game_over(page) && await is_game_over(game)) { console.log("this thing"); break; }
        if (last_move.result) { // check for win another way cuz gotta wait til game review for this
            console.log("last move result");
            break;
        }
        
    }
    console.log("return false");
    return false;
}

(async() => {
    const player = await puppeteer.launch({defaultViewport: null, headless: false, args: [ "--start-maximized" ]});
    const game = await player.newPage();
    await loadCookie(game);
    await game.goto("https://www.chess.com/");
    prompt("continue when logged in.");
    await saveCookie(game);
    

    while (true) {
        const browser = await puppeteer.launch({defaultViewport: null, headless: false, args: [ "--start-maximized" ]});
        const page = await browser.newPage();
        await page.goto("https://www.chess.com/play/computer");

        /*await page.waitForSelector("#username");
        await page.$eval("#username", el => el.value = "nick.notwaeeb@gmail.com");
        await page.$eval("#password", el => el.value = "Robot123");
        await page.click("#_remember_me");
        await page.click("#login");

        //await page.waitForNavigation(); */
        console.log("pre");
        await waitAndClick(page, ".ui_outside-close-component");
        //await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/212792427.43bc219b.200x200o.48fe7b579d3a.png']"); //mewtens
        await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/232238735.11a67669.200x200o.98859ab5ec43.png']"); // agent chess
        //await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/109757776.54a6d484.200x200o.aadc7de54ee7.png']"); // danya

        // engine
        /*await waitAndClick(page, "[data-chess-src='https://images.chesscomfiles.com/uploads/v1/user/42904520.792f6adb.200x200o.9e14b951fff9.png']"); // beware, engine changes photos a lot
        await page.waitForSelector("[class='slider-input']");
        const slider = await page.$("[class='slider-input']");
        const pos = await slider.asElement().boundingBox();
        const percentage = 95; // to adjust engine level
        await sleep(1000);
        await page.mouse.click(pos.x + percentage * (pos.width / 100), pos.y);
        await sleep(1000);*/

        await waitAndClick(page, ".ui_v5-button-component.ui_v5-button-primary.ui_v5-button-large.selection-menu-button"); 
        
        // automate this vvvvv
        const play = prompt("what are they playing as? ") == "b" ? "black" : "white"; 
        await waitAndClick(page, "[data-cy='" + play + "']");

        await waitAndClick(page, ".ui_v5-button-component.ui_v5-button-primary.ui_v5-button-large.ui_v5-button-full");

        //const moves = await get_moves(page);
        //console.log(moves);


        // add check for game aborted (surrender) on either game or page which will break
        feedback_game(page, game);
        if (await feedback_game(game, page) == false) {
            console.log("game result");
            // resign bot:
            // check if resign button there, then click
            await page.evaluate(() => {
                let resign = document.querySelector("[aria-label='Resign']");
                if (resign != null) { console.log("resign"); resign.click(); }
            });
            prompt("ready to play again? ");
            await sleep(1000);
            await page.close();
            await sleep(1000);
            // instead of closing, just replay bot?
            await browser.close();
            //await page.goto("https://www.chess.com/play/computer");
        }
    }
    // sometimes when replay bot to me moves dont replicate after rematch... it returns first move


    // dont do this while loop as highlgihts occur when selecting a or right clicking board. for right clcik you can check color.
    // loop vertical move list board-vs-personalities and check for change either in new move class (queryselectorall and find last move class) or a new node within that div

    // need to do when pawn reaches other side and become queen

    // https://support.chess.com/article/684-how-can-i-play-the-computer-from-a-custom-position#:~:text=Play%20from%20a%20position%20in%20one%20of%20your%20games&text=Once%20you're%20in%20the,point%2C%20but%20versus%20the%20computer!
    // https://www.chessgames.com/fenhelp.html
    // to recover from crash recreate the chessboard on the Learn -> Analysis thing. you are able to input FEN notation which can be copied from the live game. good luck
    // https://www.chess.com/practice/custom?color=white&fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&is960=false&moveList=
    // this link gives color, FEN, and also starting color (%20w) and automatically plays against best bot. waw

    //let a = await page.evaluate(() => document.querySelector(".button.auth.login.ui_v5-button-component.ui_v5-button-primary.login-modal-trigger").click())
})();

console.log('hello world g uys!');
