import fs from 'fs-extra';
import path from 'path';

const args = process.argv.slice(2);
const action = args[0];

if (action === 'crumbs') {
    createDrops();
} else if (action === 'clean') {
    cleanDrops();
} else {
    console.log("Paramter not recognized. Currently supported actions are: ");
    console.log("crumbs");
    console.log("clean");
}

function createDrops() {
    console.log('Creating drops.json...');
    let drops = [];

    fs.readdirSync("drops").forEach(file => {
        if (file.includes(".json")) {
            try {
                var drop = JSON.parse(fs.readFileSync('drops/' + file, 'utf8'));
            } catch (err) {
                console.log('cannot read drops/ for some reason...', err);
            }

            drops.push(drop);
        }
    });

    var asJson = JSON.stringify(drops);

    fs.writeFileSync("drops.json", asJson);

    console.log('Created drops.json...');
}

function cleanDrops() {
    fs.emptyDir("drops", (err) => {
        if (err) {
            console.log("Couldn't delete drops/", err);
        } else {
            console.log("Deleted drops/");
        }
    });

    fs.emptyDir("artists", (err) => {
        if (err) {
            console.log("Couldn't delete artists/", err);
        } else {
            console.log("Deleted artists/");
        }
    });

    fs.emptyDir("prizes", (err) => {
        if (err) {
            console.log("Couldn't delete prizes/", err);
        } else {
            console.log("Deleted prizes/");
        }
    });

     try {
         if (fs.existsSync("drops.json")) {
            fs.rmSync("drops.json");
            console.log("Deleted drops.json");
         }
     } catch (err) {
         if (err) {
             console.log("Couldn't delete drops.json...", err);
         }
     }
}