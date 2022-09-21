// Frenzy every 10 clicks (x2, 2 orbs etc.)

new p5(async p => {

let orbs = [];
let score = 0;
let scoreTextSize = 500;
let addOrb;
let clickValue = 1;
let username;
let userData;
let clicks;
let leaderboard = document.getElementById('leaderboard');
let leaderboardTable = leaderboard.firstElementChild;
let refreshLeaderboardInterval;



let tips = ["Press 'L' to open the leaderboard"];

const api = "https://hammer-4e70b-default-rtdb.firebaseio.com/orbclicker/users/";
let userId = localStorage.getItem('orbclicker-userId');

p.setup = async function() {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.noStroke();
    p.colorMode(p.HSB);
    p.textAlign(p.CENTER, p.CENTER);
    
    if (userId) {
        score = await fetch(api + `${userId}/clicks.json`).then(r => r.json());
        scoreTextSize = 500/(Math.log10(score+10));
        console.log('score', score);
        username = await fetch(api + `${userId}/name.json`).then(r => r.json());
        console.log('username', username);
    }

    userData = await getUserData();

    // create the initial leaderboard
    Object.entries(userData).forEach(([id, {clicks, name}]) => {
        let row = leaderboardTable.insertRow();
        row.dataset.id = id;
        let cell = row.insertCell();
        cell.textContent = name;
        cell = row.insertCell();
        cell.textContent = clicks;
    });

    // sort the leaderboard
    refreshLeaderboard();

    class Orb {
        constructor(x, y, vx, vy, r, c) {
            this.r = r ?? 30;
            if (arguments.length === 0) {
                this.respawn();
            } else {
                this.x = x;
                this.y = y;
            }
            this.vx = vx ?? 0;
            this.vy = vy ?? 0;
            
            this.c = c ?? p.random(0, 360);
        }

        update() {
            this.vx += p.random(-5, 5);
            this.vy += p.random(-5, 5);
            this.vx = p.constrain(this.vx, -10, 10);
            this.vy = p.constrain(this.vy, -10, 10);
            this.x += this.vx;
            this.y += this.vy;
            this.x = p.constrain(this.x, this.r, p.width-this.r);
            this.y = p.constrain(this.y, this.r, p.height-this.r);

            this.c = (this.c + 1) % 360;

            p.cursor(this.isMouseOver() ? p.HAND : p.ARROW);
            this.draw();
        }

        draw() {
            p.fill(this.c, 100, 100, 0.375 * p.sin(p.frameCount/20) + 0.625);
            p.circle(this.x, this.y, this.r*2);
        }

        isMouseOver() {
            return p.dist(p.mouseX, p.mouseY, this.x, this.y) <= this.r;
        }

        respawn() {
            this.x = p.random(this.r, p.width-this.r);
            this.y = p.random(this.r, p.height-this.r);
            this.c = p.random(0, 360);
        }
    }

    addOrb = function() {
        orbs.push(new Orb());
    }
    
    addOrb();
}

p.draw = function() {
    p.background(255);
    p.fill(60);
    p.textSize(scoreTextSize);
    p.text(score, p.width/2, p.height/2);
    p.fill(0);
    p.textSize(12);
    p.text(tips[0], p.width/2, 10);

    orbs.forEach(o => o.update());
}

p.mouseClicked = function() {
    orbs.forEach(o => {
        if (o.isMouseOver()) {
            o.respawn();
            increaseScore();
        }
    });
}

p.keyPressed = function() {
    if (p.key.toUpperCase() === 'L') {
        if (leaderboard.hidden) showLeaderboard();
        else hideLeaderboard();
    }
}

function increaseScore() {
    score += clickValue; // clickValue is currently limited (1<=val<=10) using firebase security rules
    scoreTextSize = 500/(Math.log10(score+10)); // Adjust text size based on how big the number is
    // addOrb();

    // only add userId when we also add username
    if (!userId) userId = localStorage['orbclicker-userId'] = window.crypto.randomUUID();
    fetch(api + `${userId}/clicks.json`, {
        method: "PUT",
        body: `{".sv":{"increment":${clickValue}}}`
    }).then(r => r.json()).then(num => num !== score && console.log('cheater! (score, serverScore)', score, num));

    if (score === 1 && !username) {
        username = prompt('Enter username:')?.trim() || 'User-' + userId;
        fetch(api + `${userId}/name.json`, {
            method: "PUT",
            body: `"${username}"`
        })
    }

    if (!leaderboard.hidden) refreshLeaderboard();
}

async function showLeaderboard() {
    leaderboard.hidden = false;
    refreshLeaderboard();
    refreshLeaderboardInterval = setInterval(refreshLeaderboard, 10000);
}

async function refreshLeaderboard() {
    // check if new person has joined
    let shallowUserData = Object.keys(await fetch(api + '.json?shallow=true').then(r => r.json()));
    if (shallowUserData.length > Object.keys(userData).length) {
        let newUserData = shallowUserData.filter(x => !userData[x]);
        for (let id of newUserData) {
            let data = await fetch(api + id + '.json').then(r => r.json());
            let row = leaderboardTable.insertRow();
            row.dataset.id = id;
            let cell = row.insertCell();
            cell.textContent = data.name;
            cell = row.insertCell();
            cell.textContent = data.clicks;
        }
    }
    
    // update user data
    userData = await getUserData();

    // update older rows
    Object.entries(userData).filter(x => shallowUserData.includes(x[0])).forEach(([id, {clicks, name}]) => {
        let row = leaderboardTable.querySelector(`tr[data-id="${id}"]`);
        row.cells[0].textContent = name;
        row.cells[1].textContent = clicks;
        // let row = leaderboardTable.insertRow();
        // row.dataset.id = id;
        // let cell = row.insertCell();
        // cell.textContent = name;
        // cell = row.insertCell();
        // cell.textContent = clicks;
    });
    
    // sort leaderboard
    [...leaderboardTable.querySelectorAll('tr:not(#header)')]
        .sort((a, b) => b.cells[1].textContent - a.cells[1].textContent)
        .forEach(x => leaderboardTable.appendChild(x));
}

function hideLeaderboard() {
    leaderboard.hidden = true;
    clearInterval(refreshLeaderboardInterval);
}

async function getUserData() {
    return await fetch(api + '.json').then(r => r.json());
}


});