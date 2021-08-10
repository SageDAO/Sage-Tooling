import fs from 'fs-extra';
import path from 'path';

const args = process.argv.slice(2);
const action = args[0];

if (action === 'crumbs') {
    createBreadcrumbTrail();
} else if (action === 'clean') {
    cleanBreadcrumbs();
}

function createBreadcrumbTrail() {
    console.log('Creating breadcrumbtrails.json...');
    let breadcrumbs = [];

    fs.readdirSync("breadcrumbs").forEach(file => {
        if (file.includes(".json")) {
            try {
                var asObj = JSON.parse(fs.readFileSync('breadcrumbs/' + file, 'utf8'));
            } catch (err) {
                console.log('cannot read breadcrumb for some reason...', err);
            }
            breadcrumbs.push(asObj);
        }
    });

    var asJson = JSON.stringify(breadcrumbs);

    fs.writeFileSync("breadcrumbtrail.json", asJson);

    console.log('Created breadcrumbtrail.json...');
}

function cleanBreadcrumbs() {
    fs.emptyDir("breadcrumbs", (err) => {
        if (err) {
            console.log("Couldn't delete breadcrumbs...", err);
        } else {
            console.log("Deleted breadcrumbs.");
        }
    });

     try {
         fs.rmSync("breadcrumbtrail.json");
         console.log("Deleted breadcrumbtrail.");
     } catch (err) {
         if (err) {
             console.log("Couldn't delete breadcrumbtrail...", err);
         }
     }
}