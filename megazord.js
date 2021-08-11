import fs from 'fs-extra';
import { fork } from 'child_process';

const args = process.argv.slice(2);
const dropsDir = args[0];

run(() => processData(dropsDir, () => finish()));

function run(callback) {
    console.log("Cleaning up previous run...");

    var child = fork("crumbler.js", ["clean"]);

    child.on('error', function(err) {
        console.log('errrrr', err);
    });

    child.on('exit', function (status) {
        if (status === 0) {
            callback(dropsDir);
        }

        if (status !== 0) {
            console.log('exit code: ', status);
        }
    });
}

function processData(path, callback) {
    console.log('gonna process data at ', path);

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
            console.log(`Processing ${dropPath}...`);
            var child = fork("totem.js", [dropPath]);

            child.on('error', function(err) {
                console.log(`While processing ${dropPath}, error encountered: `, err);
            });

            child.on('exit', function(status) {
                if (status === 0) {
                    console.log(`Finished processing ${path}`);
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
        console.log("Failed to generate crumbs, ", err);
    });

    child.on('exit', function(status) {
        if (status === 0) {
            console.log(`Finished.`);
        } else {
            console.log("something went wrong when generating breadcrumbtrail.json, status code: ", status);
        }
    });
}