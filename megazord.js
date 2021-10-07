import fs from 'fs-extra';
import { fork } from 'child_process';
import chalk from 'chalk';

const args = process.argv.slice(2);
const dropsDir = args[0];
const log = console.log;

run(() => processData(dropsDir, () => finish()));

function run(callback) {
    log(chalk.yellow("Cleaning up previous run."));

    var child = fork("crumbler.js", ["clean"]);

    child.on('error', function(err) {
        log(chalk.red(err));
    });

    child.on('exit', function (status) {
        if (status === 0) {
            callback(dropsDir);
        }

        if (status !== 0) {
            log(chalk.red(`exit code ${status}`));
        }
    });
}

function processData(path, callback) {
    log(chalk.blueBright(`Processing contents of ${path}`));
    
    const data = fs.readdirSync(dropsDir);
    let relevantDirs = [];
    
    data.forEach(d => {
        if (fs.lstatSync(dropsDir + "/" + d).isDirectory()) {
            relevantDirs.push(d);
        }
    });

    let counter = relevantDirs.length;
    let done = false;

    data.forEach(dropDir => {
        const dropPath = dropsDir + "/" + dropDir;
       
        if (fs.lstatSync(dropPath).isDirectory()) {
            log(chalk.blueBright(`Processing ${dropPath}`));
            var child = fork("totem.js", [dropPath]);

            child.on('error', function(err) {
                log(chalk.red(`Error encountered while processing ${dropPath}`), err);
            });

            child.on('exit', function(status) {
                if (status === 0) {
                    log(chalk.greenBright(`Finished processing ${dropPath}`));
                    counter--;

                    if (counter === 0) {
                        done = true;
                    }

                    if (done) {
                        callback();
                    }
                }
            });
        }
    });
}

function finish() {
    var child = fork("crumbler.js", ["crumbs"]);

    child.on('error', function(err) {
        log(chalk.red("Failed to generate crumbs."), err);
    });

    child.on('exit', function(status) {
        if (status !== 0) {
            console.log("something went wrong when generating breadcrumbtrail.json, status code: ", status);
            log(chalk.red(`Something went wrong when generating drops.json, status code ${status}`));
        }
    });
}