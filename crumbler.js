import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const args = process.argv.slice(2);
const log = console.log;
const action = args[0];

if (action === 'crumbs') {
    createDrops();
} else if (action === 'clean') {
    cleanDrops();
} else {
    log(chalk.red("Parameter not recognized. Currently supported actions are: "));
    log(chalk.gray("crumbs"));
    log(chalk.gray("clean"));
}

function createDrops() {
    log(chalk.gray("Creating drops.json"));
    let drops = [];

    fs.readdirSync("drops").forEach(file => {
        if (file.includes(".json")) {
            try {
                var drop = JSON.parse(fs.readFileSync('drops/' + file, 'utf8'));
            } catch (err) {
                log(chalk.red("Cannot read drops/ for some reason."), err);
            }

            drops.push(drop);
        }
    });

    var asJson = JSON.stringify(drops);

    fs.writeFileSync("drops.json", asJson);

    log(chalk.green("Created drops.json"));
}

function cleanDrops() {
    fs.emptyDir("drops", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete drops/"), err);
        } else {
            log(chalk.magenta("Deleted drops/"));
        }
    });

    fs.emptyDir("artists", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete artists/"), err);
        } else {
            log(chalk.magenta("Deleted artists/"));
        }
    });

    fs.emptyDir("prizes", (err) => {
        if (err) {
            log(chalk.red("Couldn't delete prizes/"), err);
        } else {
            log(chalk.magenta("Deleted prizes/"));
        }
    });

     try {
         if (fs.existsSync("drops.json")) {
            fs.rmSync("drops.json");
            log(chalk.magenta("Deleted drops.json"));
         }
     } catch (err) {
         if (err) {
             log(chalk.red("Couldn't delete drops.json"), err);
         }
     }
}